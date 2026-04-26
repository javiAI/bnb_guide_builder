# SECURITY_VISIBILITY_AND_AUDIT

## 0. Auth & access control — estado actual y deuda abierta

Este documento cubre **visibilidad de datos** (qué campo puede salir a qué audiencia) y **audit log** (qué se registra de las mutaciones). Una tercera dimensión — **autenticación y autorización del actor que ejecuta la request** — no está resuelta en el repo todavía. Esta sección es explícita sobre qué hay y qué falta para que ninguna PR se presente como "protegida" sin que lo esté.

### 0.1 Qué existe hoy

- **Auth de operator activa (Ramas 15A–15E)**: Google OAuth login (15A), guards de ownership por workspace en API routes y server pages (15B), capability primitive tipado para guest flows (15C), audit writer real + per-actor rate-limit + invariantes CI bloqueantes (15D), closed-loop apply de imports Airbnb/Booking con audit `import.apply` + idempotency fingerprint (15E).
- **Wrapper transversal `withOperatorGuards`**: las 10 rutas bajo `src/app/api/properties/[propertyId]/...` componen `requireOperator()` + `loadOwnedProperty(propertyId)` + `applyOperatorRateLimit(bucket)` en un solo punto. El wrapper NO escribe audit — `writeAudit()` queda explícito en cada call site de mutación (decisión Fase -1 de 15D para no opacar el wrapper). Pinneado por `src/test/auth/operator-route-coverage.test.ts`.
- **AuditLog writer real (Rama 15D)**: `src/lib/services/audit.service.ts` expone `writeAudit({propertyId, actor, entityType, entityId, action, diff?})` append-only y fail-soft. `propertyId` es nullable en el schema para soportar audits globales (`session.start`/`session.end`). Acciones whitelisted en `AUDIT_ACTIONS` con runtime guard `assertAuditAction()`. Actor format `user:<id> | guest:<slug> | system:<job>` pinneado por `audit-actor-format.test.ts`. Diffs pasan por `redactSecretsForAudit()` (recursivo, con cap de profundidad y detección de ciclos) antes de persistirse — ver §3.
- **Per-actor rate limit (Rama 15D)**: `src/lib/services/operator-rate-limit.ts`, tres buckets pinneados:
  - `read` — 60 req/60s (GETs, list endpoints).
  - `mutate` — 20 req/60s (POST/PATCH/DELETE).
  - `expensive` — 10 req/60s (LLM/RAG/Places API).
  Backed por el sliding-window helper de 13D, single-process. Multi-region requeriría un backend Redis detrás de la misma surface.
- **Coexistencia de limitadores**: `places-search` mantiene su limiter por-property de 13D (30/60s, protege bursts cross-property anónimos) **además** del per-actor del wrapper. El wrapper aplica primero — el per-property capa por debajo.
- **Guest flows con capability tipada (Rama 15C)**: primitivo tipado `signPublicCapability` / `verifyPublicCapability` parametrizado por `(capability, slug, payload)`. Cookie name `gc-<capability>-<slug>`, single shared secret `PUBLIC_CAPABILITY_SECRET` (≥16 chars en prod), envelope `{cap, slug, iat, payload, v}` con HMAC-SHA256 sobre el envelope ya codificado, `timingSafeEqual` constant-time, guard que rechaza `iat` >5 min en el futuro (la antigüedad se controla por TTL), drop-silent (null) en cualquier fallo. Catálogo activo y rationale en §0.5.
- **Lectura de guía pública**: gated por `publicSlug` + `GuideVersion.published ≥ 1`. Ver `docs/FEATURES/MEDIA_ASSETS.md` §7 y `src/app/g/[slug]/*`.

### 0.2 Qué falta, explícito

**Auth de operator/host** (autenticación tradicional con cuenta):

