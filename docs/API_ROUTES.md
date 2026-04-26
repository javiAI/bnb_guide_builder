# API_CONTRACTS

## 0. Auth, ownership y rate-limit por ruta (Rama 15A–15D)

Toda ruta bajo `src/app/api/properties/[propertyId]/...` se construye con `withOperatorGuards<P>(handler, { rateLimit })` (`src/lib/auth/operator-guards.ts`). El wrapper aplica, en orden: (1) `requireOperator()` → 401 si no hay sesión, (2) `loadOwnedProperty(propertyId)` → 404 si la propiedad no pertenece al workspace del operador, (3) `applyOperatorRateLimit({ userId, bucket })` → 429 con `Retry-After`. Cada ruta declara su bucket (`read`/`mutate`/`expensive`); el test `operator-route-coverage.test.ts` falla en CI si una ruta nueva omite el wrapper sin marcar `// guards:manual <razón>`.

| Bucket | Cap | Uso |
| --- | --- | --- |
| `read` | 60 req/60s | GETs, list endpoints |
| `mutate` | 20 req/60s | POST/PATCH/DELETE no costosos |
| `expensive` | 10 req/60s | LLM/RAG/Places/exports/imports |

Buckets registrados (subject to `audit-mutation-coverage.test.ts` para mutaciones):

| Ruta | Method | Bucket |
| --- | --- | --- |
| `/api/properties/:propertyId/derived` | GET | `read` |
| `/api/properties/:propertyId/guide` | GET | `read` |
| `/api/properties/:propertyId/places-search` | GET | `expensive` (+ per-property 30/60s de 13A en cascada) |
| `/api/properties/:propertyId/assistant/ask` | POST | `expensive` |
| `/api/properties/:propertyId/assistant/conversations` | GET | `read` |
| `/api/properties/:propertyId/assistant/conversations` | POST | `mutate` |
| `/api/properties/:propertyId/assistant/debug/retrieve` | POST | `expensive` |
| `/api/properties/:propertyId/export/airbnb` | GET | `expensive` |
| `/api/properties/:propertyId/export/booking` | GET | `expensive` |
| `/api/properties/:propertyId/import/airbnb/preview` | POST | `mutate` |
| `/api/properties/:propertyId/import/booking/preview` | POST | `mutate` |

**Mutaciones operator → `writeAudit()`**: cada server action / API mutation que toca una entidad auditable (GuideVersion, Incident, Property, Workspace, Session, Membership) llama `writeAudit({propertyId, actor:formatActor({type:"user", userId}), entityType, entityId, action, diff?})` después del write exitoso. El wrapper NO escribe audit — es explícito en cada call site (decisión Fase -1 de 15D). Lista canónica de call sites en `docs/SECURITY_AND_AUDIT.md` §4.

**Public routes y guest writes**: las rutas `/api/g/:slug/*` no usan `withOperatorGuards` (no hay operador). Mantienen sus propios limiters por slug+IP (helper compartido `sliding-window-rate-limit.ts`). Capacities firmadas via `signPublicCapability` / `verifyPublicCapability` — ver `SECURITY_AND_AUDIT.md` §0.5.

## 1. General rules

- JSON sobre HTTP
- validación con Zod en toda frontera externa
- errores con shape uniforme
- rutas públicas y de operador claramente separadas
- toda ruta operator-facing construida con `withOperatorGuards` declarando su bucket de rate-limit (ver §0)

## 2. Route groups

