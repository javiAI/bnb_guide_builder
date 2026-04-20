# API_CONTRACTS

## 1. General rules

- JSON sobre HTTP
- validación con Zod en toda frontera externa
- errores con shape uniforme
- rutas públicas y de operador claramente separadas

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

### Ops and audit

- `GET /api/properties/:propertyId/review-queue`
- `GET /api/properties/:propertyId/audit-log`
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