- ✅ Google OAuth login (15A).
- ✅ Sesiones HMAC-SHA256 firmadas en cookie (`session-crypto.ts`, 7d TTL).
- ✅ Middleware Next.js + `requireOperator()` + `loadOwnedProperty(propertyId)` (15A/15B).
- ✅ Guards reutilizables vía `withOperatorGuards()` para API routes y `loadOwnedPropertyForPage()` para server pages.
- ⏳ Diferido a Fase 16+: roles granulares dentro de un workspace (hoy `owner` es el único rol que materialmente decide algo), MFA, password reset path para email/password fallback (no urgente — OAuth-only es aceptable mientras el producto siga siendo single-channel).

**Capabilities para guest flows** (no es login — es autorización de acciones firmadas):

- ✅ **Rama 15C cerrada**: primitivo tipado en `src/lib/auth/public-capability.ts` + registro en `src/lib/auth/public-capability-registry.ts`. Catálogo, contrato y rationale en §0.5.
- ⏳ Pendiente: catálogo no-trivial (más de un consumer real), `revokePublicCapability` para invalidación on-demand sin esperar TTL, fingerprint en signed payload para detección de replay cross-device.

**Hardening + audit real**:

- ✅ `AuditLog` writer real invocado desde mutaciones (15D — guide.actions, incident.actions, incident-from-guest, OAuth callback, logout; 15E — `applyImportDiff` con `action=import.apply`). Append-only, fail-soft, secretos redactados antes de persistir.
- ✅ Rate-limit per-actor con tres buckets (`read`/`mutate`/`expensive`) en `withOperatorGuards`.
- ✅ Invariantes cross-workspace + route-coverage + audit-coverage + redaction + actor-format en `src/test/auth/*` (5 tests bloqueantes para CI).
- ⏳ **Audit reads / queries del operator** (filtrar AuditLog por entidad, exportar a CSV) — diferido. La capa de persistencia está; falta UI/API.
- ⏳ **Retention policy** del AuditLog — hoy crece sin truncate. Plan: cron mensual que archive rows >365d a un blob storage frío + delete. Diferido a Fase 16+ por no ser bloqueante en estado actual de tráfico.
- ⏳ **Audit en cron jobs internos** (`embed-backfill`, sync de places, etc.) — los jobs internos no llaman `writeAudit({type:"system", job:"<name>"})` todavía. Cuando se ejecuten en prod con cualquier cadencia regular, deben emitir audit rows con `actor: system:<job>`. Diferido.

### 0.3 Por qué se resolvió transversalmente

La trampa que se quería evitar: cada PR inventando su propio mini-modelo de auth, env-tokens temporales que se vuelven deuda silenciosa, surface protegida solo a trozos. Las cinco ramas de Fase 15 (15A → 15E) cerraron los tres frentes (operator auth, guest capabilities, audit/rate-limit) sobre **un único primitivo transversal** (`withOperatorGuards`) que cualquier ruta nueva en `src/app/api/properties/[propertyId]/...` debe usar — el test `operator-route-coverage.test.ts` falla en CI si una ruta nueva omite el wrapper sin marcar `// guards:manual <razón>`. 15E cerró el bucle de imports (Airbnb + Booking) bajo el mismo primitivo, escribiendo `action=import.apply` con fingerprint idempotente.

### 0.4 Regla dura para nuevas rutas operator-facing

Toda ruta nueva bajo `src/app/api/properties/[propertyId]/...` se escribe con `withOperatorGuards<P>(handler, { rateLimit })` y declara su bucket. Toda mutación nueva sobre entidades auditables (GuideVersion, Incident, Property, Workspace, Session, Membership) llama `writeAudit({propertyId, actor, entityType, entityId, action, diff?})` después del write exitoso. Ambos contratos están pinneados por tests invariantes en `src/test/auth/*`. El escape hatch `// guards:manual <razón>` existe para casos legítimos (webhooks externos firmados con su propio secret, p. ej.) — debe documentar la razón inline.

