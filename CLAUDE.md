# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Implementa exactamente el paquete `version_3`.

## Architecture

Next.js 15 App Router + Prisma + PostgreSQL + Tailwind CSS.

- `src/app/` — pages and API routes (App Router, server components by default)
- `src/app/api/` — REST endpoints (assistant-conversations, geo, properties)
- `src/lib/actions/` — server actions grouped by domain (editor, wizard, guide, incident, messaging, ops, knowledge)
- `src/lib/services/` — business logic (completeness scoring, guide rendering/diff, space availability, property derivation)
- `src/lib/repositories/` — data access layer
- `src/config/` — config-driven system: schemas (wizard-steps, section-editors, field-dependencies) + registries (icons, renderers, media)
- `src/lib/types/` — shared TypeScript types
- `src/components/` — React components (layout, overview, ui, wizard)
- `taxonomies/` — 30 JSON files defining all domain catalogs (amenities, spaces, systems, policies, etc.)
- `src/lib/taxonomy-loader.ts` — runtime loader for taxonomy JSON files
- `src/lib/conditional-engine/` — rule engine for dynamic field visibility
- `prisma/schema.prisma` — data model (~30KB, canonical source of truth)
- `src/test/` — 53 test files, Vitest + jsdom

Config-driven pattern: taxonomy JSON → loader → config registry → UI renderer. Adding a new amenity/policy/space type = edit JSON + possibly registry, never touch React components.

## Build & Test Commands

```bash
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (run prisma generate first!)
npm run test         # Vitest (all tests)
npm run test:watch   # Vitest watch mode
vitest run src/test/config-driven.test.ts  # Single test file
```

## Orden de lectura

1. `README.md`
2. `AGENTS.md`
3. `docs/README.md` (índice)
4. `docs/ARCHITECTURE_OVERVIEW.md`
5. `docs/DATA_MODEL.md`
6. `docs/CONFIG_DRIVEN_SYSTEM.md`
7. `docs/API_ROUTES.md`
8. `docs/SECURITY_AND_AUDIT.md`
9. `docs/QA_AND_RELEASE.md`
10. `docs/HANDOFF.md` (quickref al arrancar una sesión, antes de ejecutar una rama) + `docs/ROADMAP.md` + `docs/MASTER_PLAN_V2.md` (fase activa)
11. `docs/FEATURES/*.md` (según la fase)
12. `taxonomies/*.json`
13. skill de la fase activa
14. prompt de la fase activa

## Reglas

- no improvisar producto fuera de la spec
- elegir siempre el criterio reconciliado de `version_3`
- labels visibles: español
- IDs, código, nombres internos y enums: inglés
- sistema métrico
- secretos segregados y auditados
- no mezclar guest, AI, internal y sensitive
- no saltar de fase sin validación explícita
- arquitectura config-driven: taxonomías, campos, dependencias, media y renderizado viven en configuración centralizada (`src/config/` y `taxonomies/`), no hardcodeados en componentes React
- añadir amenity, policy, access method o sección = editar config/taxonomía, no tocar UI
- **Liora Design Replatform lista para arrancar (Fase 16)**: paquete entregado en `design-system/` (kebab, trackeado en Git). Plan en 7 ramas 16A–16G con dependencias internas; ver sección "Replatform de diseño (Liora)" abajo y `docs/ARCHITECTURE_OVERVIEW.md` §14 para las reglas anti-legacy con consecuencias. Mientras Fase 16 no arranque, en toda rama funcional prioriza estructura, accesibilidad, comportamiento y reutilización sobre fidelidad visual.

## Replatform de diseño (Liora) — reglas duras

Hay una replatform visual integral planificada (`docs/MASTER_PLAN_V2.md` § FASE 16) en 7 ramas secuenciales 16A–16G. El paquete de diseño vive en `design-system/` (kebab-case, trackeado en Git): `design-system/foundations/` (tokens en 3 capas + `base.css` + `themes.css` + `tailwind.tokens.ts` + `shadcn.css`) es la única fuente de paleta; `design-system/references/liora-ui-kits/` contiene los HTML kits operator/messaging/guest como referencia visual de layout (no de paleta — el azul-gris frío de los kits no se adopta como brand). Validado en CI por `npm run validate:design-system`. Decisiones permanentes (path canónico, dark mode global vía `html[data-theme]`, brand themes guest permanentes, shadcn no wholesale, command palette fuera de scope, etc.) en `docs/MASTER_PLAN_V2.md` § FASE 16. Hasta que arranque rama 16A:

- **Prioriza** arquitectura, comportamiento, a11y y reuse de primitivos existentes sobre fidelidad visual o consistencia estética.
- **No consolides** paleta, microcopy ni iconografía como definitivos en ramas funcionales en vuelo (hoy: 13C `feat/guide-maps-embedded`, items futuros de `FUTURE.md`). Los tokens actuales de `src/app/globals.css` y los mock-ups de `docs/FEATURES/GUEST_GUIDE_UX.md` son MVP operativo — referenciables pero no ground-truth congelado.
- **No introduzcas** duplicados por versión: prohibido `*V2`, `*V3`, `New*`, `Next*`, `Better*`, `*Alt`, `*Redesign`, `*Old`, `legacy-*`. Si hay que cambiar la API de un componente, se cambia en su sitio.
- **No abras** convivencias legacy sin plan de retirada documentado en la PR description (motivo, plan, rama/commit que borra, fecha tope).
- **Axe-core `serious|critical = 0`** y targets ≥44×44 son invariantes permanentes — Liora no puede degradarlos.
- Los docs `docs/LIORA_*.md` (`LIORA_DESIGN_ADOPTION_PLAN.md`, `LIORA_COMPONENT_MAPPING.md`, `LIORA_SURFACE_ROLLOUT_PLAN.md`) **no existen todavía** — se crean en 16A/B/C. Lista canónica + descripciones en `docs/MASTER_PLAN_V2.md` § FASE 16.

Antes de arrancar cualquier rama Liora, leer `design-system/docs/DESIGN_MIGRATION.md` (legacy → semantic mapping + per-branch gates).

Reglas completas y consecuencias operacionales: `docs/ARCHITECTURE_OVERVIEW.md` §14.

## Protocolo de Acción:

- Analizar: Lee la solicitud y desglosa los requisitos.
- Evaluar certeza: ¿Entiendo el 90% o más de lo que se debe hacer?
- Si es < 90%: Plantea preguntas sobre las partes ambiguas. NO IMPLEMENTES.
- Si es >= 90%: Procede con la implementación.


