# SECURITY_VISIBILITY_AND_AUDIT

## 0. Auth & access control — estado actual y deuda abierta

Este documento cubre **visibilidad de datos** (qué campo puede salir a qué audiencia) y **audit log** (qué se registra de las mutaciones). Una tercera dimensión — **autenticación y autorización del actor que ejecuta la request** — no está resuelta en el repo todavía. Esta sección es explícita sobre qué hay y qué falta para que ninguna PR se presente como "protegida" sin que lo esté.

### 0.1 Qué existe hoy

- **Modelos Prisma declarados pero inactivos**: `User`, `Workspace`, `WorkspaceMembership`. Existen como tablas; ningún route handler ni Server Action los consulta para decidir acceso.
- **Patrón único de access control en rutas operator-facing**: `prisma.property.findUnique → 404 si no existe`. Aplica a las 7 rutas bajo `src/app/api/properties/[propertyId]/...` (`derived`, `guide`, `export/airbnb`, `assistant/{ask, debug/retrieve, conversations}`, `places-search`). No hay sesión, no hay identidad del actor, no hay membership check.
- **Guest flows con capability ad-hoc**: la rama 13D introdujo HMAC cookie firmada (`guide-incidents-<slug>`, `GUEST_INCIDENT_COOKIE_SECRET`, payload `{slug, ids[≤10], iat}`, TTL 7d, `timingSafeEqual`, clock-skew guard ±5min). Es el **único** patrón de authorization activo en producción, y está scopeado a un caso de uso (incident tracking por huésped).
- **Lectura de guía pública**: gated por `publicSlug` + `GuideVersion.published ≥ 1`. Ver `docs/FEATURES/MEDIA_ASSETS.md` §7 y `src/app/g/[slug]/*`. Esto funciona como access control de lectura pero no extiende a write flows.

### 0.2 Qué falta, explícito

**Auth de operator/host** (autenticación tradicional con cuenta):

- Login / registro / verificación de email / password reset.
- Sesiones server-side (cookie + DB-backed o JWT firmado — decisión pendiente).
- Middleware Next.js que resuelva la sesión y popule `{userId, workspaceId, role}` en el request context.
- Guards reutilizables: `requireOperator()`, `requireOwnership(propertyId)`, `requireWorkspaceRole(role)`.
- Authorization por `WorkspaceMembership` — decidir qué significa "propietario de la propiedad X" en términos de workspace + rol.
- Test harness cross-user / cross-workspace como gate bloqueante en CI.

**Capabilities para guest flows** (no es login — es autorización de acciones firmadas):

- Generalización del HMAC de 13D a un servicio común `guest-capability.service.ts` con registro de capacidades tipado.
- Catálogo de capacidades (inicial: `incident_report`, `incident_read`; candidatos: `guide_feedback`, `booking_extension_request`).
- Revocación on-demand por slug y por expiración (default 7d como 13D).
- Aislamiento cross-slug y cross-capability (cookie de `slugA` nunca autoriza en `slugB`; cookie con `incident_read` nunca autoriza `incident_write`).

**Hardening + audit real**:

- Integrar `AuditLog` (declarado en §4) con escritor real invocado desde los guards.
- Rate-limit por actor en endpoints operator-facing (hoy solo existe por slug/IP en endpoints públicos — ver `src/lib/services/sliding-window-rate-limit.ts`).
- Invariantes cross-workspace / cross-capability como test bloqueante en `.github/workflows/ci.yml`.

### 0.3 Por qué no se resuelve endpoint-by-endpoint

Tentación recurrente durante code review: "añade un guard de auth a esta ruta específica". Si el patrón no existe transversalmente:

- Cada PR inventa su propio mini-modelo de auth. Inconsistencia garantizada.
- Env-tokens temporales o guards ad-hoc quedan como deuda silenciosa que nadie mapea después.
- La superficie a proteger crece con cada feature — mientras tanto las features ya en producción (13D incident panel, export 14B, messaging review 12B) siguen sin guard.