### 0.5 Public guide capabilities (Rama 15C)

La generalización del HMAC ad-hoc de 13D vive en `src/lib/auth/public-capability.ts` + `src/lib/auth/public-capability-registry.ts`. Es el único patrón de authorization para acciones firmadas originadas por huésped — toda nueva capacity de guest pasa por aquí.

**Contrato del primitivo**:

- **Envelope firmado**: `{cap, slug, iat, payload, v}` codificado base64url; HMAC-SHA256 cubre el envelope ya codificado (no se re-encoda al verificar — cualquier varianza de whitespace o key-order invalidaría cookies). Formato sobre el wire: `<base64url envelope>.<base64url hmac>`.
- **Single shared secret**: `PUBLIC_CAPABILITY_SECRET` (≥16 chars en prod, fail-fast si falta; dev/test cae a un placeholder determinístico). Aislamiento cross-capability se enforce dentro del envelope (`obj.cap === capability`), no por per-cap secrets — una rotación invalida todas las cookies pendientes en un solo movimiento. **15C reemplazó `GUEST_INCIDENT_COOKIE_SECRET` (cutover duro)**: cookies firmadas bajo el secret antiguo fallan verify silenciosamente, los huéspedes re-reportan para re-ganar autoridad de lectura.
- **Cookie name**: `gc-<capability>-<slug>` (RFC 6265 token-safe — verificado en module-load). Una cookie por `(capability, slug)`, path `/` para cubrir `/g/:slug/*` y `/api/g/:slug/*`. Slug isolation por nombre + payload firmado; capability isolation por payload firmado.
- **Per-capability TTL**: cada capability declara `ttlSeconds` propio (default `DEFAULT_CAPABILITY_TTL_SECONDS = 7d`). Verify rechaza envelopes más viejos que el bound declarado.
- **Versionado del envelope**: `PUBLIC_CAPABILITY_VERSION` (≥1). Cualquier `obj.v !== VERSION` se rechaza — bumpear la constante es una rotación dura adicional al secret.
- **Clock-skew guard (solo futuro)**: 5 min (`CLOCK_SKEW_TOLERANCE_SECONDS = 300`). Envelopes con `iat` más de 5 min en el futuro se rechazan (drift de servidor o juegos de replay); `iat` en el pasado no tiene rechazo simétrico aparte del TTL.
- **Per-capability payload schema (Zod)**: validación estricta en sign **y** verify. Un atacante que forge un envelope con misma key pero payload mal formado se rechaza al verificar (defensa en profundidad). Sign-time errors son programmer errors → throw.
- **Drop-silent semantics**: `verifyPublicCapability` nunca throw, nunca devuelve 403/401. En cualquier fallo (firma, version, slug, capability, TTL, schema, parse) retorna `null`. La capa de aplicación decide la respuesta — típicamente 404 para no confirmar la existencia del id al caller no autorizado.

**API mínima**:

```text
signPublicCapability({ capability, slug, payload, nowSeconds? }) → string
verifyPublicCapability({ raw, capability, slug, nowSeconds? }) → { payload } | null
publicCapabilityCookieName(capability, slug) → string
readPublicCapabilityFromCookie({ cookies, capability, slug, nowSeconds? }) → { payload } | null
setPublicCapabilityCookie({ response, capability, slug, signedValue }) → void
isRegisteredCapability(key) → key is CapabilityKey
```

**Por qué TS const y no JSON**:

El registro de capacidades vive en TypeScript (`PUBLIC_CAPABILITIES`) y deliberadamente **no** en `taxonomies/*.json`. Las taxonomías JSON modelan el **dominio de producto** (qué amenities, qué categorías de incidentes existen) — el registry de capacidades modela el **mecanismo de autorización**. Cuatro razones:

