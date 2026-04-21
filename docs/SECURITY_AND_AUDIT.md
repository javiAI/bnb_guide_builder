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