### Properties

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/properties`
- `POST /api/properties`
- `GET /api/properties/:propertyId`
- `PATCH /api/properties/:propertyId`

### Creation wizard

- `GET /api/properties/new/defaults`
- `POST /api/properties/drafts`
- `POST /api/properties/create-usable`

### Wizard sessions

- `GET /api/properties/:propertyId/wizard`
- `POST /api/properties/:propertyId/wizard/start`
- `POST /api/properties/:propertyId/wizard/responses`
- `PATCH /api/wizard-responses/:responseId`
- `POST /api/properties/:propertyId/wizard/complete`

### Canonical editor entities

- `GET /api/properties/:propertyId/spaces`
- `POST /api/properties/:propertyId/spaces`
- `GET /api/spaces/:spaceId`
- `PATCH /api/spaces/:spaceId`

- `GET /api/properties/:propertyId/amenities`
- `POST /api/properties/:propertyId/amenities`
- `GET /api/property-amenities/:amenityId`
- `PATCH /api/property-amenities/:amenityId`

- `GET /api/properties/:propertyId/troubleshooting`
- `POST /api/properties/:propertyId/troubleshooting`
- `GET /api/troubleshooting-playbooks/:playbookId`
- `PATCH /api/troubleshooting-playbooks/:playbookId`

- `GET /api/properties/:propertyId/local-places`
- `POST /api/properties/:propertyId/local-places`
- `GET /api/local-places/:localPlaceId`
- `PATCH /api/local-places/:localPlaceId`
- `GET /api/properties/:propertyId/places-search?q=<2-120>&limit=<1-15>&lang=es|en` — Host-only typeahead (Rama 13A; wrapped in 15D). Anchor lat/lng derived server-side from `Property.latitude`/`longitude` (never trusted from query). Responses: `200 { suggestions: PoiSuggestion[], provider }`, `400 invalid_query`, `404 not_found`, `409 property_missing_coordinates`, `429 rate_limited`, `502 provider_unavailable`, `503 provider_not_configured`. `Cache-Control: no-store`. **Layered rate-limit (15D)**: per-actor `expensive` bucket (10 req/60s) applied by `withOperatorGuards` runs first; per-property limiter from 13A (30 req/60s/propertyId, sliding window, LRU 256 buckets) runs second to cap cross-actor bursts after wrapper passes. Both emit 429 with `Retry-After`. Provider is env-selectable: `LOCAL_POI_PROVIDER` ∈ {`maptiler`, `mock`} (default `maptiler`); missing `MAPTILER_API_KEY` in prod → fail-fast, in dev → degrades to mock.

- `GET /api/properties/:propertyId/ops/checklist`
- `POST /api/properties/:propertyId/ops/checklist`
- `GET /api/properties/:propertyId/ops/stock`
- `POST /api/properties/:propertyId/ops/stock`
- `GET /api/properties/:propertyId/ops/maintenance`
- `POST /api/properties/:propertyId/ops/maintenance`

### Media

- `GET /api/properties/:propertyId/media-assets`
- `POST /api/properties/:propertyId/media-assets/request-upload`
- `POST /api/properties/:propertyId/media-assets/complete-upload`
- `PATCH /api/media-assets/:mediaAssetId`
- `POST /api/media-assets/:mediaAssetId/assign`

### Knowledge and guide

- `GET /api/properties/:propertyId/knowledge-items`
- `POST /api/properties/:propertyId/knowledge-items/regenerate`
- `PATCH /api/knowledge-items/:knowledgeItemId`
- `GET /api/knowledge-items/:knowledgeItemId`

- `GET /api/properties/:propertyId/guide?audience=guest|ai|internal&format=md|html|json|pdf` — renderiza en vivo el `GuideTree` compuesto por `composeGuide`. `audience` default `guest`, `format` default `json`. Devuelve `text/markdown`, `text/html`, `application/json` o `application/pdf` según `format`. El formato `pdf` fuerza `Content-Disposition: attachment`. Todos los outputs incluyen `generatedAt` (ISO).
- `GET /api/properties/:propertyId/guide-versions`
- `POST /api/properties/:propertyId/guide-versions`
- `GET /api/guide-versions/:guideVersionId`
- `PATCH /api/guide-sections/:guideSectionId`
- `POST /api/guide-versions/:guideVersionId/publish`

#### Public guest guide

- `GET /api/g/:slug/search?q=<query>` — **público, sin autenticación** (rama 11F). Delega al hybrid retriever de 11C (BM25 + vector + RRF) con `audience='guest'` forzado y `locale=Property.defaultLocale` (invariante: nunca se lee del request). Sin reranker ni synthesizer. Rate-limit 10 req/min por slug (in-memory, per-process). `Cache-Control: no-store`. `q ∈ [2, 200]` caracteres (Zod).

  **Contrato de locale (11F, acordado 2026-04-20):** *one property = one published guide locale = `Property.defaultLocale`*. Hoy `GuideVersion` no tiene columna `locale`, `GuideTree` no lleva campo de locale, `composeGuide()` no recibe locale y `/g/[slug]/page.tsx` no tiene selector de idioma para el huésped — la snapshot publicada está implícitamente atada a `Property.defaultLocale`. El retriever usa ese mismo campo para evitar mismatch con el idioma que el huésped está leyendo. Cuando aterrice multi-locale publishing, la fuente de verdad deberá pasar a `GuideVersion.locale` (o el surface equivalente); el test `guide-search-visibility.test.ts` pinea el contrato actual y debe actualizarse en ese momento.

  Status codes:
  - `200` — `{ hits: GuideSemanticHit[], degraded: boolean }`. `hits ≤ 5`. Cada hit: `{ itemId, sectionId, sectionLabel, anchor, label, snippet, score }` — pointers, no texto sintetizado. `anchor` es `item-<entityId>` si existe o `section-<sectionId>` (coinciden con IDs del DOM del renderer).
  - `400 invalid_query` — `q` vacío, <2, >200, o ausente.
  - `404 not_found` — slug sin `Property` o sin `GuideVersion` publicado.
  - `429 rate_limited` — excede 10 req/min. Body `{ error: "rate_limited", retryAfterSeconds }` + header `Retry-After`.
  - `500 internal_error` — errores no esperados del retriever (embedding provider down, DB, etc.).

  Mapping `entityType → sectionId` vive en `taxonomies/guide_sections.json` (`entityTypes[]`). Override: `journeyStage==='checkout'` re-homa a `gs.checkout`. Items sin sección asignable se dropean del payload.

- `POST /api/g/:slug/incidents` — **público, sin autenticación** (rama 13D, cookie generalizada en 15C). Crea un `Incident` con `origin='guest_guide'`, `reporterType='guest'`, `visibility='internal'` (hardcoded — guest nunca produce incidents con visibility superior). Body Zod-validated `{ categoryKey, summary (≤500), guestContactOptional? (≤200) }`. `categoryKey` debe existir en `taxonomies/incident_categories.json` (9 categorías). Rate-limit sliding-window 3 req/60s por `(slug + IP)` (helper compartido `sliding-window-rate-limit.ts` — mismo contrato que `guide-search`). Side-effects: (a) `Set-Cookie: gc-incident_read-<slug>=<envelope.hmac>; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` (7d TTL); envelope `{cap:'incident_read', slug, iat, payload:{ids[≤10]}, v}` firmado con `PUBLIC_CAPABILITY_SECRET` (ver `docs/SECURITY_AND_AUDIT.md` §0.5); (b) disparo async a `EmailProvider.notifyHostOfIncident(...)` — en 13D el provider es no-op stub (errores swallowed, nunca degrada el response).

  Status codes:
  - `201` — `{ incidentId, trackUrl }`. `trackUrl` = `/g/:slug/incidents/:id` (pointer a la tracking page).
  - `400 validation_error` — categoryKey desconocido, summary vacío/>500, contact >200.
  - `410 gone` — slug sin `Property` o sin `GuideVersion` publicado (la guía no está disponible).
  - `429 rate_limited` — body `{ error: "rate_limited", retryAfterSeconds }` + header `Retry-After`.
  - `500 internal_error` — errores de DB.

  `Cache-Control: no-store`.

- `GET /api/g/:slug/incidents/:id` — **público, capability-gated** (rama 13D, cookie generalizada en 15C). Lee un incident creado por el mismo device (mismo browser, misma cookie capability `incident_read` slug-scoped). Validación vía `readPublicCapabilityFromCookie({capability:'incident_read', slug})`: (1) cookie `gc-incident_read-<slug>` presente, envelope HMAC válido, `cap='incident_read'`, `slug` del envelope = slug de la URL, no expirada (TTL 7d; además se rechazan envelopes con `iat` >5 min en el futuro), payload `{ids:[…]}` valida el schema, (2) `id` ∈ `payload.ids`, (3) incident existe con `origin='guest_guide'` y `propertyId` matching `Property.publicSlug=<slug>`. Projection de campos a guest: **solo** `{ id, status, categoryKey, createdAt, resolvedAt }` (whitelist en `src/lib/visibility.ts`). `summary`, `guestContactOptional`, `notes`, `reporterUserId` NUNCA se sirven al guest (visibility=`internal`).

  Status codes:
  - `200` — `{ incident: { id, status, categoryKey, createdAt, resolvedAt } }`.
  - `404 not_found` — cookie ausente/tampered/expired, id no en cookie.ids, incident inexistente, o cross-property attempt (IDOR defense).

### Messaging and automation

- `GET /api/properties/:propertyId/message-templates`
- `POST /api/properties/:propertyId/message-templates`
- `GET /api/message-templates/:messageTemplateId`
- `PATCH /api/message-templates/:messageTemplateId`
- `POST /api/properties/:propertyId/messages/preview`
- `GET /api/properties/:propertyId/message-automations`
- `POST /api/properties/:propertyId/message-automations`
- `PATCH /api/message-automations/:automationId`

### Assistant

- `POST /api/properties/:propertyId/assistant/ask`
- `POST /api/properties/:propertyId/assistant/debug/retrieve`
- `GET /api/properties/:propertyId/assistant/conversations`
- `POST /api/properties/:propertyId/assistant/conversations`
- `GET /api/assistant-conversations/:conversationId/messages`

### Platform integrations

**Exports:**

- `GET /api/properties/:propertyId/export/airbnb` — serializes a Property to an Airbnb-compatible JSON draft (rama 14B). Returns `200 { payload: AirbnbListingPayload, warnings: ExportWarning[], generatedAt: ISO, taxonomyVersion: string }`. `Cache-Control: no-store`. Errors: `404 NOT_FOUND` (property missing or not owned by the operator's workspace), `500 EXPORT_ERROR` (unexpected). The Zod schema is **best-effort, not officially confirmed** against Airbnb's Listings API — see [docs/FEATURES/PLATFORM_INTEGRATIONS.md](FEATURES/PLATFORM_INTEGRATIONS.md). **Access control** (15A–15D): wrapped in `withOperatorGuards({ rateLimit: "expensive" })` — session + workspace ownership + 10 req/60s per actor. Data-layer defense persists: the loader scopes Prisma reads to `visibility: "guest"` for spaces and amenities (pinned by `airbnb-export-no-leak.test.ts`).
- `GET /api/properties/:propertyId/export/booking` — serializes a Property to a Booking.com-compatible JSON draft (rama 14C). Returns `200 { payload: BookingListingPayload, warnings: ExportWarning[], generatedAt: ISO, taxonomyVersion: string }`. `Cache-Control: no-store`. Errors: `404 NOT_FOUND`, `500 EXPORT_ERROR`. The Zod schema is **best-effort, not officially confirmed** against Booking's Connectivity API — see [docs/FEATURES/PLATFORM_INTEGRATIONS.md](FEATURES/PLATFORM_INTEGRATIONS.md). Shape diverges from the Airbnb payload: `max_occupancy` / `policies.*` / `fees.*` / `house_rules_text` + a `checkin_instructions` free-text bucket (Booking has no structured `check_in_method` enum). **Access control** (15A–15D): same wrapper as `/export/airbnb` (`expensive` bucket); `visibility: "guest"` scoping enforced at the Prisma layer (pinned by `booking-export-no-leak.test.ts`).

**Imports:**

- `POST /api/properties/:propertyId/import/airbnb/preview` — preview-only reconciliation of an inbound Airbnb listing JSON (rama 14D). Accepts a JSON payload in the request body (no multipart; payload is validated with Zod). Returns `200 { diff: ImportDiff, warnings: ImportWarning[] }` with no mutations. The `diff` object contains six categories: `scalar`, `policies`, `presence`, `amenities`, `freeText`, and `customs`. Each scalar/policy entry carries a `status` ∈ {`fresh`, `identical`, `conflict`, `unactionable`} and a suggested action. Unactionable entries have a mandatory `reason` field. `Cache-Control: no-store`. Error responses: `400 INVALID_JSON` (malformed request), `400 PAYLOAD_PARSE_ERROR` with `issues: string[]` (Zod validation failure), `404 NOT_FOUND`, `500 IMPORT_PREVIEW_ERROR`. See [docs/FEATURES/PLATFORM_INTEGRATIONS.md](FEATURES/PLATFORM_INTEGRATIONS.md) §8 for reconciliation semantics and §8.4 for the no-mutate invariant. **Access control** (15A–15D): wrapped in `withOperatorGuards({ rateLimit: "mutate" })`. Apply/mutation is out of scope (14D preview-only; apply planned for 15E now that the auth foundation is in place).
- `POST /api/properties/:propertyId/import/booking/preview` — symmetric to `/import/airbnb/preview` for Booking listings (rama 14E). Same shape, same access control wrapper (`mutate` bucket).

### Ops and audit

- `GET /api/properties/:propertyId/review-queue`
- `GET /api/properties/:propertyId/audit-log` — **declarado, no implementado todavía**. La capa de persistencia (`writeAudit()` + `AuditLog` table) está viva desde 15D, pero la lectura/UI queda como deuda explícita — ver `docs/SECURITY_AND_AUDIT.md` §6.2 para el plan.
- `GET /api/properties/:propertyId/analytics`

## 3. Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid payload",
    "details": {
      "fieldErrors": {}
    }
  }
}
```

