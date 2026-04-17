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

## Patrones — Guía pública (audience=guest)

**Regla dura: `audience=guest` nunca ve el modelo interno.** Enums, JSON, claves de taxonomía (`rm.*`, `ct.*`, `am.*`), copy editorial del host ("Añade...", "Completa..."), labels internos ("Slot", "Propiedad", "Config JSON") son **bugs** si llegan al huésped.

- Pipeline canónico (rama 10F): `composeGuide → filterByAudience → normalizeGuideForPresentation → render`. El normalizador es terminal y puro. El renderer consume `displayValue` / `displayFields`, **nunca** `value` / `fields` raw.
- Humanización = presenter registry (`src/config/registries/presenter-registry.ts`). Añadir soporte al huésped para una nueva clave taxonómica = (1) `guestLabel`/`guestDescription`/`icon` en la taxonomía, (2) presenter registrado por clave o prefijo, (3) `presenter-coverage.test.ts` verde.
- Empty states: nunca se muestra `section.emptyCopy` al huésped; usar `emptyCopyGuest` (neutro, no imperativo) o `hideWhenEmptyForGuest: true`. Si no hay dato, la tendencia es ocultar antes que explicar que falta.
- `GuideItem` en audience guest lleva `presentationType`, `displayValue`, `displayFields`, `presentationWarnings`. El renderer que consuma `value` o `fields` directamente está mal — el normalizador es la única fuente de verdad de presentación.
- Invariantes enforced por `src/test/guest-leak-invariants.test.ts` (no raw JSON, no enum leaks, no copy editorial de host en guest, no labels internos, no `presentationType: "raw"` visible). Antes de abrir PR que toque el renderer público o resolvers, estos tests deben pasar.
- UI guest sigue las reglas de [docs/FEATURES/GUEST_GUIDE_UX.md](docs/FEATURES/GUEST_GUIDE_UX.md) — tipografía Inter 28/20/16/14/12, spacing 4/8/12/16/24/32/48, radii 8/10/12/20, cards `HeroCard`/`EssentialCard`/`StandardCard`/`WarningCard` (CVA), targets 44×44, contraste AA, axe-core 0 violations serias.
- Stack obligatorio en UI guest: Radix UI primitives, lucide-react, CVA, tailwind-merge/clsx, fuse.js, yet-another-react-lightbox (lazy), date-fns, react-hook-form+zod solo en forms. **Prohibido** en guest: MUI, Ant Design, Chakra, `next-pwa`.

## Patrones de UI — Espacios

- Botones de feature activos: estilo sólido `bg-[var(--color-primary-500)] text-white` — **no** `bg-primary-50 text-primary-700` (bajo contraste sobre surface-elevated)
- `SpaceSection`: punto de color + label bold (`text-[var(--color-neutral-600)] font-bold`) para separación visual clara
- Añadir un nuevo `type` a `SpaceFeatureField` requiere cambios en 3 sitios: `src/lib/types/taxonomy.ts` (union), `StructuredField` en `space-card.tsx`, y filtro de `FlatFeatureSection`
- `InfoTooltip` usa `createPortal` a `document.body` con offsets `window.scrollY/X` para escapar `overflow-hidden` de CollapsibleSection — no cambiar esta implementación
- Warning de capacidad de camas: va dentro de `BedManager` justo debajo del label "Capacidad total", no como bloque separado en el card
- `text_chips`: tipo de campo para etiquetas libres (array de strings); estado propio en `TextChipsField`, Enter añade chip
- Datos JSON libres (heating/cooling custom, views custom, bed configJson) no requieren migración — se almacenan en campos `Json?` ya existentes (`featuresJson`, `configJson`)