La solución es **una sola iniciativa transversal** que cierre los tres frentes (operator auth, guest capabilities, hardening) y un gate automático que impida regresión. Ese es el objetivo de la **Fase 16** del `docs/MASTER_PLAN_V2.md`.

### 0.4 Regla dura mientras Fase 16 no arranque

Ninguna PR puede declarar su endpoint operator-facing "seguro" o "protegido" en su description, docs o mensajes de commit. Las features nuevas que toquen endpoints operator-facing documentan que **siguen el status quo del repo** (`findUnique → 404`) y que la auth/authorization real está pendiente de Fase 16. Ejemplo: `docs/FEATURES/PLATFORM_INTEGRATIONS.md` §9.

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

## 3.1 Guest-originated writes (rama 13D)

Rama 13D introduce el primer endpoint público con side-effects de escritura (`POST /api/g/:slug/incidents`). Regla dura: los writes originados por huésped nunca pueden producir filas con `visibility > internal`. Garantías por capa:

- **Visibility hardcoded**: `incident-from-guest.service.ts` setea `visibility='internal'` y `origin='guest_guide'` a mano — no hereda ni del request ni de defaults de Prisma. No existe un path de código donde guest pueda elegir visibility.
- **Field whitelist al leer**: `GET /api/g/:slug/incidents/:id` y la tracking page `/g/:slug/incidents/:id` proyectan solo `{ id, status, categoryKey, createdAt, resolvedAt }`. Los campos sensibles del incident (`summary`, `guestContactOptional`, `notes`, `reporterUserId`, `targetId`, `playbookId`) nunca se serializan en rutas `/g/*`. Whitelist centralizada en `src/lib/visibility.ts` con test anti-leak.
- **Rate limit**: sliding-window 3 req/60s por `(slug + IP)` en el POST, bucket LRU 256 slugs. Key incluye slug para que un atacante no pueda drenar quota cross-property. El helper compartido `sliding-window-rate-limit.ts` es el mismo de `guide-search` y `places-search` — un solo contrato de limiter para todo write/read público.
- **Cross-property IDOR defense**: la tracking page + el GET API scope-an la lectura por `propertyId` derivado del slug (no del client); cookie HMAC además fija `slug` en el payload firmado (`expectedSlug` check en `parseGuestIncidentCookieValue`). Una cookie de slug A nunca autoriza lectura en slug B.
- **Host side cross-property defense**: `changeIncidentStatusAction` requiere `propertyId` en el form y scope-a read+write por composite `{id, propertyId}` (`findFirst` + `updateMany`). Un `incidentId` tampered que pertenezca a otra propiedad colapsa a "not found" — nunca impacta la row.
- **Cookie de autorización**: `guide-incidents-<slug>` (RFC 6265 token-safe, una cookie por slug, path `/` por prefix matching de `/g/:slug/*` y `/api/g/:slug/*`), HMAC-SHA256 sobre payload base64url `{slug, ids[≤10], iat}` con `GUEST_INCIDENT_COOKIE_SECRET` (≥16 chars, fail-fast en prod si falta). `timingSafeEqual` constant-time. TTL 7d. Clock skew guard ±5min. On tamper/expiry se DROP silenciosamente — la cookie solo AÑADE autoridad de lectura, nunca 403.
- **No audit log expansion**: 13D NO persiste AuditLog por cada incident creado por guest (decisión Fase -1). La tabla `Incident` misma (con `origin='guest_guide'` + `createdAt`) es el registro primario. Si en el futuro se necesita diff de cambios de status del host, el pattern de `AuditLog` ya existe (§4).
- **EmailProvider stub**: la notificación al host es fire-and-forget. Errores del provider se swallow-ean (log, nunca degradan la response del guest). Provider real (Resend/Postmark) queda para una rama futura.

## 4. Audit model

`AuditLog` debe registrar:

- actor
- entidad
- acción
- diff seguro
- fecha

## 5. Review queue

La review queue es derivada y debe cubrir:

- stale content
- low confidence
- missing media
- missing publish requirements
- unresolved visibility issues