## 4. Create usable property request

```json
{
  "workspaceId": "ws_123",
  "draft": {
    "roomType": "entire_place",
    "propertyType": "apartment",
    "propertyNickname": "Alcalá Centro",
    "country": "España",
    "city": "Madrid",
    "timezone": "Europe/Madrid",
    "addressLevel": "exact",
    "streetAddress": "Calle Mayor 10",
    "postalCode": "28013",
    "region": "Madrid",
    "maxGuests": 4,
    "bedroomsCount": 2,
    "bedsCount": 3,
    "bathroomsCount": 1,
    "checkInWindow": {
      "start": "16:00",
      "end": "22:00"
    },
    "checkOutTime": "11:00",
    "primaryAccessMethod": "am.lockbox",
    "hostContactPhone": "+34...",
    "supportContact": "Equipo Alcalá"
  }
}
```

## 5. Assistant ask response

`POST /api/properties/:propertyId/assistant/ask`

Body (Zod-validated in `src/lib/schemas/assistant.schema.ts`):

```json
{
  "question": "¿Cómo enciendo la calefacción?",
  "language": "es",
  "audience": "guest",
  "journeyStage": null,
  "conversationId": null
}
```

Response (Rama 11C):

```json
{
  "data": {
    "answer": "El termostato del salón enciende la calefacción [1].",
    "citations": [
      {
        "knowledgeItemId": "ki_123",
        "sourceType": "system",
        "entityLabel": "Calefacción",
        "score": 0.87
      }
    ],
    "confidenceScore": 0.5,
    "escalated": false,
    "escalationReason": null,
    "conversationId": "conv_abc"
  }
}
```

