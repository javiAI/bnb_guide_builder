# Plan maestro V2 — Outputs, Intelligence & Integrations

Versión: 2026-04-15 (rev. 2)
Continuación de: [archive/v1-master-plan-executed.md](archive/v1-master-plan-executed.md) (fases 1A–7B completadas)
Alcance: 7 fases, 24 ramas, ~24 PRs independientes y revisables

Este documento es **fuente de verdad ejecutable y viva**. Antes de cada rama, leer su sección entera y seguir el **Protocolo de ejecución por rama**. Las actualizaciones al plan se hacen en PRs aparte y auditadas (ver §2.9).

---

## 1. Principios de ejecución

Heredados del v1 y reconfirmados:

1. **Una rama = una PR = un cambio lógico**. Nada de super-PRs.
2. **Config-driven**: si una regla vive en React, es un bug.
3. **Tests nuevos en cada PR**. Sin tests, no merge.
4. **Validación TS + Prisma antes de commit** (`/pre-commit-review`).
5. **Revisión Copilot en cada PR** (`/review-pr-comments`).
6. **No backward-compat silencioso**. Tras una migración validada, el código legacy se borra en la misma rama o en la siguiente.
7. **Visibility first**: cualquier feature que toque output (guide/messaging/assistant) pasa por el filtro de visibility antes de considerarse feature-complete.
8. **Actualizar docs existentes, no crear docs nuevos**. Si algo cabe en un doc operativo actual, va ahí. Solo crear doc nuevo si no hay hueco razonable.

---

## 2. Protocolo de ejecución por rama

Cada una de las 24 ramas sigue este ciclo. Las herramientas listadas aquí son el **default**. Cada rama solo cita herramientas *extra* específicas. Referencias a herramientas: ver `docs/archive/global-skills-reference.md` para qué hace cada una.

### 2.1 Fase -1 — Revisión pre-rama (gate de aprobación)

**Obligatorio**. Antes de crear la rama — antes incluso de correr `git checkout -b` — Claude debe producir y esperar aprobación explícita del usuario sobre:

1. **Resumen técnico**: qué archivos se crean/modifican, qué modelos Prisma cambian, qué tests se añaden, qué riesgos concretos (migraciones, breaking APIs, nuevas deps). Nivel de detalle suficiente para revisar arquitectura sin abrir código.
2. **Resumen conceptual**: qué cambia para el usuario final (lo que nota al usar la app), cómo mejora el producto, qué feature nueva introduce, qué problema real resuelve. En lenguaje de producto, no técnico.
3. **Ambigüedades detectadas**: listar preguntas concretas que el plan no resuelve (ej. "¿copy del empty state?", "¿mostrar X solo a hosts o también a co-anfitriones?", "¿qué pasa si el usuario borra Y mientras Z está activo?"). Si no hay ambigüedades, decirlo explícitamente.
4. **Alternativas y mejoras sugeridas**: Claude propone activamente 1-3 alternativas o mejoras al plan original (scope ampliado/reducido, enfoque distinto, dependencias que conviene sacar a rama separada, etc.) y pregunta cuáles incluir.
5. **Iteración**: el usuario puede pedir ajustes. Repetir el ciclo (nuevo resumen técnico/conceptual + nuevas preguntas) hasta aprobación.
6. **Actualización de documentación si hay cambios acordados**: si la iteración modifica el alcance, actualizar `MASTER_PLAN_V2.md` de la rama (y otros docs relevantes) **antes** de crear la rama. Si el cambio es grande, seguir §2.8 (PR de plan aparte antes de empezar).
7. **Aprobación explícita del usuario** ("ok, adelante", "procede", equivalente). Sin ella, no se pasa a Fase 0.

Este gate no se salta nunca, ni siquiera en ramas "triviales". Si la rama es realmente trivial, el resumen será corto — pero existe.

### 2.2 Fase 0 — Antes de crear la rama

1. Leer la sección **entera** correspondiente de este documento (`MASTER_PLAN_V2.md § Rama XY`).
2. Leer los archivos/rangos listados en **"Contexto a leer"** de esa rama.
3. Si la rama indica `Memoria previa: requires X`, cargar ese contexto explícitamente antes de empezar.
4. **Opcional** — `/firecrawl-search "<tema>"` si la rama implica decisiones de UX/dominio donde hay best practices externas relevantes.
5. **Opcional** — `/excalidraw-diagram` si la rama requiere diseño visual previo (ej: 9A rendering tree, 11B pipeline assistant).
6. **Opcional** — `Agent Plan` si la arquitectura interna de la rama tiene múltiples caminos razonables.

### 2.3 Fase 1 — Al crear la rama

```bash
git checkout main && git pull origin main
git checkout -b <rama-name>
```

### 2.4 Fase 2 — Durante implementación

- **Context7** (MCP, auto) — verificar APIs de librerías (Prisma, Next.js, React, Zod, pgvector). Se activa solo; no hay que invocar nada.
- **Agent Explore** — búsquedas cross-archivo que superen 3 queries o necesiten síntesis.
- **Agent code-explorer** — trazar flujos complejos en el código existente.
- **Agent code-architect** — diseñar subsistemas con múltiples puntos de integración.
- **`/playwright-cli`** — si la rama toca UI y necesitas verificar estado visual en `localhost:3000`.

### 2.5 Fase 3 — Antes de cada commit

- **`/pre-commit-review`** (hook `PreToolUse:Bash` lo recuerda automático).
- `npx prisma generate && npx tsc --noEmit` — la fuente de verdad TS.
- `npx vitest run <affected-tests>`.

### 2.6 Fase 4 — Antes de abrir PR

- **`/simplify`** — si se escribió volumen significativo de código nuevo. Detecta duplicación y oportunidades de reutilización antes de que lo haga Copilot.
- Verificar que el push llegó al remote: `git ls-remote origin <rama>` (el proxy rtk a veces falla silente, ver CLAUDE.md).

### 2.7 Fase 5 — Con la PR abierta

- **`/review-pr-comments`** tras feedback de Copilot (u otros reviewers). Triage por valor/esfuerzo antes de aplicar.

### 2.8 Fase 6 — Post-merge

1. `git checkout main && git pull origin main --ff-only`.
2. **Actualizar los docs listados en "Docs a actualizar al terminar"** de la rama. **Nunca crear docs nuevos si se puede actualizar uno existente**.
3. **`/revise-claude-md`** si la rama introduce patrones nuevos reutilizables (nuevos gotchas de entorno, convenciones de código, patrones de UI).
4. Actualizar `docs/ROADMAP.md`: marcar la rama como hecha y apuntar a la siguiente.
5. Si durante la rama se descubrieron gaps del plan, seguir §2.9.

### 2.9 Actualización auditada del plan

Si durante la ejecución de una rama descubrimos que el plan necesita cambios (gaps, supuestos incorrectos, mejor secuenciación detectada):

1. **No editar MASTER_PLAN_V2.md silenciosamente**. Abrir PR aparte `chore/plan-update-<tema>`.
2. Editar este documento con el cambio.
3. En la descripción de esa PR, explicar: qué rama encontró el gap, qué cambia, por qué.
4. Ref cruzada: la PR de la rama afectada linkea a la PR del plan.
5. Merge del plan **antes o junto** al merge de la rama afectada.