## Flujo de ramas (MASTER_PLAN_V2)

- **OBLIGATORIO — Kickoff de rama (context handoff)**: ANTES de ejecutar cualquier comando de la nueva rama (incluida la lectura de `MASTER_PLAN_V2.md`), el asistente DEBE emitir un bloque titulado `Kickoff de rama <id>` con exactamente tres apartados:
  1. **Context management**: una de `/clear` | `/compact <argumentos concretos>` | `ninguna acción` — justificando la elección en una línea (p. ej. "compactar para preservar decisiones de Fase -1 de 10C" vs "clear porque la rama anterior no deja contexto útil").
  2. **Prompt inicial**: el texto literal que el usuario debe pegar al iniciar la nueva sesión, listo para copiar (sin placeholders, con el id de rama y el camino al § de `MASTER_PLAN_V2.md`).
  3. **Checklist pre-kickoff**: estado de PR anterior (mergeada/cerrada), ramas locales a borrar, pulls pendientes sobre `main`.
  Este bloque NUNCA se omite, aunque el usuario pida "empieza ya" — se emite primero y se espera confirmación.
- **Antes de crear cualquier rama del plan** (8A en adelante), leer `docs/MASTER_PLAN_V2.md` § correspondiente **entera** y ejecutar su **Fase -1 — Revisión pre-rama** (§2.1): resumen técnico + resumen conceptual + ambigüedades + alternativas, iterar hasta aprobación explícita del usuario. No crear rama sin ese gate.
- **OBLIGATORIO — Llenar el cuerpo del § Rama tras aprobación de Fase -1**: si el § está vacío o como placeholder (`[<…> rama content...]`), el hook `pre-branch-gate.sh` lo bloquea y **inyecta automáticamente la plantilla canónica** (definida en MASTER_PLAN_V2.md §2.1 paso 8). Claude rellena la plantilla con el contenido aprobado en Fase -1 (propósito, archivos, tests, criterio de done, restricciones, no-alcance) **commiteando el cambio en la propia rama** que está por crearse. La spec vive en el plan desde día cero — no se rellena post-merge. Si el § ya tenía contenido sustantivo, el hook no inyecta; Claude solo lo actualiza si Fase -1 cambió el alcance.
- Seguir el resto del protocolo §2 (Fase 0 → Fase 6) sin saltos.
- **OBLIGATORIO — Gate antes de crear la PR**: ejecutar `/simplify` sobre TODOS los cambios de la rama (no solo el último commit) y aplicar las correcciones antes de abrir la PR con `gh pr create`. El asistente NUNCA crea la PR sin haber corrido `/simplify` en esa misma sesión. Si ya se corrió antes de commits posteriores, se vuelve a correr. Commits de ajuste tras `/simplify` son válidos, pero la última acción antes de `gh pr create` siempre es verificar que `/simplify` cubrió los cambios finales.
- **Al terminar la rama**: actualizar los docs listados en "Docs a actualizar al terminar" de la rama. **No crear docs nuevos** si cabe en uno existente. Marcar la rama en `docs/ROADMAP.md`.
- Cambios al plan descubiertos en ejecución: PR aparte `chore/plan-update-<tema>` (ver §2.9), nunca editar `MASTER_PLAN_V2.md` silenciosamente.

## Skills y herramientas activas

- `/pre-commit-review` — hook recuerda antes de cada commit (Fase 3)
- `/review-pr-comments` — triage por valor/esfuerzo de comentarios de PR (Fase 5)
- `/simplify` — tras volumen significativo de código, antes de abrir PR (Fase 4)
- `/revise-claude-md` — post-merge si la rama introduce patrones reutilizables (Fase 6)
- `/feature-dev`, `/playwright-cli`, `/excalidraw-diagram`, `/firecrawl-search` — opcionales según rama (ver Preparación)
- Context7 (MCP) — auto, verifica APIs de librerías durante implementación
- Agents `Explore`, `Plan`, `code-explorer`, `code-architect` — según complejidad de la rama

## Entorno y comandos

- `npx` falla en sandbox de tools — usar siempre `/Users/javierabrilibanez/.nvm/versions/node/v18.20.5/bin/npx`
- Antes de `tsc --noEmit`, ejecutar siempre `prisma generate` — los errores del IDE en modelos/campos Prisma indican caché del servidor TS desactualizada; `generate` regenera `.prisma/client` y `@prisma/client`, resolviendo la discrepancia
- `tsc --noEmit` es la fuente de verdad para TypeScript; los diagnósticos del IDE pueden ser falsos (tipos de Prisma resuelven desde `.prisma/client`, no `@prisma/client`)
- Tras `prisma db push` + `generate`, reiniciar el servidor de desarrollo — el singleton `globalThis.prisma` cachea el cliente antiguo y da `Unknown argument` en runtime aunque la columna exista en la DB
- Verificar columnas reales: `psql "postgresql://javierabrilibanez@localhost:5432/guide_builder" -c "\d nombre_tabla"`
- `git push` a veces falla en silencio (proxy rtk); verificar siempre con `git ls-remote origin <branch>` antes de abrir PR
- `next dev` salta a 3001/3002/3003 si 3000 está ocupado — `lsof -i -P | grep node` confirma el puerto real
- `main` no tiene upstream tracking → usar `git pull origin main` (no `git pull` a secas)
- Cambios de esquema en dev: `prisma db push --accept-data-loss`, no `migrate deploy` (el historial se re-aplica sucio contra una DB ya sincronizada)
- Media storage (Cloudflare R2): requiere `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` en `.env`. Ver `.env.example` para valores de referencia
- E2E harness (rama 10J): `npm run test:e2e` (build + start, canónico/CI) o `npm run test:e2e:dev` (next dev, iteración). Sirve en puerto 3100 (`reuseExistingServer` salvo en CI). Las fixtures se exponen vía `/g/e2e/[fixture]`, ruta gateada por `process.env.E2E === "1"` (404 fuera de E2E). Vitest excluye `e2e/` para no colisionar con specs de Playwright
- Service worker en dev (rama 10I): los browsers permiten SW en `http://localhost`/`127.0.0.1` (excepción a HTTPS-only). Para inspeccionar/desregistrar: Chrome `chrome://serviceworker-internals/` o DevTools → Application → Service Workers (botón Unregister + "Update on reload"). Si un cambio en el SW no se aplica, el route handler ya marca `Cache-Control: no-cache` — pero el SW antiguo puede seguir activo hasta cerrar todas las pestañas del scope (o `skipWaiting` + reload). En specs E2E que naveguen dos veces consecutivas a la misma URL bajo SW puede dar `net::ERR_FAILED` en la segunda navegación; preferir pre-seed de `localStorage` vía `addInitScript` y una sola navegación
- Assistant pipeline (rama 11C): la Postgres local requiere la extensión `vector` (pgvector). La migración `20260419180000_add_knowledge_embeddings_and_fts` ejecuta `CREATE EXTENSION IF NOT EXISTS vector` (idempotente) pero el rol debe tener permiso para crearla la primera vez. Verificar: `psql "postgresql://javierabrilibanez@localhost:5432/guide_builder" -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"`. La columna `embedding` se declara como `Unsupported("vector(512)")` en `schema.prisma` — el cliente Prisma no la expone; lecturas/escrituras vectoriales van por `$queryRaw`/`$executeRaw` en `src/lib/services/assistant/*`. La columna generada `bm25_tsv` y su índice GIN están declarados en `schema.prisma` como `bm25Tsv Unsupported("tsvector")` + `@@index([bm25Tsv], type: Gin)` para mantener paridad con la DB bajo `prisma migrate diff`, pero Prisma Client no los expone ni permite consultarlos — el acceso efectivo va por `$queryRaw`
- Env vars del assistant (rama 11C): `VOYAGE_API_KEY`, `COHERE_API_KEY`, `ANTHROPIC_API_KEY`, `ASSISTANT_LLM_MODEL` (default `claude-sonnet-4-6`, usado solo por el synthesizer — el intent resolver está pineado a Claude Haiku 4.5). En dev/test cada clave puede faltar y el pipeline degrada a mock determinístico (embeddings, por hash SHA-256 del texto), identity reranker y synthesizer stub. En `NODE_ENV=production` el pipeline hace fail-fast si falta cualquiera de las tres claves — nunca se permite un stub silencioso en prod
- Backfill de embeddings: `npm run embed:backfill` corre `src/lib/jobs/knowledge-embed-backfill.ts` (script idempotente, en batch). Marca `embedding = NULL` cuando cambia `contentHash` (invalidación automática al re-extraer). Scheduling en prod queda fuera de 11C — por ahora manual

