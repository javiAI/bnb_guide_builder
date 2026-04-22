# SECURITY_VISIBILITY_AND_AUDIT

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
