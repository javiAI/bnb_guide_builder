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