## Patrones — Auth & audit (Rama 15A–15D)

- Toda ruta nueva bajo `src/app/api/properties/[propertyId]/...` se construye con `withOperatorGuards<P>(handler, { rateLimit: "read" | "mutate" | "expensive" })` (`src/lib/auth/operator-guards.ts`). El wrapper compone `requireOperator()` + `loadOwnedProperty()` + `applyOperatorRateLimit()` y entrega al handler `{ params, guarded: { property, operator } }`. Pinneado por `operator-route-coverage.test.ts` — rutas que no usan el wrapper deben anotar `// guards:manual <razón>`. Buckets: `read` 60 req/60s (GETs), `mutate` 20 req/60s (POST/PATCH/DELETE), `expensive` 10 req/60s (LLM/RAG/Places/exports/imports). Tabla canónica en `docs/API_ROUTES.md` §0.
- El wrapper NO escribe audit. `writeAudit({propertyId, actor, entityType, entityId, action, diff?})` se invoca **explícitamente** en cada call site de mutación tras el write exitoso — decisión Fase -1 de 15D para que el audit sea grep-able y no opaque la composición. `formatActor({type:"user"|"guest"|"system", ...})` enforza el shape `user:<id> | guest:<slug> | system:<job-slug>`. Lista canónica de call sites en `audit-mutation-coverage.test.ts` — añadir un mutation entry point nuevo requiere extender `TARGETS` allí + cablear `writeAudit` en el archivo. Acciones whitelisted en `AUDIT_ACTIONS` (`create`/`update`/`delete`/`publish`/`unpublish`/`rollback`/`session.start`/`session.end`); `assertAuditAction()` throwa runtime sobre acciones desconocidas (atrapado por el fail-soft del writer).
- `writeAudit` es **append-only y fail-soft**: errores de DB se logean (`console.error`) y no propagan a la response — un audit que falla nunca degrada la UX. Diffs pasan por `redactSecretsForAudit()` (recursivo, depth cap 8, `WeakSet` para ciclos): patrones de key (`access[_-]?code`, `password`, `secret`, `api[_-]?key`, `authorization`, `smart[_-]?lock[_-]?(code|key|credential)`, `key[_-]?location`, `^x-amz-`) → `[REDACTED]`; valores con `r2.cloudflarestorage.com` o `[?&]X-Amz-` también. Añadir un nuevo tipo de secreto al modelo de datos = extender ambas listas + `audit-redaction.test.ts` en la misma PR.
- Guest-originated writes en `/api/g/:slug/*` no usan `withOperatorGuards` (no hay operador) pero deben emitir audit con `actor: formatActor({type:"guest", slug})` — el slug se threadea desde la API route al servicio, nunca se mira en DB para mantener el servicio puro. Ver `incident-from-guest.service.ts` como template. Cron jobs internos cuando se programen en prod = `actor: formatActor({type:"system", job:"<slug>"})` con `job` matching `/^[a-z][A-Za-z0-9_-]*$/`. Hoy ningún job interno audita — debt registrado en `SECURITY_AND_AUDIT.md` §6.3.
- Server actions que mutan entidades del workspace **también** entran en este patrón: `requireOperator()` + ownership scope (`workspaceId: operator.workspaceId` inline en la query, o cross-check `property.workspaceId !== operator.workspaceId` post-load) + `writeAudit` tras el write. `cross-workspace-invariants.test.ts` exige ≥1 scope-guard por `requireOperator()` en `guide.actions.ts` e `incident.actions.ts`. No usar `findUnique({where: {id}})` seguido de write sin cross-check — un id tampered de otro workspace pasa al handler.
- `places-search` mantiene su limiter por-property de 13A (30/60s) **además** del per-actor `expensive` del wrapper — el wrapper aplica primero, el per-property capa cross-actor por debajo. Tests usan `__resetOperatorRateLimitForTests()` entre hits para aislar capas. El patrón "limiter en cascada" se replica solo cuando hay riesgo cross-actor real (bursts coordinados sobre la misma propiedad), no especulativamente.
- `propertyId` en `AuditLog` es **nullable** (migración `audit_log_property_optional`) para soportar audits globales sin propiedad: `session.start`/`session.end` en OAuth callback y logout. Cualquier audit que no tenga property scope pasa `propertyId: null` — no inventar un sentinel.