1. **Code-coupled**: cada capability declarada requiere uno o más call sites TS que firmen o verifiquen contra ella. Registry y consumer están atados por contrato; no hay desacoplo "data evolves without code" como sí lo hay para amenities (la taxonomía crece sin tocar UI). Una nueva capability es siempre una PR coordinada que añade entry **y** wirea consumers en el mismo cambio.
2. **No editable por operadores**: las taxonomías JSON son contenido del producto. Los huéspedes/hosts/operadores nunca editan capabilities — solo cambian con un PR de código.
3. **Content vs mechanism**: mutar una capability sin tocar el código que la consume rompe en runtime como tampered-cookie / silent-drop. Mutar una amenity en JSON solo afecta el render. Los regímenes de cambio son distintos y el storage debe reflejarlo.
4. **Per-capability type inference**: `CapabilityPayload<C>` resuelve en compile-time al payload exacto de la capability `C`. Un loader JSON devolvería `unknown` y forzaría casts manuales en cada call site, perdiendo cross-capability isolation a nivel de tipos.

El test de coverage equivalente (`auth-public-capability.test.ts`) asserta que toda capability key está registrada y que `isRegisteredCapability` narrow correctamente — mismo patrón que `field-type-coverage.test.ts`.

**Catálogo activo (15C)**:

- **`incident_read`** — TTL 7 d. Payload `{ ids: string[≤MAX_INCIDENT_IDS_PER_COOKIE=10] }` (.strict). Consumers: `POST /api/g/:slug/incidents` (sign+set tras crear el incidente), `GET /api/g/:slug/incidents/:id` y `/g/:slug/incidents/:id` page (read).

**Candidatos diferidos** (no registrados — se añaden con su consumer en la misma PR, nunca especulativamente):

- `guide_feedback` — autorización para que el huésped re-edite/borre feedback que envió.
- `booking_extension_request` — TTL probable 24 h, payload con `requestId`.
- `incident_report` — actualmente no es necesario porque `POST /api/g/:slug/incidents` es público + rate-limited; se añadiría si en el futuro queremos linkar reports a una sesión persistente sin login.

**Regla de extensión**: añadir una capability requiere (1) entry en `PUBLIC_CAPABILITIES` con `key`, `ttlSeconds`, `payloadSchema`, (2) sign en el endpoint que crea autoridad, (3) verify (vía `readPublicCapabilityFromCookie`) en cada endpoint que la consume, (4) test invariantes en `auth-public-capability.test.ts` actualizado para incluirla en el assert de "single capability" si aplica. Nunca declarar una capability sin consumer real en la misma PR.

---

## 1. Visibility levels

- `public`
- `booked_guest`
- `internal`
- `secret`

## 2. Enforcement

- servidor como autoridad final
- Zod en inputs
- filtrado de retrieval y render en backend
- activity log para mutaciones relevantes
- `/g/*` rutas públicas **siempre** fuerzan `audience=guest` server-side: `filterByAudience(items, "guest")` se aplica sobre el `treeJson` almacenado (que contiene audience=internal). `emptyCtaDeepLink` se anula para no exponer links del panel de host. Los niveles `internal` y `sensitive` nunca llegan al HTML renderizado.
- **Coordenadas exactas de la propiedad**: para `audience=guest` / `audience=ai` nunca se exponen `Property.latitude` / `Property.longitude` al cliente. Los helpers `buildGuideMapData` y el tipo `GuideMapAnchor` (rama 13C) enmascaran la ubicación mediante `obfuscateAnchor` (desplazamiento radial determinístico por `propertyId`, radio por defecto 300 m) y devuelven un anchor `{ obfuscated: true, lat, lng, radiusMeters }`. La rama interna con coordenadas exactas (`obfuscated: false`) solo se alcanza para `audience=internal` y nunca se entrega en rutas `/g/*` — las invariantes están en `src/test/guide-map-service.test.ts` y `src/test/map-obfuscation.test.ts` (distancia mínima garantizada por el clamp `MIN_R_FRACTION`).
- **LocalEvent (rama 13B/13C)**: el modelo actual **no** tiene columna `visibility`. Se trata como implícitamente visible para huésped porque el sync solo lee proveedores públicos (Ticketmaster, Firecrawl de webs municipales). Si una rama futura introduce eventos privados, se DEBE añadir columna `visibility` + pasar los eventos por `isVisibleForAudience` antes de reutilizar `buildGuideLocalEventsData` o `buildGuideMapData` para hosts privados.