Esto mantiene el plan como fuente de verdad viva y auditable.

---

## 3. Resumen de fases

| Fase | Título | Ramas | Riesgo | Valor | Breaking? |
|---|---|---:|---|---|---|
| 8 | Deuda técnica pre-output | 3 | Bajo | Medio | No |
| 9 | Guest Guide v2 | 4 | Medio | Alto | No |
| 10 | Media real (S3) | 3 | Bajo | Alto | Sí (storage) |
| 11 | Knowledge + Assistant | 4 | Alto | Alto | No |
| 12 | Messaging con variables | 3 | Medio | Alto | No |
| 13 | Guía local enriquecida | 3 | Bajo | Medio | No |
| 14 | Platform integrations | 4 | Alto | Alto | Posible |

---

## FASE 8 — Deuda técnica pre-output

**Objetivo**: limpiar deuda que bloquea fases grandes. Cero valor de usuario directo, pero divide el coste futuro.

### Rama 8A — `refactor/completeness-to-json`

**Propósito**: extraer las fórmulas de completeness hardcoded en `src/lib/services/completeness.service.ts` a `taxonomies/completeness_rules.json`, para que 7C pueda calibrar sin redeploy.

**Archivos a crear**:
- `taxonomies/completeness_rules.json` — versionado (`version`, `locale`, reglas por sección con weight/threshold)

**Archivos a modificar**:
- `src/lib/services/completeness.service.ts` — leer pesos/umbrales desde la taxonomía
- `src/lib/taxonomy-loader.ts` — helper `getCompletenessRule(sectionKey)`

**Tests**:
- `src/test/completeness-config-driven.test.ts`:
  - valores en JSON producen los mismos scores que antes para un set de fixtures
  - cambiar un weight en el JSON mueve el score en la dirección esperada
  - ausencia de una regla lanza error claro (no silent zero)

**Criterio de done**: el service es puro wrapper del JSON. 7C se puede ejecutar editando solo la taxonomía.

**Preparación**:
- **Contexto a leer**:
  - `src/lib/services/completeness.service.ts` (archivo completo)
  - `src/lib/taxonomy-loader.ts` — sección de helpers de taxonomía (buscar `export function get*`)
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Loader contract" y § "Mandatory taxonomies"
  - `docs/FUTURE.md` § "Calibración de completeness (7C del plan original)"
- **Memoria previa**: **clean** — suficiente con leer lo anterior
- **Docs a actualizar al terminar**:
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `completeness_rules.json`
  - `docs/FUTURE.md` § "Calibración de completeness" — quitar nota "pre-requisito: que las reglas estén extraídas a JSON"
- **Skills/tools específicos**: ninguno extra al protocolo general

---

### Rama 8B — `refactor/field-type-registry`

**Propósito**: consolidar `SubtypeFieldInput` + `buildSubtypeFieldSchema` en un registry único. Añadir un tipo de campo pasa de 3 archivos a 1 entrada.

**Archivos a crear**:
- `src/config/registries/field-type-registry.ts` — mapa `FIELD_TYPES[type] = { render, validate, default }`

**Archivos a modificar**:
- `src/components/amenity-subtype-field.tsx` — consume el registry
- `src/lib/schemas/editor.schema.ts` — `buildSubtypeFieldSchema` consume el registry
- `src/lib/types/taxonomy.ts` — eliminar union hardcoded, derivar de `keyof typeof FIELD_TYPES`

**Tests**:
- `src/test/field-type-registry.test.ts` — cada tipo (boolean, text, select, number, time, chips, etc.) renderiza y valida correctamente
- `src/test/field-type-registry-extension.test.ts` — un tipo nuevo añadido solo al registry queda disponible en subtypes sin tocar componentes

**Criterio de done**: añadir `color_picker` es una entrada de 5 líneas en el registry.

**Preparación**:
- **Contexto a leer**:
  - `src/components/amenity-subtype-field.tsx` (completo)
  - `src/lib/schemas/editor.schema.ts` — función `buildSubtypeFieldSchema` y su entorno inmediato
  - `src/lib/types/taxonomy.ts` — union `SubtypeFieldType`
  - `src/config/registries/` — listar para ver patrones de registry existentes (`icon-registry.ts`, `renderer-registry.ts`)
  - `docs/FUTURE.md` § "Field-type registry (tangencial, 1-2h)"
- **Memoria previa**: **clean**
- **Docs a actualizar al terminar**:
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Tipos de campo soportados" — referenciar el registry como fuente de verdad
  - `docs/FUTURE.md` § 3 — quitar (completado)
  - `CLAUDE.md` § "Patrones de Sistemas" — añadir nota "añadir tipo de campo = 1 entrada en field-type-registry"
- **Skills/tools específicos**: ninguno extra

---

### Rama 8C — `chore/docs-and-memory-sync`

**Propósito**: sincronizar memoria auto (`MEMORY.md` + archivos) con el estado post-consolidación de docs. Retirar referencias obsoletas.

**Archivos a modificar**:
- `~/.claude/projects/-Users-javierabrilibanez-Dev-guide-builder-claude/memory/MEMORY.md` — quitar entradas rotas o duplicadas
- `~/.claude/projects/.../memory/project_roadmap.md` — reemplazar contenido por puntero a `docs/ROADMAP.md`
- `~/.claude/projects/.../memory/project_implementation_plan.md` — archivar (plan v1 cerrado)

**Criterio de done**: memoria refleja realidad actual; docs operativos son la fuente de verdad.

**Preparación**:
- **Contexto a leer**:
  - `~/.claude/projects/-Users-javierabrilibanez-Dev-guide-builder-claude/memory/MEMORY.md`
  - Todos los archivos referenciados desde ese índice
  - `docs/ROADMAP.md` (para saber a qué puntero reemplazar)
- **Memoria previa**: **requires** — es precisamente sincronizar la memoria
- **Docs a actualizar al terminar**: los ficheros de memoria citados arriba (no hay docs de repo que tocar)
- **Skills/tools específicos**: ninguno extra

---

## FASE 9 — Guest Guide v2

**Objetivo**: convertir la página `/guest-guide` en un renderer real. Hoy es un shell de 114 LOC; debe componer una guía publicable desde Property + Spaces + Amenities + Access + Contacts + Rules + Systems.

### Rama 9A — `feat/guide-rendering-engine`

**Propósito**: función `composeGuide(propertyId, audience)` que produce un árbol tipado `GuideTree` desde entidades canónicas, aplicando filtros de visibility por audiencia. **Resiliente a cambios de taxonomía y entidades** (ver "Principios de resiliencia" abajo).