## Patrones de Sistemas

- Añadir sección al sidebar = editar también `icon-registry.ts` (SECTION_ICONS) y `renderer-registry.ts` — `config-driven.test.ts` lo verifica y falla si falta
- Nuevos modelos con clave de negocio compuesta: siempre `@@unique([...])`, no solo `@@index` — sin esto se permiten duplicados bajo concurrencia
- Prisma P2002 (unique violation) en `catch`: discriminar con `(err as { code?: string }).code === "P2002"` y re-throw el resto — no swallowear todo
- Server actions que reciben un ID de entidad: guard `if (!id) return { success: false, error: "..." }` + verificar ownership desde DB + derivar `propertyId` de DB para `revalidatePath` (no del cliente)
- Modo `inherited` en tablas de override = DELETE la fila (no upsert con mode="inherited") — mantiene la tabla limpia
- `defaultCoverageRule` en `system_taxonomy.json`: `property_only` → nunca en spaces; `selected_spaces` → solo con `override_yes`; `all_relevant_spaces` → default heredado
- `stripNulls` antes de serializar a JSON: filtrar claves con valor `null` o `""` para no persistir ni contar como "configurados" campos vacíos
- `FormEvent<HTMLFormElement>` (not `React.FormEvent`): importar `type FormEvent` de `"react"` en archivos que no importan el namespace React
- Antes de crear una server action nueva, grep por el nombre de cada export planeado para verificar que no existe ya un consumidor del módulo existente — este repo arrastró un archivo de 125 LOC sin consumidores durante tres branches
- Añadir un tipo de campo nuevo para subtypes (amenity/system) = 1 entrada en `src/config/registries/field-type-registry.ts` (`FIELD_TYPES` + `validate`) + 1 entrada en `field-type-renderers.tsx` (`RENDERERS`). El test `field-type-coverage.test.ts` falla si algún `type` en `amenity_subtypes.json` o `system_subtypes.json` no está registrado; `getFieldType()` lanza en boot para tipos desconocidos (no fallback silencioso a texto)
- Prisma `Json?` null semantics: `Prisma.JsonNull` (campo = JSON null), `Prisma.DbNull` (campo = SQL NULL), `Prisma.AnyNull` (cualquiera de los dos). Filtrar "tiene contenido": `where: { campo: { not: Prisma.AnyNull } }`
- Campos `Json?` grandes (e.g. `treeJson`): no incluir en queries de listado — fetch selectivo solo cuando se necesita el contenido
- Media pública nunca se sirve con URL presignada en HTML cacheado. Toda referencia a media desde `composeGuide()` / `GuideTree` usa la ruta estable `/g/:slug/media/:assetId-:hashPrefix/:variant` (Rama 10D). El ETag se escopa a la variante (`"{contentHash}-{variant}"`) — sin esto, un CDN que cacheó `full` sirve esos bytes para `thumb`. URLs presignadas solo en el dashboard interno (no cacheado). Baking del slug en las URLs ocurre en `publishGuideVersionAction`, no al renderizar la página pública (las URLs van a `treeJson` y se sirven desde la snapshot). Invariantes en `src/test/guide-rendering-proxy-urls.test.ts` fallan si aparecen `r2.cloudflarestorage.com` o `X-Amz-*` en el tree
- `composeGuide(propertyId, audience, publicSlug)`: `publicSlug` es **required** (no default). Callers sin slug publicado pasan `null` explícito — evita olvidarse de threadear el slug y emitir media sin ruta pública
- Media en `GuideTree` (Rama 10C): `GuideMedia` lleva `variants: { thumb, md, full }` — nunca `url` singular. Renderers inline consumen `variants.md` con `INLINE_MEDIA_CAP = 3` por item (markdown, HTML); galería completa con thumb/full queda para 10E. Fingerprints de diff usan `assetId`, no URL — evita invalidar diffs cuando cambia el slug. El ETag del media proxy depende de `contentHash + variant`, no de `assetId`. `loadEntityMedia` es una sola query `mediaAssignment.findMany` con `OR` por entityType y filtro `mimeType startsWith "image/"` — añadir un nuevo `entityType` al scope de guide = extender la ref list en `loadGuideContext` + `MediaEntityType` en `guide-media.service.ts`, no tocar el resolver
- `taxonomies/guide_sections.json` tiene flag `includesMedia: boolean` por sección. Secciones con `includesMedia:false` (rules, contacts, emergency, local) nunca contribuyen refs al batch loader — mantiene la query pequeña incluso en propiedades grandes. Flip a `true` solo cuando la sección tenga entidad propia con assignments y el resolver la propague (ej: local places en rama 13D)

## Patrones — Assistant pipeline (audience-aware RAG)