Citation shape: `{ knowledgeItemId, sourceType, entityLabel, score }`. `score` es el rerankScore (Cohere rerank-multilingual-v3.0) normalizado a [0,1]. Cuando el modelo escala (fuente insuficiente, off-topic), `answer = ""`, `citations = []`, `escalated = true`, `escalationReason` explica el motivo.

### Debug retrieve

`POST /api/properties/:propertyId/assistant/debug/retrieve` — endpoint interno para ops/ajuste. Ejecuta intent + retrieval + rerank sin síntesis. Devuelve `{ items[], intent, retrieval: { scopeSize, withEmbedding, bm25Hits, vectorHits, degraded } }`. No persiste conversación.

## 6. Messaging automation request

```json
{
  "touchpointKey": "mtp.day_of_checkin",
  "templateId": "tmpl_123",
  "channelKey": "whatsapp",
  "active": true,
  "triggerType": "reservation_relative",
  "sendOffsetMinutes": -120,
  "timezoneSource": "property_timezone",
  "conditionsJson": {
    "requiresBookedGuestAudience": true
  }
}
```

## 7. Media upload contract

El backend no recibe binarios directamente en el endpoint principal. Flujo:

1. `request-upload`
2. cliente sube a storage
3. `complete-upload` confirma metadata
4. `assign` vincula el asset a la entidad

## 8. Security notes

- no secrets en previews ni drafts por defecto
- no `internal` ni `secret` en guest guide pública
- assistant público solo puede recuperar `public`