## 3. Secret policy

Secretos incluyen:

- códigos de acceso
- ubicaciones ocultas de llaves
- contraseñas internas
- tokens
- credenciales de smart locks
- **URLs presignadas de R2** (llevan credenciales S3 Sigv4 en el query string)

No deben:

- vivir en `KnowledgeItem`
- salir en mensajes por defecto
- entrar en previews públicas
- aparecer en logs o diffs sin sanitizar
- **incrustarse en HTML cacheado por CDN/ISR** — las URLs presignadas caducan en 1h mientras el HTML puede vivir días o semanas. Regla: toda media pública se referencia por la ruta estable `/g/:slug/media/:assetId-:hashPrefix/:variant` (ver `docs/FEATURES/MEDIA_ASSETS.md` §7). Invariantes en `src/test/guide-rendering-proxy-urls.test.ts` fallan si `composeGuide` emite `r2.cloudflarestorage.com` o `X-Amz-*` en `GuideTree`.

**Redaction de diffs en AuditLog (Rama 15D)**: `redactSecretsForAudit()` aplica antes de persistir. Patrones key-name redactados (case-insensitive): `access[_-]?code`, `access[_-]?token`, `password`, `secret`, `api[_-]?key`, `authorization`, `smart[_-]?lock[_-]?(code|key|credential)`, `key[_-]?location`, `hidden[_-]?key`, `^x-amz-`. Patrones value redactados: `r2.cloudflarestorage.com`, `[?&]X-Amz-`. Recursive con cap de profundidad 8 y `WeakSet` para ciclos. Pinneado por `src/test/auth/audit-redaction.test.ts` — añadir un nuevo tipo de secreto al modelo de datos requiere extender ambas listas + el test en la misma PR.

## 3.1 Guest-originated writes (rama 13D + 15D)

Rama 13D introduce el primer endpoint público con side-effects de escritura (`POST /api/g/:slug/incidents`). Regla dura: los writes originados por huésped nunca pueden producir filas con `visibility > internal`. Garantías por capa:

- **Visibility hardcoded**: `incident-from-guest.service.ts` setea `visibility='internal'` y `origin='guest_guide'` a mano — no hereda ni del request ni de defaults de Prisma. No existe un path de código donde guest pueda elegir visibility.
- **Field whitelist al leer**: `GET /api/g/:slug/incidents/:id` y la tracking page `/g/:slug/incidents/:id` proyectan solo `{ id, status, categoryKey, createdAt, resolvedAt }`. Los campos sensibles del incident (`summary`, `guestContactOptional`, `notes`, `reporterUserId`, `targetId`, `playbookId`) nunca se serializan en rutas `/g/*`. Whitelist centralizada en `src/lib/visibility.ts` con test anti-leak.
- **Rate limit**: sliding-window 3 req/60s por `(slug + IP)` en el POST, bucket LRU 256 slugs. Key incluye slug para que un atacante no pueda drenar quota cross-property. El helper compartido `sliding-window-rate-limit.ts` es el mismo de `guide-search` y `places-search` — un solo contrato de limiter para todo write/read público.
- **Cross-property IDOR defense**: la tracking page + el GET API scope-an la lectura por `propertyId` derivado del slug (no del client); el envelope HMAC además fija `slug` en el payload firmado (`obj.slug !== slug` rechaza en `verifyPublicCapability`). Una cookie de slug A nunca autoriza lectura en slug B.
- **Host side cross-property defense**: `changeIncidentStatusAction` requiere `propertyId` en el form y scope-a read+write por composite `{id, propertyId, property: { workspaceId: operator.workspaceId }}` (`findFirst` + `updateMany`). Un `incidentId` tampered que pertenezca a otra propiedad o workspace colapsa a "not found" — nunca impacta la row.
- **Cookie de autorización (Rama 15C)**: `gc-incident_read-<slug>` emitida por `setPublicCapabilityCookie` y leída por `readPublicCapabilityFromCookie`. Ver §0.5 para el contrato general. La cookie solo AÑADE autoridad de lectura, nunca 403 — drop-silent en cualquier fallo de verify.
- **AuditLog para guest writes (Rama 15D)**: `createIncidentFromGuest` emite `writeAudit({propertyId, actor:"guest:<slug>", entityType:"Incident", entityId, action:"create", diff:{origin, categoryKey, severity, targetType}})`. El slug es el único handle estable para un huésped no autenticado — se threadea desde la API route, no se mira en DB para mantener el servicio puro.
- **EmailProvider stub**: la notificación al host es fire-and-forget. Errores del provider se swallow-ean (log, nunca degradan la response del guest). Provider real (Resend/Postmark) queda para una rama futura.