- Pipeline canónico (rama 11C): `intent → hybridRetrieve (BM25 + vector, RRF k=60) → rerank (Cohere multilingual) → floor 0.3 → synthesize (Sonnet 4.6) → persist`. Orquestado desde `src/lib/services/assistant/pipeline.ts` (`ask()` y `retrieve()`). Nunca encadenar manualmente los sub-servicios fuera del pipeline — la composición vive ahí.
- Visibility invariant — DURO: `allowedVisibilitiesFor(audience)` NUNCA retorna `sensitive`. `guest < ai < internal < sensitive` con cap en `internal` para todos. El test `assistant-retriever-internals.test.ts` lo pinea. Si necesitas surfacing interno ad-hoc, NO lo añadas por ese helper — el problema está en el caller.
- Hard filters pushdown a SQL: `propertyId`, `locale`, `visibility::text = ANY($allowed)`, `valid_from/valid_to`, `journey_stage` condicional. Si una pregunta necesita un filtro nuevo, añádelo al `WHERE` de `runBm25` + `runVector` simultáneamente (los dos canales deben ver el mismo scope) + a la cláusula de `scopeCounts` — si no, degraded-mode decisión miente. Los tres llaman a `journeyStageScopeClause()` como patrón de composición condicional con `Prisma.sql\`...\`` + `Prisma.empty`.
- RRF fusion: canal único → items ranked por `1/(RRF_K + rank + 1)`; cuando un item aparece en ambos canales, se suman las contribuciones. Preservamos `bm25Score` + `vectorScore` originales por item para debug, pero el orden final es por `rrfScore`. No reescalar scores per canal — la fusión pierde sentido.
- Injection hardening del synthesizer: wrapping `<source id="N" entityType topic>` por cada fuente + `<user_question>`. `sanitizeSourceText` flatten de `system:/user:/assistant:` headers + `ignore (all|previous) ...` hasta boundary de frase, strip de role-tags, backticks triples → dobles, whitespace collapse. Cambios en el wrapping/sanitizer sin actualizar `assistant-synthesizer-parsing.test.ts` rompen invariantes.
- Mandatory citation + ESCALATE: el parser `parseModelOutput()` escala si (a) la respuesta empieza por `ESCALATE:` o (b) no contiene `[N]` refs válidos. `Citation = { knowledgeItemId, sourceType, entityLabel, score }` — NO `sourceId/quoteOrNote/relevanceScore`. `citationsJson` en `AssistantMessage` guarda un envelope `{ citations, escalationReason }` — no hay columna dedicada; si necesitas extraer la razón, parsea el JSON.
- Embedding lifecycle: Voyage `voyage-3-lite` (512d, L2-norm). Reads via `$queryRaw` con cast `::vector`; writes via `$executeRaw` de `UPDATE ... SET "embedding" = ${lit}::vector`. Prisma client no conoce la columna (`Unsupported("vector(512)")`) ni la columna generated `bm25_tsv`. Añadir filtros sobre `embedding`/`bm25_tsv` = editar el raw SQL, no `prisma.knowledgeItem.findMany(...)`.
- Invalidación incremental de chunks: `upsertChunksIncremental(scopeWhere, chunks)` clasifica por `(entityType|entityId|templateKey)` dentro de scope `{propertyId, locale, isAutoExtracted: true}`. Cuando `contentHash` cambia → NULL `embedding + embedding_model` (el backfill job los re-embeda); cuando no cambia → embedding se preserva (ahorro de API + estabilidad semántica). NO usar `deleteMany + createMany` en el scope autoextract — destruye embeddings y dispara re-embed en cascada.
- Resolvers (`resolveEmbeddingProvider`, `resolveReranker`, `resolveSynthesizer`, `resolveIntentResolver`) cachean por fingerprint. Cada uno tiene `__set*ForTests(s | null)` que marca fingerprint `"__test__"`; los resolvers hacen short-circuit en ese valor ANTES de computar el fingerprint real. Si añades un nuevo resolver con caché, replica ese patrón — un fingerprint mismatch en tests barre el stub con la impl real y produce fallos oscuros.
- Prod fail-fast, dev degrade: `NODE_ENV === "production"` + falta de `VOYAGE_API_KEY`/`COHERE_API_KEY`/`ANTHROPIC_API_KEY` = throw. En dev/test, el pipeline cae a mock determinístico por hash (embeddings), identity reranker (scales rrfScore a [0,1]), stub synthesizer (eco de bodyMd truncado con `[N]`) y heuristic intent resolver. Añadir un nuevo provider externo = replicar esos tres paths + test de prod-guard.
- Escalation (rama 11D): el pipeline solo resuelve contacto cuando `synthesized.escalated === true` — nunca threshold-based de citations o confidence. Flujo: `resolveEscalationIntent(question, lang)` (heurística pura, sin LLM) → `resolveEscalation({propertyId, intentId, audience})` → `EscalationResolution { intentId, intentLabel, emergencyPriority, fallbackLevel, contacts[] }`. Cascada de 3 tiers: `intent` (hay contacto con `contact_type.json` match) → `intent_with_host` (sin específico, deriva al general_host) → `fallback`. `taxonomies/escalation_rules.json` es source of truth (loader Zod en boot). Persistencia en `AssistantMessage.citationsJson` envelope (añade `escalationContact`), sin migración. Happy path no toca `prisma.contact.findMany` — guard por `synthesized.escalated`.
- Escalation intent heuristic: `resolveEscalationIntent` matchea por keywords en ES/EN (accent-strip NFD, longest-match tiebreak, emergencia > no-emergencia). Precision gate en `assistant-escalation-intent-precision.test.ts` (≥0.95 por intent crítico + 100% recall). Añadir un intent nuevo = (1) entry en `escalation_rules.json` con `keywords.{es,en}[]`, (2) labelled rows en `src/test/fixtures/escalation-intent-corpus.ts`, (3) tests verdes. Classifier LLM (Haiku) queda diferido a 11E — la heurística es suficiente mientras los 4 intents críticos pasen el gate.
- Escalation visibility: `resolveEscalation` filtra contacts por `visibility` según audience (defense-in-depth aunque el retriever ya clampa). Channel projection: `tel → href tel:+`, `whatsapp → wa.me/` (con fallback a phone si no hay whatsapp number), `email → mailto:`. Orden `Prisma.orderBy`: `[{emergencyAvailable:"desc"},{isPrimary:"desc"},{sortOrder:"asc"},{createdAt:"asc"}]`. UI consumer: `<EscalationHandoff handoff={...} />` en `AssistantChat` (operator-only en 11D; widget huésped en 11F).

## Patrones — Guía pública (audience=guest)

**Regla dura: `audience=guest` nunca ve el modelo interno.** Enums, JSON, claves de taxonomía (`rm.*`, `ct.*`, `am.*`), copy editorial del host ("Añade...", "Completa..."), labels internos ("Slot", "Propiedad", "Config JSON") son **bugs** si llegan al huésped.