**Decisiones cerradas en Fase -1 (2026-04-15)**:
- **Fuente de datos**: `PropertyDerived` para flags/completeness; entidades canónicas (Property, Space, Amenity, etc.) para contenido.
- **Empty sections**: siempre incluidas en el tree con `items: []` + `emptyCtaDeepLink` al panel del host. El renderer (9B) decide si mostrar CTA o filtrar.
- **Jerarquía de audiencias**: `guest < ai < internal < sensitive`. Un nivel ve lo suyo + todo lo de niveles por debajo. `sensitive` nunca aparece en `GuideTree` (filtrado en boundary).
- **Orden dentro de cada sección**: `guide_sections.json` declara `sortBy: "taxonomy_order" | "recommended_first" | "alpha" | "explicit_order"` por sección.
- **CTA deep-link**: apunta al panel del host (`/properties/[id]/...`), útil para empty-state. No se expone a audience=`guest`.
- **Scope de la rama**: las 7 secciones (arrival, spaces, amenities, rules, contacts, local, emergency) + stub mínimo `renderMarkdown(tree): string` (~50 LOC) para cerrar loop end-to-end con snapshot testing antes de 9B.

**Principios de resiliencia (compromiso arquitectónico duro)**:
1. **Cero IDs hardcoded en resolvers**. Ni `am.wifi`, ni `sp.bedroom`, ni `sys.internet` aparecen en `guide-rendering.service.ts`. Todo se itera por entidad y se enriquece leyendo taxonomía.
2. **Labels y descripciones siempre desde taxonomía**. El servicio no traduce IDs a texto; delega en `taxonomy-loader`.
3. **Formateo de valores vía `field-type-registry` (rama 8B)**. Reutilización directa: un type nuevo en el registry se renderiza sin tocar el guide engine.
4. **Graceful degradation para taxonomy keys deprecadas**. Una `AmenityInstance` con `amenityKey` que ya no existe en `amenity_taxonomy.json` produce un `GuideItem` con `deprecated: true` y el raw key como label — el motor no lanza.

**Archivos a crear**:
- `src/lib/services/guide-rendering.service.ts`:
  - `composeGuide(propertyId, audience): Promise<GuideTree>`
  - `resolveSection(sectionKey, ctx)` — uno por sección (arrival, spaces, amenities, rules, contacts, local, emergency)
  - `filterByAudience(items, audience)` — delega el orden de visibilidad en `src/lib/visibility.ts` (`canAudienceSee` + `VISIBILITY_ORDER`), con la única excepción dura de que `sensitive` nunca aparece en el `GuideTree`
  - `formatFieldValue(field, value)` — wrapper sobre el registry de 8B
- `src/lib/types/guide-tree.ts` — tipos `GuideTree`, `GuideSection`, `GuideItem`, `GuideMedia`, `GuideAudience`
- `taxonomies/guide_sections.json` — declaración de secciones: `id`, `label`, `order`, `maxVisibility`, `sortBy`, `emptyCtaDeepLink`, `resolverKey`
- `src/lib/renderers/guide-markdown.ts` — stub `renderMarkdown(tree): string` (alt B del Fase -1)

**Archivos a modificar**:
- `src/lib/taxonomy-loader.ts` — `getGuideSectionConfig()` + Zod loader para `guide_sections.json`

**Tests**:
- `src/test/guide-rendering.test.ts`:
  - filtra `sensitive` en audience=`guest` (y en todas las audiencias públicas)
  - `ai` incluye contenido `guest + ai`; `internal` incluye los 3
  - orden de secciones respeta `guide_sections.json`
  - property sin space.bedroom emite section Spaces con `items: []` + `emptyCtaDeepLink` (NO omite ni lanza)
  - property sin ningún contacto emite section Contacts con empty-state
- `src/test/guide-tree-schema.test.ts` — tipos estrictos, no `unknown` accidentales
- `src/test/guide-sections-coverage.test.ts` **(nuevo, integridad)**:
  - cada sección en `guide_sections.json` tiene un `resolverKey` que mapea a un resolver real
  - ningún resolver del servicio es huérfano (no declarado en la taxonomía)
- `src/test/guide-rendering-resilience.test.ts` **(nuevo, resiliencia)**:
  - una `AmenityInstance` con `amenityKey = "am.does_not_exist"` produce un `GuideItem` con `deprecated: true` y raw key como label, no throw
  - un `Space` con `spaceTypeKey` deprecado se renderiza igual
  - un `SubtypeField` con `type` desconocido (taxonomía mal editada) produce warning en tree, no crash
- `src/test/guide-no-hardcoded-ids.test.ts` **(nuevo, invariante)**:
  - regex lint sobre `guide-rendering.service.ts`: no admite patrones `=== "am\..*"`, `=== "sp\..*"`, `=== "sys\..*"`, `=== "pol\..*"`
- `src/test/guide-markdown-snapshot.test.ts` — snapshot determinístico por audiencia (usando el stub de `renderMarkdown`)

**Criterio de done**:
- Servicio puro, 100% cubierto.
- Stub `renderMarkdown` produce markdown determinístico (snapshot tests verdes).
- Los 3 tests de integridad/resiliencia/invariante verdes.
- Diagrama del tree commited en `docs/diagrams/guide-tree.excalidraw`.