## 4. Audit model

Schema (rama 15D — `prisma/schema.prisma::AuditLog`):

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `String` | cuid |
| `propertyId` | `String?` | nullable para audits globales (`session.start`, `session.end`); FK CASCADE cuando hay scope |
| `actor` | `String` | shape obligatorio: `user:<id>` \| `guest:<slug>` \| `system:<job>` (ver `formatActor`) |
| `entityType` | `String` | nombre del modelo (`Incident`, `GuideVersion`, `Property`, `Session`, `Membership`, …) |
| `entityId` | `String` | id de la fila afectada |
| `action` | `String` | whitelist en `AUDIT_ACTIONS`: `create`, `update`, `delete`, `publish`, `unpublish`, `rollback`, `session.start`, `session.end`, `import.apply` |
| `diffJson` | `Json?` | ya redactado por `redactSecretsForAudit` antes de persistir |
| `createdAt` | `DateTime` | `@default(now())` |

**Garantías**:

- **Append-only**: nunca se hace `update` ni `delete` sobre filas. Retention por borrado masivo programado (debt §6).
- **Fail-soft**: errores del writer se logean (`console.error`) y NO propagan a la response. Una caída de la DB de audit nunca degrada un mutation success.
- **Diff redaction**: pasa por `redactSecretsForAudit` (ver §3) — keys con patrones secretos → `[REDACTED]`, valores con presigned R2 / X-Amz → `[REDACTED]`.
- **Action whitelist**: `assertAuditAction()` throwa en runtime si el caller pasa una acción no registrada — fail-soft también atrapa este throw, así que un caller mal codificado pierde el audit pero no rompe la UX.

**Cuándo se llama `writeAudit`** (lista mantenida por `audit-mutation-coverage.test.ts`):

- `publishGuideVersionAction` / `unpublishVersionAction` / `rollbackToVersionAction` (`GuideVersion` publish/unpublish/rollback)
- `createIncidentAction` / `updateIncidentAction` / `deleteIncidentAction` / `changeIncidentStatusAction` / `resolveIncidentAction`
- `createIncidentFromGuest` (`actor: guest:<slug>`)
- `GET /api/auth/google/callback` (`session.start`)
- `POST /api/auth/logout` (`session.end`, solo si la cookie verifica)
- `applyImportDiff` en `src/lib/imports/shared/import-applier.service.ts` (`import.apply`, ramas 15E). Audita success **y** failed (con `failed:true` en el `diff`); el caso `noop` (replay idempotente) NO escribe row — solo `console.info`. Cada row lleva `payloadFingerprint` (SHA-256 truncado a 16 hex sobre `(platform, payload, resolutions)` en JSON canónico) que es la clave de idempotencia: una segunda llamada con misma tripleta encuentra la row pre-existente y retorna `noop`. Filas con `failed:true` NO bloquean re-apply (el writer las excluye del pre-check).

