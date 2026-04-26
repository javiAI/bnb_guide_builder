# SECURITY_VISIBILITY_AND_AUDIT

## 0. Auth & access control — estado actual y deuda abierta

Este documento cubre **visibilidad de datos** (qué campo puede salir a qué audiencia) y **audit log** (qué se registra de las mutaciones). Una tercera dimensión — **autenticación y autorización del actor que ejecuta la request** — no está resuelta en el repo todavía. Esta sección es explícita sobre qué hay y qué falta para que ninguna PR se presente como "protegida" sin que lo esté.

### 0.1 Qué existe hoy

- **Modelos Prisma declarados pero inactivos**: `User`, `Workspace`, `WorkspaceMembership`. Existen como tablas; ningún route handler ni Server Action los consulta para decidir acceso.
- **Patrón único de access control en rutas operator-facing**: `prisma.property.findUnique → 404 si no existe`. Aplica a las 7 rutas bajo `src/app/api/properties/[propertyId]/...` (`derived`, `guide`, `export/airbnb`, `assistant/{ask, debug/retrieve, conversations}`, `places-search`). No hay sesión, no hay identidad del actor, no hay membership check.
- **Guest flows con capability tipada (Rama 15C)**: el patrón ad-hoc de 13D (`guide-incidents-<slug>`) se generalizó a un primitivo tipado `signPublicCapability` / `verifyPublicCapability` parametrizado por `(capability, slug, payload)`. Cookie name `gc-<capability>-<slug>`, single shared secret `PUBLIC_CAPABILITY_SECRET` (≥16 chars en prod), envelope `{cap, slug, iat, payload, v}` con HMAC-SHA256 sobre el envelope ya codificado, `timingSafeEqual` constant-time, guard que rechaza `iat` >5 min en el futuro (la antigüedad se controla por TTL), drop-silent (null) en cualquier fallo. Catálogo activo y rationale en §0.5.
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

- ✅ **Rama 15C cerrada**: primitivo tipado en `src/lib/auth/public-capability.ts` + registro en `src/lib/auth/public-capability-registry.ts`. Catálogo, contrato y rationale en §0.5.
- ⏳ Pendiente: catálogo no-trivial (más de un consumer real), `AuditLog` integration al firmar/revocar, `revokePublicCapability` para invalidación on-demand sin esperar TTL, fingerprint en signed payload para detección de replay cross-device.

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

## 3.1 Guest-originated writes (rama 13D)

Rama 13D introduce el primer endpoint público con side-effects de escritura (`POST /api/g/:slug/incidents`). Regla dura: los writes originados por huésped nunca pueden producir filas con `visibility > internal`. Garantías por capa:

- **Visibility hardcoded**: `incident-from-guest.service.ts` setea `visibility='internal'` y `origin='guest_guide'` a mano — no hereda ni del request ni de defaults de Prisma. No existe un path de código donde guest pueda elegir visibility.
- **Field whitelist al leer**: `GET /api/g/:slug/incidents/:id` y la tracking page `/g/:slug/incidents/:id` proyectan solo `{ id, status, categoryKey, createdAt, resolvedAt }`. Los campos sensibles del incident (`summary`, `guestContactOptional`, `notes`, `reporterUserId`, `targetId`, `playbookId`) nunca se serializan en rutas `/g/*`. Whitelist centralizada en `src/lib/visibility.ts` con test anti-leak.
- **Rate limit**: sliding-window 3 req/60s por `(slug + IP)` en el POST, bucket LRU 256 slugs. Key incluye slug para que un atacante no pueda drenar quota cross-property. El helper compartido `sliding-window-rate-limit.ts` es el mismo de `guide-search` y `places-search` — un solo contrato de limiter para todo write/read público.
- **Cross-property IDOR defense**: la tracking page + el GET API scope-an la lectura por `propertyId` derivado del slug (no del client); el envelope HMAC además fija `slug` en el payload firmado (`obj.slug !== slug` rechaza en `verifyPublicCapability`). Una cookie de slug A nunca autoriza lectura en slug B.
- **Host side cross-property defense**: `changeIncidentStatusAction` requiere `propertyId` en el form y scope-a read+write por composite `{id, propertyId}` (`findFirst` + `updateMany`). Un `incidentId` tampered que pertenezca a otra propiedad colapsa a "not found" — nunca impacta la row.
- **Cookie de autorización (Rama 15C)**: `gc-incident_read-<slug>` emitida por `setPublicCapabilityCookie` y leída por `readPublicCapabilityFromCookie`. Ver §0.5 para el contrato general. La cookie solo AÑADE autoridad de lectura, nunca 403 — drop-silent en cualquier fallo de verify.
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