- Pipeline canónico: `composeGuide → filterByAudience → normalizeGuideForPresentation → render`. El normalizador es terminal, puro e idempotente. El renderer consume `displayValue` / `displayFields`, **nunca** `value` / `fields` raw. `src/lib/renderers/_guide-display.ts` tiene un fallback defensivo a `value`/`fields` **solo** para trees pre-v3 legacy — en guest el normalizador es obligatorio upstream.
- Humanización = presenter registry (`src/config/registries/presenter-registry.ts`). Resolución: exact `taxonomyKey` → longest-prefix match → `FALLBACK_ALLOWED_PREFIXES` (`sp.`, `am.`, `lp.` → `genericTextPresenter`, el resolver ya humaniza upstream) → `rawSentinelPresenter` (emite `presentationType: "raw"` + warning `missing-presenter`). Añadir soporte al huésped para una nueva clave = (1) `guestLabel`/`guestDescription`/`icon` en la taxonomía, (2) presenter registrado por clave o prefijo **o** prefijo añadido al allowlist, (3) `presenter-coverage.test.ts` verde. Nunca permitir que una clave nueva caiga al sentinel en producción — el sentinel es para atrapar olvidos en CI, no para ocultar datos silenciosamente.
- Empty states: nunca se muestra `section.emptyCopy` al huésped; usar `emptyCopyGuest` (neutro, no imperativo) o `hideWhenEmptyForGuest: true`. Si no hay dato, la tendencia es ocultar antes que explicar que falta. Sección sin items + sin `emptyCopyGuest` + sin `hideWhenEmptyForGuest` → se oculta silenciosamente y se emite `guest-section-missing-empty-copy` (hide-silent por defecto, el log es la señal para completar taxonomía). `GuideRenderer` computa `filterRenderableItems` **una sola vez** y pasa `renderable` como prop a cada sección — no re-filtrar en el SectionCard.
- `GuideItem` en audience guest lleva `presentationType`, `displayValue`, `displayFields`, `presentationWarnings`. El renderer que consuma `value` o `fields` directamente está mal — el normalizador es la única fuente de verdad de presentación. `GuideItem.tsx` retorna `null` si `presentationType === "raw"` como defense-in-depth; el filtrado upstream ya los excluye para guests. `rawSentinelPresenter` preserva `value`/`fields` para audiencias no-guest (operator debugging) — solo el huésped ve el shape vacío.
- Observabilidad: `normalizeGuideForPresentation` agrega todos los drops/warnings a través de un `WarningAggregator` y emite **un único** `console.warn` al final por invocación, con metadata `{ byTaxonomyKey, byCategory }` (categorías: `missing-presenter`, `raw-json`, `taxonomy-key`, `internal-label`, `other`). Un dedupe `Set<string>` en `filterRenderableItems` evita warnings repetidos por item en un render. No loggear por item — rompe el agregado.
- Deny-list de labels internos: `INTERNAL_FIELD_LABEL_DENYLIST` se exporta desde `src/lib/services/guide-presentation.service.ts` como `ReadonlySet<string>` (`"Slot"`, `"Config JSON"`, `"Raw"`, `"Propiedad"`). El normalizador aplica `sanitizeGuestFields` como red defensiva (filtra campos con label denylisted, raw-JSON, o cuyo value matchea `TAXONOMY_KEY_PATTERN`). Tests anti-leak importan el set directamente — no redefinir.
- `GUIDE_TREE_SCHEMA_VERSION = 3`. Snapshots pre-v3 en `GuideVersion.treeJson` se re-normalizan al servir en `/g/[slug]/page.tsx` con un log `snapshotPreV3` (una vez por request). No se hace backfill masivo.
- Invariantes enforced por `src/test/guest-leak-invariants.test.ts` (5: no raw JSON, no taxonomy-key leaks, no copy editorial de host en guest, no labels internos, no `presentationType: "raw"` visible). Fixture adversarial compartida en `src/test/fixtures/adversarial-property.ts`. Antes de abrir PR que toque el renderer público o resolvers, estos tests deben pasar.
- UI guest sigue las reglas de [docs/FEATURES/GUEST_GUIDE_UX.md](docs/FEATURES/GUEST_GUIDE_UX.md) — tipografía Inter 28/20/16/14/12, spacing 4/8/12/16/24/32/48, radii 8/10/12/20, cards `HeroCard`/`EssentialCard`/`StandardCard`/`WarningCard` (CVA), targets 44×44, contraste AA, axe-core 0 violations serias.
- Stack obligatorio en UI guest: Radix UI primitives, lucide-react, CVA, tailwind-merge/clsx, fuse.js, yet-another-react-lightbox (lazy), date-fns, react-hook-form+zod solo en forms. **Prohibido** en guest: MUI, Ant Design, Chakra, `next-pwa`.
- PWA / offline (rama 10I): SW manual servido por `src/app/g/[slug]/sw.js/route.ts` (no `public/sw.js` — scope global rompería aislamiento). Versionado vía `__SW_VERSION__` = `GuideSearchIndex.buildVersion` (rama 10H), 12 chars determinísticos. Tres tiers de caché declarados en `taxonomies/guide_sections.json` (`offlineCacheTier: 1|2|3`); tier 1 (essentials/arrival/checkout/emergency) precached al install + SWR; tier 2 (thumbs) SWR con cap 12; tier 3 (md/full) network-first con timeout 2s. Manifest dinámico vía `buildGuidePwaManifest()` con `theme_color` derivado de `getBrandPair(brandPaletteKey).light`. Cache names llevan slug en namespace (`guide-<slug>-tier{N}-<version>`) para aislamiento per-property. Tests: 5 invariantes vitest + 1 spec E2E fuerte; SW lifecycle real no se testea en headless (flake típico).

## Patrones de UI — Operator shell (Fase 16D / 16D.5)

- **ThemeToggle** (`src/components/ui/theme-toggle.tsx`): 3 estados — `auto` / `light` / `dark`. Persiste en `localStorage[THEME_STORAGE_KEY]` (`src/lib/theme.ts`, key `"theme"`). Aplica `data-theme` en `<html>`. En modo `auto` responde a cambios del SO vía `matchMedia` listener (useEffect con cleanup). El pre-paint script en `layout.tsx` lleva una copia del key literal porque no puede importar módulos — si renombras `THEME_STORAGE_KEY`, actualiza `layout.tsx` también.
- **AppShell** (`src/components/layout/app-shell.tsx`): server component. Monta `SideNav` + columna de contenido (`Topbar` + `<main>`). `sectionScores` se obtiene de `getDerived()` dentro de un try/catch fail-soft (un fallo de caché no rompe la navegación).
- **Topbar** (`src/components/layout/topbar.tsx`): client component. Grid 3 columnas: breadcrumbs | `CommandBarSlot` | `ThemeToggle`. Usa `isNavItemActive()` de `navigation.ts` para resolver el item activo.
- **CommandBarSlot** (`src/components/layout/command-bar-slot.tsx`): placeholder visual, `aria-hidden="true"`. No tiene interactividad ni listener `⌘K` — funcionalidad real diferida a `FUTURE.md §8.2`.
- **SideNav** (`src/components/layout/side-nav.tsx`): iconos viven en mapa local `NAV_ICONS: Partial<Record<string, LucideIcon>>` — NO en `navigation.ts`. `isNavItemActive()` importado de `navigation.ts`. Badge de propiedad arriba, grupos content/outputs/operations en el centro, "Nueva propiedad" en el footer (neutro, sin identidad de usuario).
- **Properties list + login** (`src/app/page.tsx`, `src/app/login/page.tsx`): ambas tienen `ThemeToggle` en un header mínimo. Login: reskin completo con tokens semánticos, copia en español, SVG de Google inline.
- **dark-parity.test.ts** (`src/test/dark-parity.test.ts`): 4 tests — root block existe, dark block existe, todos los grupos core tienen override dark, ≥80% paridad global. Los grupos core = `CORE_PREFIXES` en el test.