**Preparación**:
- **Contexto a leer**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § 6 "Source-of-truth rules", § 8 "Visibility model", § 13 "Rendering model"
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` (completo)
  - `prisma/schema.prisma` — modelos `GuideVersion`, `GuideSection`, `GuideSectionItem`
  - `src/lib/services/property-derived.service.ts` (patrón de servicios que componen desde entidades canónicas)
  - `taxonomies/visibility_levels.json`
  - `src/config/registries/field-type-registry.ts` (reutilización para formateo de valores)
- **Memoria previa**: **clean**
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § 13 — concretar el renderer con referencia al nuevo servicio
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `guide_sections.json` y sección de resiliencia del guide engine
- **Skills/tools específicos**:
  - **`/excalidraw-diagram`** **antes** de codificar: diagrama del `GuideTree` (secciones → items → media, flags de visibility por nodo, flujo audience-filter). Committed en `docs/diagrams/guide-tree.excalidraw`.

---

### Rama 9B — `feat/guide-markdown-output`

**Propósito**: renderer que convierte `GuideTree` a markdown + HTML estructurado. Soporta audience toggle (guest/ai/internal).

**Archivos a crear**:
- `src/lib/renderers/guide-markdown.ts` — `renderMarkdown(tree): string`
- `src/lib/renderers/guide-html.ts` — `renderHtml(tree): string` con sanitización
- `src/app/api/properties/[propertyId]/guide/route.ts` — `GET ?audience=guest|ai|internal&format=md|html|json`

**Archivos a modificar**:
- `src/app/properties/[propertyId]/guest-guide/page.tsx` — reemplazar shell por preview real con selector de audiencia
- `src/components/guide-preview.tsx` (nuevo) — muestra markdown con highlighting de secciones

**Tests**:
- `src/test/guide-markdown.test.ts` — markdown determinístico, snapshot testing por audiencia
- `src/test/guide-html-sanitization.test.ts` — HTML escapado correctamente, no inyección desde campos free-text

**Criterio de done**: el endpoint `GET /api/properties/:id/guide?audience=guest&format=md` devuelve markdown sanitizado listo para publicar.

**Preparación**:
- **Contexto a leer**:
  - El servicio creado en 9A (`src/lib/services/guide-rendering.service.ts`) y sus tipos
  - `src/app/properties/[propertyId]/guest-guide/page.tsx` actual (shell)
  - `docs/API_ROUTES.md` (patrón de rutas y error shape)
- **Memoria previa**: **requires 9A merged** — este trabajo depende del servicio de composición
- **Docs a actualizar al terminar**:
  - `docs/API_ROUTES.md` — añadir endpoint `GET /api/properties/[id]/guide`
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Guide generation" — concretar formatos de output
- **Skills/tools específicos**:
  - **`/playwright-cli`** al final: screenshot del preview con los 3 toggles de audiencia para verificar visualmente el filtrado de visibility.

---

### Rama 9C — `feat/guide-publish-workflow`

**Propósito**: snapshot versionado → `GuideVersion`. Publicar congela el árbol actual; cambios posteriores en la property no alteran versiones publicadas.

**Archivos a modificar**:
- `src/lib/actions/guide.actions.ts` (nuevo) — `publishGuideVersion(propertyId, audience)`, `unpublishVersion(versionId)`, `rollbackToVersion(versionId)`
- `src/app/properties/[propertyId]/publishing/page.tsx` — rediseñar: list de `GuideVersion`, botón "Publicar versión actual", diff vs publicada
- `prisma/schema.prisma` — verificar que `GuideVersion.treeJson` almacena el snapshot completo (añadir campo si falta)

**Archivos a crear**:
- `src/lib/services/guide-diff.service.ts` — diff entre dos `GuideTree` (añadidos/quitados/cambiados)

**Tests**:
- `src/test/guide-publish.test.ts` — publicar crea GuideVersion con snapshot; cambio posterior en property no altera la versión publicada
- `src/test/guide-diff.test.ts` — diff entre versiones muestra cambios esperados

**Criterio de done**: host puede publicar, ver historial, comparar versiones, rollback. Cada publicación es un snapshot inmutable.

**Preparación**:
- **Contexto a leer**:
  - `prisma/schema.prisma` modelos `GuideVersion`, `GuideSection`, `GuideSectionItem`
  - `src/app/properties/[propertyId]/publishing/page.tsx` actual (266 LOC, workflow incompleto)
  - Servicios de 9A y renderers de 9B
  - `docs/DATA_MODEL.md` § canonical persisted entities
- **Memoria previa**: **requires 9A + 9B merged**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Publishing workflow"
  - `docs/ARCHITECTURE_OVERVIEW.md` § 6 "Derived layers" — citar `GuideVersion.treeJson` como snapshot inmutable
- **Skills/tools específicos**:
  - **Agent code-architect** si hay duda sobre esquema del diff (granularidad sección vs item).

---

### Rama 9D — `feat/guide-shareable-link`

**Propósito**: cada `GuideVersion` publicada tiene URL shareable pública (sin auth) con filtro `guest`-only.

**Archivos a crear**:
- `src/app/g/[versionSlug]/page.tsx` — ruta pública, audience=guest forzado
- `src/lib/services/guide-slug.service.ts` — slug corto único (tipo bit.ly)

**Archivos a modificar**:
- `prisma/schema.prisma` — `GuideVersion.publicSlug String? @unique`
- `src/app/properties/[propertyId]/publishing/page.tsx` — mostrar link compartible + QR

**Tests**:
- `src/test/guide-public-render.test.ts` — versión publicada accesible sin auth; `sensitive` nunca aparece; `internal` tampoco
- `src/test/guide-slug-collision.test.ts` — generación retry-safe

**Criterio de done**: host copia un link, se lo manda al huésped, el huésped ve la guía sin cuenta.

**Preparación**:
- **Contexto a leer**:
  - Configuración de rutas públicas en Next.js — si hay otras rutas sin auth en el repo, ver el patrón (`src/app/` buscar `layout.tsx` con auth guard para ver dónde aplica)
  - `docs/SECURITY_AND_AUDIT.md` (completo)
  - Código de 9B y 9C
- **Memoria previa**: **requires 9C merged**
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § 5 "Route map" — añadir `/g/:versionSlug` como ruta pública
  - `docs/SECURITY_AND_AUDIT.md` — concretar regla de que `/g/*` siempre fuerza audience=guest
- **Skills/tools específicos**:
  - **`/playwright-cli`** al final: verificar que el link público abre correctamente sin sesión y que los campos `sensitive`/`internal` no aparecen en el DOM.

---

## FASE 10 — Media real

**Objetivo**: habilitar uploads reales. Sin fotos, la Guest Guide vale a medias.

### Rama 10A — `feat/media-storage`

**Propósito**: integración con S3 (o Cloudflare R2) + presigned URLs.

**Archivos a crear**:
- `src/lib/services/media-storage.service.ts` — `getUploadUrl`, `getDownloadUrl`, `deleteObject`
- `src/lib/actions/media.actions.ts` — server actions wrapping presigned URLs
- Variables de entorno: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

**Archivos a modificar**:
- `prisma/schema.prisma` — `MediaAsset.storageKey String`, `MediaAsset.mimeType String`, `MediaAsset.sizeBytes Int`
- `src/app/properties/[propertyId]/media/create-media-form.tsx` — upload real con presigned URL

**Tests**:
- `src/test/media-storage.test.ts` — mock S3 client, verificar flujo presigned
- `src/test/media-upload-action.test.ts` — action retorna URL válida; error si mimeType no permitido

**Criterio de done**: subir foto funciona end-to-end; el archivo queda en S3; la URL firmada caduca.

**⚠ Decisión previa requerida**: S3 vs Cloudflare R2 vs Supabase storage. Confirmar antes de empezar.

**Preparación**:
- **Contexto a leer**:
  - `docs/FEATURES/MEDIA_ASSETS.md` (completo)
  - `prisma/schema.prisma` — modelos `MediaAsset`, `MediaAssignment`
  - `src/app/properties/[propertyId]/media/page.tsx` y `create-media-form.tsx` actuales
  - `.env.example` si existe (para ver convención de env vars)
- **Memoria previa**: **clean**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MEDIA_ASSETS.md` — añadir sección "Storage provider" con provider elegido, bucket, IAM policy de referencia
  - `CLAUDE.md` § "Entorno y comandos" — añadir env vars requeridas para dev local
- **Skills/tools específicos**:
  - **Context7** (auto) — imprescindible para ver API actual de `@aws-sdk/client-s3` o `@aws-sdk/s3-presigned-post`.
  - **`/firecrawl-search`** antes: comparar costes S3 vs R2 vs Supabase si no está decidido.

---

### Rama 10B — `feat/media-per-entity`

**Propósito**: gallery por entidad (property portada, space, access-method, amenity, system, local-place). Consume `MediaAssignment` ya modelado.

**Archivos a modificar**:
- `src/app/properties/[propertyId]/media/page.tsx` — vista global con filtro por entity
- `src/app/properties/[propertyId]/spaces/space-card.tsx` — sección de fotos por espacio
- `src/app/properties/[propertyId]/access/access-form.tsx` — foto por método de acceso
- `src/app/properties/[propertyId]/amenities/` — foto opcional por amenity instance

**Archivos a crear**:
- `src/components/media-gallery.tsx` — gallery reutilizable con upload inline
- `src/components/media-thumbnail.tsx` — thumbnail con acciones (delete, set cover)

**Tests**:
- `src/test/media-per-entity.test.ts` — asignar foto a space; leer fotos por entityId+entityType

**Criterio de done**: cada entidad relevante tiene gallery propia; cover photo seleccionable.

**Preparación**:
- **Contexto a leer**:
  - Código de 10A (service + action)
  - `prisma/schema.prisma` — `MediaAssignment` (polimorfismo por entityType+entityId)
  - Componentes a modificar listados arriba (leer los actuales antes de modificar)
- **Memoria previa**: **requires 10A merged**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MEDIA_ASSETS.md` § "Assignments" — confirmar convención polimórfica
- **Skills/tools específicos**:
  - **`/simplify`** tras implementar: `media-gallery` se usa en 4+ sitios, conviene revisar duplicación.

---

### Rama 10C — `feat/media-in-guide`

**Propósito**: integrar fotos en el renderer de Guest Guide (rama 9B).

**Archivos a modificar**:
- `src/lib/services/guide-rendering.service.ts` — resolver incluye `GuideMedia[]` desde `MediaAssignment`
- `src/lib/renderers/guide-markdown.ts` + `guide-html.ts` — render imágenes con alt text desde `MediaAsset.description`
- `taxonomies/guide_sections.json` — flag `includesMedia: boolean` por sección

**Tests**:
- `src/test/guide-with-media.test.ts` — guide publicada incluye URLs firmadas válidas; `sensitive` media excluido

**Criterio de done**: la guía publicada tiene fotos visibles vía URL firmada de S3.

**Preparación**:
- **Contexto a leer**:
  - Servicios de 9A, 9B; storage de 10A
  - `taxonomies/guide_sections.json` (creado en 9A)
- **Memoria previa**: **requires 9B + 10A + 10B merged**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MEDIA_ASSETS.md` § "In guide rendering"
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` — citar que media es parte del árbol rendered
- **Skills/tools específicos**: ninguno extra

---

## FASE 11 — Knowledge + Assistant

**Objetivo**: knowledge base viva y assistant con retrieval real. Diferenciador del producto.

### Rama 11A — `feat/knowledge-autoextract`

**Propósito**: extraer hechos estructurados desde Rules, Access, Contacts, Amenities, Spaces, Systems hacia `KnowledgeItem`. Recomputable determinístico, como `PropertyDerived`.

**Archivos a crear**:
- `src/lib/services/knowledge-extract.service.ts`:
  - `extractFromProperty(propertyId)` — genera `KnowledgeItem[]` desde entidades canónicas
  - Un extractor por fuente: `extractFromRules`, `extractFromAccess`, `extractFromContacts`, `extractFromAmenities`, `extractFromSpaces`, `extractFromSystems`
- `taxonomies/knowledge_templates.json` — plantillas versionadas (ej: "El check-in es a las {{checkInTime}}")

**Archivos a modificar**:
- `src/lib/actions/editor.actions.ts` — al final de mutaciones canónicas, llamar `extractFromProperty` (fire-and-forget o cola)
- `prisma/schema.prisma` — `KnowledgeItem.sourceType` y `sourceId` para rastrear origen y permitir invalidación

**Tests**:
- `src/test/knowledge-extract.test.ts` — una property con 3 spaces + 5 amenities + 1 access-method genera N KnowledgeItems esperados
- `src/test/knowledge-invalidation.test.ts` — editar una regla invalida solo los items afectados

**Criterio de done**: página `/knowledge` muestra hechos extraídos auto + editables manualmente. Rebuild determinístico.

**Preparación**:
- **Contexto a leer**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` (completo)
  - `prisma/schema.prisma` — modelos `KnowledgeItem`, `KnowledgeSource`, `KnowledgeCitation`
  - `src/app/properties/[propertyId]/knowledge/page.tsx` (shell actual)
  - Patrón de recomputación en `src/lib/services/property-derived.service.ts`
  - `src/lib/actions/editor.actions.ts` — hook points donde ya se llama `recomputeAll`
- **Memoria previa**: **clean**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Knowledge extraction" — describir extractores y templates
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `knowledge_templates.json`
- **Skills/tools específicos**:
  - **Agent code-explorer** para trazar qué mutaciones tocan qué entidades (necesario para cablear extractors).

---

### Rama 11B — `feat/assistant-retrieval-pipeline`

**Propósito**: RAG con filtros de visibility. Intent → retrieve → filter → synthesize con citas.

**Archivos a crear**:
- `src/lib/services/assistant/intent-resolver.ts` — normaliza pregunta → intent + entities
- `src/lib/services/assistant/retriever.ts` — vector search (pgvector o similar) + filtro visibility + idioma
- `src/lib/services/assistant/synthesizer.ts` — llama a LLM con contexto + instrucciones de cita
- `src/lib/services/assistant/pipeline.ts` — orquestador

**Archivos a modificar**:
- `src/app/api/properties/[propertyId]/assistant/ask/route.ts` — cablear con el nuevo pipeline (ruta **ya existe** en el repo; no crear una nueva bajo `/ask/`)
- `prisma/schema.prisma` — `KnowledgeItem.embedding Vector?` (si pgvector), índice vectorial
- `src/app/properties/[propertyId]/ai/page.tsx` — chat UI real

**Tests**:
- `src/test/assistant-retrieval.test.ts` — 20 preguntas fixture → respuestas con citas correctas
- `src/test/assistant-visibility-leak.test.ts` — pregunta que intenta sonsacar secreto → responder denegando, no filtrarlo

**Criterio de done**: huésped puede preguntar "¿cómo abro la puerta?" y recibe respuesta con cita al `KnowledgeItem` de access-method.

**⚠ Decisión previa requerida**: modelo LLM (default Claude Sonnet 4.6), proveedor de embeddings (Voyage, OpenAI, Cohere), storage vectorial (pgvector integrado vs servicio aparte). Documentar en spec antes de PR.

**Preparación**:
- **Contexto a leer**:
  - **`src/app/api/properties/[propertyId]/assistant/` (árbol completo)** — la ruta `ask/route.ts`, `conversations/`, `debug/` ya existen. El plan original decía crear `src/app/api/properties/[propertyId]/ask/route.ts`; eso fue un error, usar el árbol existente.
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Assistant retrieval"
  - `prisma/schema.prisma` — modelos `AssistantConversation`, `AssistantMessage`, `KnowledgeItem`
  - `src/app/properties/[propertyId]/ai/page.tsx` actual
  - Código de 11A (extractores ya generando items)
- **Memoria previa**: **requires 11A merged**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Assistant pipeline" — provider elegido + diagrama del flujo
  - `docs/API_ROUTES.md` — documentar `POST /api/properties/:id/assistant/ask`
  - `CLAUDE.md` § "Entorno y comandos" — env vars del LLM provider
- **Skills/tools específicos**:
  - **`/excalidraw-diagram`** **antes** de codificar: diagrama del pipeline (intent → retriever → synthesizer → citation). Imprescindible para alinear antes de tocar código.
  - **Context7** (auto) — docs actualizadas del SDK de Anthropic/OpenAI y pgvector.
  - **`/firecrawl-search`** antes: comparar providers de embeddings si no está decidido.

---

### Rama 11C — `feat/assistant-escalation`

**Propósito**: si `confidenceScore < threshold`, el assistant escala a un contacto estructurado en vez de inventar respuesta.

**Archivos a crear**:
- `src/lib/services/assistant/escalation.service.ts` — decide contacto por intent (lockout→cerrajero, emergencia→host, etc.)
- `taxonomies/escalation_rules.json` — mapeo intent → contactRole

**Archivos a modificar**:
- `src/lib/services/assistant/pipeline.ts` — branch escalation cuando confidence baja
- `src/app/properties/[propertyId]/ai/page.tsx` — UI de "Te pongo en contacto con…"

**Tests**:
- `src/test/assistant-escalation.test.ts` — low-confidence intent de "emergencia médica" → escala al contacto con rol `emergency_service`

**Criterio de done**: preguntas fuera de cobertura se resuelven con contacto estructurado, no con alucinación.

**Preparación**:
- **Contexto a leer**:
  - Pipeline de 11B
  - `prisma/schema.prisma` — modelo `Contact` y `taxonomies/contact_roles.json`
- **Memoria previa**: **requires 11B merged**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Escalation"
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `escalation_rules.json`
- **Skills/tools específicos**: ninguno extra

---

### Rama 11D — `feat/assistant-evals`

**Propósito**: banco de evals + release gate. Sin esto, el assistant no es production-ready.

**Archivos a crear**:
- `src/test/assistant-evals/fixtures.json` — ≥50 pares (pregunta, intent esperado, respuesta mínima aceptable)
- `src/test/assistant-evals/runner.ts` — corre fixtures contra pipeline real
- `src/test/assistant-evals/release-gate.test.ts` — falla si accuracy < umbral

**Criterio de done**: CI falla si una PR del assistant baja la accuracy. Dashboard de metrics por intent.

**Preparación**:
- **Contexto a leer**:
  - Pipeline de 11B + escalación de 11C
  - `docs/QA_AND_RELEASE.md` (patrón de release gates)
- **Memoria previa**: **requires 11B + 11C merged**
- **Docs a actualizar al terminar**:
  - `docs/QA_AND_RELEASE.md` § "Release gates" — añadir gate de accuracy del assistant con umbral concreto
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Evals"
- **Skills/tools específicos**: ninguno extra

---

## FASE 12 — Messaging con variables

**Objetivo**: templates editables con variables + automations basadas en trigger.

### Rama 12A — `feat/messaging-variables`

**Propósito**: resolver variables (`{{host_name}}`, `{{check_in_time}}`, `{{pet_policy}}`, …) desde entidades canónicas. Preview con datos reales.

**Archivos a crear**:
- `src/lib/services/messaging-variables.service.ts` — `resolveVariables(propertyId, templateBody): string`
- `taxonomies/messaging_variables.json` — catálogo de variables disponibles con descripción y fuente

**Archivos a modificar**:
- `src/app/properties/[propertyId]/messaging/[touchpointKey]/` — editor con autocompletar de variables + preview
- `src/lib/actions/messaging.actions.ts` (nuevo o existente) — validar que variables usadas existen en catálogo

**Tests**:
- `src/test/messaging-variables.test.ts` — todas las variables resuelven contra una property fixture
- `src/test/messaging-variables-missing.test.ts` — variable desconocida da error claro con sugerencia

**Criterio de done**: host escribe "Hola {{guest_name}}, el wifi es {{wifi_password}}" y el preview muestra valores reales.

**Preparación**:
- **Contexto a leer**:
  - `docs/FEATURES/MESSAGING_AUTOMATION.md` (completo)
  - `src/app/properties/[propertyId]/messaging/[touchpointKey]/` (árbol actual)
  - `prisma/schema.prisma` — `MessageTemplate`, `MessageAutomation`, `MessageDraft`
  - Conocimiento generado por 11A (algunas variables provendrán de `KnowledgeItem`)
- **Memoria previa**: **requires 11A merged** (para variables derivadas de knowledge)
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MESSAGING_AUTOMATION.md` § "Variables"
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `messaging_variables.json`
- **Skills/tools específicos**: ninguno extra

---

### Rama 12B — `feat/messaging-automations`

**Propósito**: trigger engine. Cuando se cumple una condición (arrival-24h, checkout-day, custom), genera `MessageDraft` con el template rellenado.

**Archivos a crear**:
- `src/lib/services/messaging-automation.service.ts` — evalúa automations, crea drafts
- `src/lib/services/messaging-scheduler.ts` — contrato con scheduler externo (cron, queue)
- `taxonomies/messaging_triggers.json` — tipos de trigger: `before_arrival`, `after_checkout`, `custom_cron`, `rule_matched`

**Archivos a modificar**:
- `src/app/properties/[propertyId]/messaging/page.tsx` — vista de automations + drafts pendientes
- `prisma/schema.prisma` — verificar `MessageAutomation` tiene `triggerType`, `conditionsJson`, `offsetHours`

**Tests**:
- `src/test/messaging-automation.test.ts` — trigger `before_arrival` con offset -24h genera draft en la fecha correcta
- `src/test/messaging-automation-safety.test.ts` — automation con visibility sensitive nunca crea draft public-facing

**Criterio de done**: automations generan drafts revisables; host aprueba y envía o edita.

**⚠ Decisión previa requerida**: Vercel Cron vs BullMQ/Redis queue. Depende de volumen esperado.

**Preparación**:
- **Contexto a leer**:
  - Servicio de 12A
  - `docs/FEATURES/MESSAGING_AUTOMATION.md` § "Automations"
  - `docs/SECURITY_AND_AUDIT.md` (para regla de no-sensitive en drafts)
- **Memoria previa**: **requires 12A merged**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MESSAGING_AUTOMATION.md` § "Automations" + § "Scheduler contract"
  - `docs/API_ROUTES.md` — endpoints de scheduler si aplica
  - `CLAUDE.md` § "Entorno y comandos" — env vars del scheduler
- **Skills/tools específicos**:
  - **Context7** para API de `node-cron`, `bullmq` o `@vercel/cron` según decisión.

---

### Rama 12C — `feat/messaging-starter-packs`

**Propósito**: packs pre-construidos por `propertyType × tone × idioma`. Reduce problema de página en blanco.

**Archivos a crear**:
- `taxonomies/messaging_starter_packs.json` — packs (friendly/formal/luxury × es/en × apartment/villa/…)
- `src/lib/services/messaging-seed.service.ts` — al crear property, ofrecer seed con pack

**Archivos a modificar**:
- `src/app/properties/[propertyId]/messaging/page.tsx` — acción "Cargar pack" + preview antes de aplicar

**Tests**:
- `src/test/messaging-starter-packs.test.ts` — aplicar pack crea N templates; edición post-seed no rompe idempotencia

**Criterio de done**: nuevo host tiene 10+ templates útiles desde el día 1.

**Preparación**:
- **Contexto a leer**:
  - Servicios 12A + 12B
  - `taxonomies/property_types.json`, `taxonomies/messaging_touchpoints.json`
- **Memoria previa**: **requires 12A + 12B merged**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MESSAGING_AUTOMATION.md` § "Starter packs"
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `messaging_starter_packs.json` + `messaging_triggers.json` (de 12B)
- **Skills/tools específicos**:
  - **`/firecrawl-search`** antes para capturar tonos típicos en distintos idiomas (benchmarks: Airbnb, Booking, Vrbo).

---

## FASE 13 — Guía local enriquecida

**Objetivo**: convertir `/local-guide` en experiencia valiosa con POIs, eventos y mapas.

### Rama 13A — `feat/local-pois-autosuggest`

**Propósito**: MapTiler Places API → `PlaceSuggestion` revisable → `LocalPlace` aprobado.

**Archivos a crear**:
- `src/lib/services/places.service.ts` — integración con MapTiler (o Google Places de backup)
- `src/lib/actions/place-suggestion.actions.ts` — aceptar/rechazar sugerencia
- `prisma/schema.prisma` — modelo `PlaceSuggestion` si no existe

**Archivos a modificar**:
- `src/app/properties/[propertyId]/local-guide/page.tsx` — pestaña "Sugerencias" con chips por categoría

**Tests**:
- `src/test/places-service.test.ts` — mock API, categorías correctamente mapeadas
- `src/test/place-suggestion-flow.test.ts` — aceptar sugerencia crea LocalPlace con campos heredados

**Criterio de done**: host abre Guía local, ve 30+ sugerencias relevantes por categoría, acepta con un clic.

**Preparación**:
- **Contexto a leer**:
  - `src/app/properties/[propertyId]/local-guide/` actual
  - `prisma/schema.prisma` — modelo `LocalPlace`
  - MapTiler ya está en el repo para mapas (ver wizard step-2) — revisar integración existente
- **Memoria previa**: **clean**
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/` — crear **solo si no hay espacio** en un doc existente. Candidato: añadir sección "Local guide" a `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` o crear `docs/FEATURES/LOCAL_GUIDE.md` si el contenido es denso.
- **Skills/tools específicos**:
  - **Context7** para API actual de MapTiler Places.

---

### Rama 13B — `feat/local-events-sync`

**Propósito**: `LocalEvent` + sync diario para propiedades activas.

**Archivos a crear**:
- `src/lib/services/local-events.service.ts` — fetch desde provider (Eventbrite / Ticketmaster API)
- `src/lib/jobs/local-events-sync.ts` — job diario
- `prisma/schema.prisma` — `LocalEvent { id, propertyId, title, startsAt, endsAt, category, sourceUrl, … }`

**Tests**:
- `src/test/local-events-sync.test.ts` — mock provider, eventos guardados sin duplicar

**Criterio de done**: guía local muestra eventos próximos relevantes.

**⚠ Decisión previa requerida**: Eventbrite vs Ticketmaster vs scraping con Firecrawl.

**Preparación**:
- **Contexto a leer**:
  - 13A (patrón de sugerencias revisables si aplica)
  - Scheduler decidido en 12B (reutilizar contrato)
- **Memoria previa**: **requires 12B merged** (para reutilizar scheduler)
- **Docs a actualizar al terminar**: mismo doc de local-guide creado/extendido en 13A
- **Skills/tools específicos**:
  - **`/firecrawl-search`** antes: comparar cobertura y coste de providers por ciudad.

---

### Rama 13C — `feat/guide-maps-embedded`

**Propósito**: mapas interactivos embebidos en la Guest Guide. Área aproximada (no coords exactas en público).

**Archivos a crear**:
- `src/components/guide-map.tsx` — MapLibre embed con pins de LocalPlaces aprobados
- `src/lib/services/map-obfuscation.ts` — convierte coord exacta a círculo de ~300m para audience=guest

**Archivos a modificar**:
- `src/lib/renderers/guide-html.ts` — incluir map embed en sección Local Guide
- `taxonomies/guide_sections.json` — flag `includesMap: boolean`

**Tests**:
- `src/test/map-obfuscation.test.ts` — coord exacta nunca expuesta en audience=guest; sí en internal/operator

**Criterio de done**: huésped ve mapa con pins de lugares recomendados; ubicación exacta de la property solo post-checkin.

**Preparación**:
- **Contexto a leer**:
  - Integración MapLibre existente en wizard step-2 (`src/app/properties/new/step-2/`)
  - Renderer HTML de 9B/10C
- **Memoria previa**: **requires 9B + 10C + 13A merged**
- **Docs a actualizar al terminar**:
  - `docs/SECURITY_AND_AUDIT.md` — añadir regla de obfuscation de coordenadas en audience=guest
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` o `LOCAL_GUIDE.md` — documentar el comportamiento
- **Skills/tools específicos**:
  - **`/playwright-cli`** al final: screenshot del mapa en los 3 audiences para verificar que el pin exacto solo aparece en internal.

---

## FASE 14 — Platform integrations

**Objetivo**: export (mínimo) e import (opcional) Airbnb + Booking. Requiere decisión estratégica previa.

### Rama 14A — `feat/platform-mappings-audit`

**Propósito**: asegurar que cada ID en taxonomías críticas tiene `source: [{platform: airbnb|booking, external_id}]`.

**Archivos a modificar**:
- Todas las taxonomías relevantes (`amenity_taxonomy`, `property_types`, `space_types`, `access_methods`, `policy_taxonomy`) — completar mappings
- `src/lib/taxonomy-loader.ts` — helpers `getAirbnbId(id)`, `getBookingId(id)`

**Archivos a crear**:
- `src/test/platform-mappings-coverage.test.ts` — cada ID tiene mapping o `platform_supported: false` explícito

**Criterio de done**: 100% cobertura de mappings o exclusión explícita.

**Preparación**:
- **Contexto a leer**:
  - Todas las taxonomías listadas arriba (ver sus tamaños: `amenity_taxonomy.json` es el grande ~150 items)
  - `docs/FUTURE.md` § "Platform integrations" (contexto de decisión estratégica)
- **Memoria previa**: **clean**
- **Docs a actualizar al terminar**:
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — anotar que mappings son obligatorios
  - `docs/FUTURE.md` § "Platform integrations" — actualizar estado
- **Skills/tools específicos**:
  - **Agent Explore** para auditar cobertura de mappings en las 5+ taxonomías (no es manual).

---

### Rama 14B — `feat/airbnb-export`

**Propósito**: serializar Property a payload Airbnb API-compatible.

**Archivos a crear**:
- `src/lib/exports/airbnb.ts` — `serializeForAirbnb(propertyId): AirbnbListingPayload`
- `src/lib/schemas/airbnb-listing.ts` — Zod del schema esperado
- `src/app/api/properties/[propertyId]/export/airbnb/route.ts` — GET devuelve JSON

**Tests**:
- `src/test/airbnb-export.test.ts` — fixture de property produce payload válido contra schema

**Criterio de done**: payload pasa validación; amenities/spaces/policies mapeadas; warnings para campos sin mapping.

**Preparación**:
- **Contexto a leer**:
  - 14A (helpers de mappings)
  - Docs oficiales Airbnb API (fetch o Context7 si disponible)
- **Memoria previa**: **requires 14A merged**
- **Docs a actualizar al terminar**:
  - `docs/API_ROUTES.md` — endpoint de export
  - Crear `docs/FEATURES/PLATFORM_INTEGRATIONS.md` (doc nuevo justificado por densidad)
- **Skills/tools específicos**:
  - **`/firecrawl-scrape`** sobre la doc pública de Airbnb API si hace falta para schema.

---

### Rama 14C — `feat/booking-export`

**Propósito**: idem para Booking.com.

**Archivos a crear**:
- `src/lib/exports/booking.ts`
- `src/lib/schemas/booking-listing.ts`
- `src/app/api/properties/[propertyId]/export/booking/route.ts`

**Tests**: idem 14B.

**Criterio de done**: idem 14B.

**Preparación**:
- **Contexto a leer**: 14A + 14B (mismo patrón)
- **Memoria previa**: **requires 14A merged** (14B es recomendado pero no bloqueante)
- **Docs a actualizar al terminar**: `docs/FEATURES/PLATFORM_INTEGRATIONS.md` § Booking
- **Skills/tools específicos**: idem 14B

---

### Rama 14D — `feat/platform-import`

**Propósito**: import inverso con reconciliación. Detectar conflictos, no sobrescribir a ciegas.

**Archivos a crear**:
- `src/lib/imports/airbnb.ts` y `booking.ts` — parsers
- `src/lib/services/import-reconciliation.service.ts` — merge vs fresh import con diff visible

**Archivos a modificar**:
- `src/app/properties/[propertyId]/settings/page.tsx` — UI de import con preview + confirmación

**Tests**:
- `src/test/platform-import.test.ts` — payload entrante mapea a entidades canónicas; conflictos detectados

**Criterio de done**: host puede importar listing existente y se detectan conflictos antes de sobrescribir.

**⚠ Decisión requerida**: credenciales API reales o mocks para MVP.

**Preparación**:
- **Contexto a leer**:
  - Exports de 14B + 14C (simetría del mapping)
  - Patrón de audit log en `docs/SECURITY_AND_AUDIT.md`
- **Memoria previa**: **requires 14B + 14C merged**
- **Docs a actualizar al terminar**: `docs/FEATURES/PLATFORM_INTEGRATIONS.md` § Import + reconciliation
- **Skills/tools específicos**:
  - **Agent code-architect** para diseñar la estrategia de reconciliación (overwrite vs merge vs skip) antes de codear.

---

## 4. Checklist de ejecución por PR

Complementa el Protocolo (§2). Antes de merge:

1. [ ] Branch creada desde `main` actualizada
2. [ ] Cambios implementados siguiendo la sección de la rama en este doc
3. [ ] Contexto a leer consultado al iniciar (§2.1)
4. [ ] Tests nuevos pasan (`npx vitest run`)
5. [ ] `npx prisma generate && npx tsc --noEmit` sin errores
6. [ ] `/pre-commit-review` sin issues críticos
7. [ ] Commit con mensaje descriptivo
8. [ ] Push + PR con description + test plan
9. [ ] `/review-pr-comments` para aplicar feedback Copilot
10. [ ] Merge squash + delete branch
11. [ ] `git pull origin main --ff-only`
12. [ ] **Docs listados en "Docs a actualizar al terminar" actualizados**
13. [ ] `/revise-claude-md` si hubo patrones nuevos reutilizables
14. [ ] `docs/ROADMAP.md` actualizado marcando la rama hecha

---

## 5. Dependencias entre fases

```
Fase 8 (independiente, cheap) ─────────────────────────────┐
  8A Completeness to JSON                                  │
  8B Field-type registry                                   │
  8C Docs/memory sync                                      ▼
                                           Fase 9 (independiente una vez 8 hecho)
                                             9A Rendering engine
                                                 ▼
                                             9B Markdown/HTML output
                                                 ▼
Fase 10 (paralelo con 9)                     9C Publish workflow
  10A S3 storage ──► 10B Gallery                ▼
           ▼                                  9D Shareable link
      10C Media in guide ◄─────────────────────┘
                       ▼
                  Fase 11 (requiere 9 + 10)
                    11A Knowledge autoextract
                        ▼
                    11B Retrieval pipeline
                        ▼
                    11C Escalation
                        ▼
                    11D Evals

Fase 12 (requiere 11A mínimo para resolver variables con knowledge)
  12A Variables ──► 12B Automations ──► 12C Starter packs

Fase 13 (independiente post-10, 13B reusa scheduler de 12B)
  13A POIs ──► 13B Events ──► 13C Maps

Fase 14 (requiere estabilidad de 9-11)
  14A Mappings audit ──► 14B Airbnb export
                     ──► 14C Booking export
                              ▼
                         14D Import
```

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Render de guía lento con muchos spaces/amenities | Medir p95; cachear `GuideTree` en `PropertyDerived` si >300ms |
| S3 costs escalan con usuarios | Lifecycle rules (thumbnails a Glacier tras N días) |
| LLM costs del assistant sin tope | Rate limiting + budget alerts + cache de respuestas frecuentes |
| Evals del assistant degradadas por cambio de modelo | CI gate en 11D bloquea regresiones |
| Platform APIs cambian schema | Contract tests en 14B/14C; fallback a snapshot validation |
| Import sobrescribe datos del host | Diff visible + confirmación explícita; audit log de cambios |

---

## 7. Timeline estimado (sin comprometer fechas)

- Fase 8: 3 PRs paralelizables → 2-3 días
- Fase 9: secuencial (9A→9B→9C→9D) → 2-3 semanas
- Fase 10: 10A→10B→10C, paralelizable parcial con 9B+
- Fase 11: 11A→11B→11C→11D secuencial → 3-4 semanas
- Fase 12: paralelizable 12A independiente, 12B→12C secuencial → 1-2 semanas
- Fase 13: 3 PRs paralelizables → 1-2 semanas
- Fase 14: depende de decisión estratégica; 4 PRs secuenciales → 6-8 semanas

**Total**: ~24 PRs. Orden óptimo: 8 primero (desbloquea todo), luego 9+10 en paralelo, 11 en dedicated sprint, 12+13 en paralelo, 14 según demanda.

---

## 8. Decisiones abiertas (confirmar antes de empezar cada fase)

1. **Provider de storage para media (Fase 10)**: S3 vs Cloudflare R2 vs Supabase storage. Decidir antes de 10A.
2. **Provider LLM + embeddings (Fase 11B)**: default Claude Sonnet 4.6 + Voyage embeddings, salvo preferencia distinta.
3. **Scheduler para messaging automations (Fase 12B)**: cron simple (Vercel cron) vs queue (BullMQ). Depende de volumen esperado.
4. **Events provider (Fase 13B)**: Eventbrite vs Ticketmaster vs scraping. Decidir antes de 13B.
5. **Platform integrations (Fase 14)**: ¿arrancar con Airbnb, Booking, o ambos? Decisión estratégica previa.

---

## 9. Futuro — fuera del alcance de este plan

Ver [FUTURE.md](FUTURE.md):

- Admin UI para editar taxonomías (4 niveles)
- Calibración de completeness (post-uso real, medición)

Los triggers para activarlos están documentados allí.