Añadir un mutation entry point nuevo a esa lista requiere wirear `writeAudit()` y, si entra en otro archivo, extender `TARGETS` en `audit-mutation-coverage.test.ts`.

## 5. Review queue

La review queue es derivada y debe cubrir:

- stale content
- low confidence
- missing media
- missing publish requirements
- unresolved visibility issues

## 6. Deuda explícita post-15D

Items deliberadamente fuera del alcance de 15D para no inflar la rama. Cada uno tiene un trigger conocido — no se mueven a "diferido indefinido" sin re-discusión.

### 6.1 Retention policy del AuditLog

Hoy el `AuditLog` crece sin truncate. La tabla soporta `audit-mutation-coverage.test.ts` y debug forense de incidentes — no es buffer caliente. Plan cuando el tráfico lo amerite:

- Cron mensual `archive-audit-log` (`actor: system:audit-archive`) que mueve rows con `createdAt < now() - 365 days` a un blob storage frío (R2 bucket separado, JSON-lines particionado por `propertyId/YYYY-MM`) y luego `DELETE`.
- Hot read window queda en 365 d; queries históricas pasan por una UI de exporte (§6.2) que pueda leer del archivo frío.
- Nunca update-in-place — append-only es contractual.

Trigger: el momento en que `pg_total_relation_size('"AuditLog"')` cruce ~1 GB en prod, o el primer pedido legal de retención justifique el cron. No antes.

### 6.2 Audit reads / queries del operator

`writeAudit()` está vivo, pero no hay UI ni API para leer. El endpoint declarado en `API_ROUTES.md §2 Ops and audit` (`GET /api/properties/:propertyId/audit-log`) NO está implementado todavía. Plan:

- `GET /api/properties/[propertyId]/audit-log?entityType=&entityId=&actor=&since=&until=&cursor=` con `withOperatorGuards({ rateLimit: "read" })` — filtros indexados, pagination cursor por `(createdAt, id)`.
- UI bajo `/properties/[propertyId]/audit` (timeline read-only por entidad). Diff renderer reutiliza el redactado guardado — nunca re-resuelve secretos.
- Export CSV: en el mismo endpoint con `?format=csv`.

Bloqueado por: nadie pidió la UI todavía. La capa de persistencia ya respeta las invariantes (redaction, append-only) — la UI puede llegar en una rama posterior sin tocar el writer.

### 6.3 Audit en cron jobs internos

Los jobs internos (`embed-backfill`, `local-events-sync`, `messaging-cron`, `archive-audit-log` cuando exista) NO emiten audit rows hoy. Cuando se ejecuten en prod con cadencia regular, deben llamar `writeAudit({propertyId, actor: formatActor({type:"system", job:"<name>"}), entityType, entityId, action, diff?})` en cada side-effect persistido.

Patrón canónico:

- `actor` siempre `system:<job-slug>` (`formatActor({type:"system", job})`); el job-slug debe matchear el regex `^[a-z][A-Za-z0-9_-]*$` (pinneado por `audit-actor-format.test.ts`).
- `propertyId` cuando el job opera scoped a una propiedad; `null` para barridos globales (`session.start/end` ya usa este path).
- Acciones nuevas para jobs (e.g. `chunk.embed`, `event.sync`) requieren entry en `AUDIT_ACTIONS` + el guard `assertAuditAction()` ya throwa en runtime sobre cualquier string desconocido.

Trigger: el primer job que se programe en `vercel.json` (o equivalente) con cadencia >= diaria en prod. Hoy `embed-backfill` corre manual y `local-events-sync` solo escribe `LocalEvent`, no audita.