### Primitivos obligatorios (Fase 16D.5)

Toda surface bajo `AUDITED_SURFACES` (hoy: overview + layout + theme-toggle; 16E/F la extienden) **debe** usar estos primitivos en lugar de raw className. El test `src/test/component-invariants.test.ts` enforza la adopción.

- **`<Card variant="overview">`** (`src/components/ui/card.tsx`): shell `flex h-full flex-col rounded-[var(--radius-lg)] border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4`. **No** anidar `CardHeader`/`CardContent` dentro (double-pad: `--card-padding-md = var(--space-5)` ≠ `p-4`). Cards con shell no canónico (overflow container, p-5 hero, grid) NO migran al primitivo — el test los excluye por firma.
- **`<SectionEyebrow icon={…}>`** (`src/components/ui/section-eyebrow.tsx`): `<h3>` con icono Lucide y label, tipografía `text-sm font-semibold text-[var(--color-text-primary)]`. Reemplaza el patrón inline `<h3 className="flex items-center gap-2 text-sm font-semibold">`.
- **`<IconBadge icon={…} tone={…}>`** (`src/components/ui/icon-badge.tsx`): `<span aria-hidden>` decorativo 30×30 (sm) o 36×36 (md). Tones: `neutral|success|warning|danger|primary` (5 keys — el extra `primary` evita falso positivo del gate `Record<BadgeTone>`). Reemplaza el bloque `<span className="grid h-[30px] w-[30px] ... rounded-[8px] bg-[...]">`.
- **`<TextLink size="xs|sm|md" arrow>`** (`src/components/ui/text-link.tsx`): inline link `text-[N]px font-medium text-[var(--color-text-link)] hover:underline`. Reemplaza `<Link className="text-[N]px font-medium text-[var(--color-text-link)] hover:underline">`.
- **`<TimelineList items={…}>`** (`src/components/ui/timeline-list.tsx`): vertical timeline con dot tones — usado en activity-feed, futuro audit log (16E), conversation events (16F).
- **`<IconButton icon={…} size="sm|md" tone="neutral|primary">`** (`src/components/ui/icon-button.tsx`): button-only, `<button>` puro. `md` = h-11 w-11 (44 visual). `sm` = h-8 w-8 (32 visual) con `recipe-icon-btn-32` baked → 44 hit area vía pseudo-elemento `::before`, colapsa a 44 visual en `pointer:coarse`.
- **`<IconButtonLink icon={…} size="sm|md">`** (`src/components/ui/icon-button-link.tsx`): wrapper de `next/link`. **NO** polimorfismo `as="a"` — separa typed `href` + prefetch del primitivo `<button>` puro.
- **`<ButtonLink size="sm|md|lg" variant="primary|secondary">`** (`src/components/ui/button-link.tsx`): text-button-styled `<Link>` que **hornea** `hover:no-underline` para outranquear el `a:hover { text-decoration: underline }` global de `base.css` (el bug de specificity (0,1,1) que vence Tailwind arbitrary classes).
- **`tone.ts`** (`src/lib/tone.ts`): records keyed por `BadgeTone = "neutral"|"success"|"warning"|"danger"`. Usar `TONE_DOT_BORDER`, `TONE_BG_SOFT`, `TONE_TEXT`, `TONE_BORDER` en lugar de mapas inline. **Cualquier `Record<BadgeTone, ...>` con keys distintas falla el test** (regla 6 — tone quartet).

### Touch-target invariant (regla 1)

Todo elemento clickable button-shaped (con `bg-[var(--color-...)]` o outline `border + border-[var(--color-...)] + rounded-[...]`) debe alcanzar **44 hit area**. Patrones aceptados (en orden de preferencia):

1. **Visual 44**: `min-h-[44px]` / `min-h-11` / `h-11` / `h-12+`. Default para botones text-bearing y mobile-only (donde `pointer:coarse` es la regla).
2. **Slop 32→44**: `recipe-icon-btn-32` (32 visual + `::before { inset: -6px }` = 44 hit en fine pointers; `@media (pointer: coarse)` colapsa a 44 visual). Default para topbar icon-only en desktop. **No** apta para messaging mobile, drawer mobile, ni cualquier surface con táctil primario — usar visual 44 ahí.

Inline text links (sin bg ni outline button-style) están **exentos** por WCAG 2.5.8 (inline target exception). El test los excluye de la regla.

### Surface profiles (operator vs guest, 16D.5)

`AUDITED_SURFACES` en `src/test/parity-allowlist.ts` lleva `profile: "operator" | "guest" | "shared"`. **El sistema visual de operator y guest es deliberadamente distinto** — guest mantiene su propio set de cards (`HeroCard`, `EssentialCard`, `StandardCard`, `WarningCard` en `src/components/public-guide/ui/`), tipografía Inter 28/20/16/14/12 y radii 8/10/12/20 por contrato (ver `docs/FEATURES/GUEST_GUIDE_UX.md`), no la shell operator. **No** forzar `<Card variant="overview">`, `<SectionEyebrow>`, `<IconBadge>`, etc. sobre guest.

Invariantes que aplican por profile:

- **Operator-only** (`profile: "operator" | "shared"`): primitive-adoption (`<Card variant="overview">`), command-bar slot non-interactive, copy-lint Spanish, `<ButtonLink size="sm">` ban.
- **Compartidas** (cualquier profile): touch-target ≥44 hit area, HTML validity (no nested button/anchor), web API guards (SSR-safe), Tailwind hardcode (no named-palette), tone quartet, empty handlers, effect cleanup, interactive elements as `<button>`/`<Link>`.

Cuando 16E/F/G añadan guest surfaces auditadas, el filtrado se hace mediante `auditedFilesByProfile("operator", "shared")` en el test; no hay que tocar las invariantes individuales.

### Allowlist governance (parity-allowlist.ts)

`src/test/parity-allowlist.ts` mantiene 8 listas de excepciones tipadas con `ExceptionEntry { file, reason, removeBy: LioraPhase|"never" }`. `LioraPhase = "16D.5"|"16E"|"16F"|"16G"` con orden canónico en `LIORA_PHASE_ORDER`; la fase activa vive en `CURRENT_LIORA_PHASE`. **Política**:

- Toda excepción nueva requiere `reason` ≥ 8 chars y `removeBy` ≤ fase actual + 1. Excepciones que sobreviven 2 fases son governance debt — la rama responsable no las cerró.
- **PR description + commit message** deben justificar cualquier excepción añadida (motivo, deadline, plan de retirada). Una excepción sin justificación visible al revisor bloquea el merge — la auditabilidad es el contrato, no la lista en sí.
- **Phase-order enforcement**: el invariante governance-shape compara `removeBy` contra `CURRENT_LIORA_PHASE` y falla si `removeBy` está en el pasado (`isPhaseInPast`). Una rama no puede mergear con una excepción cuyo `removeBy` ya pasó — la cleanup se hace o se sube el `removeBy` con un commit explícito que documente el motivo de la extensión.
- Si una rama no puede cerrar una excepción heredada, debe explicarlo en PR description (motivo, plan, próxima rama responsable). Saltar el deadline silenciosamente no es opción — el gate falla CI.
- `removeBy: "never"` reservado a casos estructurales (brand SVGs de terceros, etc.). Cualquier otro uso es CR red-flag.
- **Orphan check**: `EXPECTED_OPERATOR_SCOPE_PATTERNS` + heurística de imports de primitivos (`LIORA_PRIMITIVE_IMPORT_PATHS`). Cualquier .tsx que matchee un patrón esperado o importe un primitivo Liora **debe** estar en `AUDITED_SURFACES` o en `ORPHAN_AUDIT_PENDING_EXCEPTIONS`. Falla en CI; no se puede mergear silenciosamente migrando un fichero sin cobertura.
- 16G empty-registry gate: todas las listas vacías al merge final (excepto `removeBy: "never"`). El modelo "8 listas vacías al final" se enforza vía `parity-allowlist.ts` + tests, no es una promesa.

### Branch closure template — 16E onwards (heredado de 16D.5)

Toda PR de una rama Liora visual posterior a 16D.5 (16E, 16F, 16G y subramas E1/E2/E3, F1/F2/F3) **debe** incluir una sección "Audited surfaces / test coverage" en la descripción de la PR. Spec normativa completa en [docs/MASTER_PLAN_V2.md § Liora branch closure template — 16E onwards](docs/MASTER_PLAN_V2.md). Resumen de reglas duras enforced por `component-invariants.test.ts`:

1. **Same-commit AUDITED_SURFACES update**. Toda página/operator surface tocada o migrada se añade a `AUDITED_SURFACES` en el mismo commit. Una migración visual sin actualización de `AUDITED_SURFACES` no está completa.
2. **Liora-import heuristic**. Cualquier .tsx que importe primitivos Liora (`@/components/ui/{card,section-eyebrow,icon-badge,text-link,timeline-list,icon-button,icon-button-link,button-link}` o `@/lib/tone`) debe quedar cubierto por `AUDITED_SURFACES` o `ORPHAN_AUDIT_PENDING_EXCEPTIONS` en esa misma rama. El orphan check es enforcement real, no documentación.
3. **Profile separation (operator vs guest vs shared)**. Guest public guide tiene su propio sistema visual en `src/components/public-guide/ui/` y **no hereda primitivos operator** (`<Card variant="overview">`, primitive-adoption operator, copy-lint Spanish, etc.). Para guest aplican invariantes compartidos: tokens, hardcodes, web API guards, a11y básica, target-size donde corresponda. Si una rama futura audita guest surfaces, usa `profile: "guest"` y la batería compartida se aplica automáticamente.
4. **`CURRENT_LIORA_PHASE` bump al iniciar la rama**. 16E sube `CURRENT_LIORA_PHASE` a `"16E"`, etc. Sin bump → la rama no recibe el efecto de governance (phase-order check sobre entradas heredadas) — bug.
5. **Exception policy**. Ver § Allowlist governance arriba. Cualquier excepción nueva: justificar en PR + commit, `removeBy` ≤ siguiente fase, no acumular debt.

Esta sección es la spec normativa heredable. Si en una rama futura el agente no encuentra estas reglas o no recuerda el formato del template, vuelve a `MASTER_PLAN_V2.md` § Liora branch closure template — no es necesario inferir.

### Static-analysis gate honestidad (16D.5)

`component-invariants.test.ts` usa un **walker JSX brace-aware heurístico**, no un AST parser completo. El walker rastrea `{}` nesting + string literals para encontrar el cierre real del open-tag (evita el bug de `>` dentro de `=>` callbacks), pero no construye un syntax tree. Consecuencias:

- Componentes resueltos a runtime (`<IconButton>` que renderiza `<button>`) no son detectados — solo tags literales (`<button>`, `<Link>`, `<a>`, `<ButtonLink>`).
- Polymorphism `as="a"` rompería el gate por la misma razón — por eso primitivos como `IconButton`/`IconButtonLink`/`ButtonLink` están separados deliberadamente (no `as` poly).
- Si en 16E o posterior el rigor lo requiere, opción A: introducir `@typescript-eslint/parser` explícito en devDependencies y reescribir las invariantes sobre AST. Hoy: heurística suficiente para el scope auditado, documentada como tal.

## Patrones de UI — Espacios

- Botones de feature activos: estilo sólido `bg-[var(--color-primary-500)] text-white` — **no** `bg-primary-50 text-primary-700` (bajo contraste sobre surface-elevated)
- `SpaceSection`: punto de color + label bold (`text-[var(--color-neutral-600)] font-bold`) para separación visual clara
- Añadir un nuevo `type` a `SpaceFeatureField` requiere cambios en 3 sitios: `src/lib/types/taxonomy.ts` (union), `StructuredField` en `space-card.tsx`, y filtro de `FlatFeatureSection`
- `InfoTooltip` usa `createPortal` a `document.body` con offsets `window.scrollY/X` para escapar `overflow-hidden` de CollapsibleSection — no cambiar esta implementación
- Warning de capacidad de camas: va dentro de `BedManager` justo debajo del label "Capacidad total", no como bloque separado en el card
- `text_chips`: tipo de campo para etiquetas libres (array de strings); estado propio en `TextChipsField`, Enter añade chip
- Datos JSON libres (heating/cooling custom, views custom, bed configJson) no requieren migración — se almacenan en campos `Json?` ya existentes (`featuresJson`, `configJson`)
