# Plan maestro V2 — Outputs, Intelligence & Integrations

Versión: 2026-04-17 (rev. 3 — research integration: Fase 10 expandida a 8 ramas, Fase 11 expandida a 6 ramas, Fase 13 añade issue-reporting)
Continuación de: [archive/v1-master-plan-executed.md](archive/v1-master-plan-executed.md) (fases 1A–7B completadas)
Alcance: 7 fases, 32 ramas, ~32 PRs independientes y revisables

Este documento es **fuente de verdad ejecutable y viva**. Antes de cada rama, leer su sección entera y seguir el **Protocolo de ejecución por rama**. Las actualizaciones al plan se hacen en PRs aparte y auditadas (ver §2.10).

**Fuentes de investigación que alimentan este plan (commit-frozen para poder referenciar por línea):**
- [docs/research/GUEST_GUIDE_SPEC.md](research/GUEST_GUIDE_SPEC.md) — journey map, arquitectura de información, UX patterns, design system, interactividad, métricas.
- [docs/research/AI_KNOWLEDGE_BASE_SPEC.md](research/AI_KNOWLEDGE_BASE_SPEC.md) — esquema AI context, chunking RAG, contextual retrieval, prompt templates, campos críticos del modelo.
- [docs/research/IMPLEMENTATION_PLAN.md](research/IMPLEMENTATION_PLAN.md) — benchmark competitivo, stack recomendado, caching, media URL strategy, roadmap por impacto/esfuerzo.

Para arranque rápido de sesión ver [HANDOFF.md](HANDOFF.md).

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

Cada una de las 32 ramas sigue este ciclo. Las herramientas listadas aquí son el **default**. Cada rama solo cita herramientas *extra* específicas. Referencias a herramientas: ver `docs/archive/global-skills-reference.md` para qué hace cada una.

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
3. **Opcional** — `/firecrawl-search "<tema>"` si la rama implica decisiones de UX/dominio donde hay best practices externas relevantes.
4. **Opcional** — `/excalidraw-diagram` si la rama requiere diseño visual previo (ej: 9A rendering tree, 11B pipeline assistant).
5. **Opcional** — `Agent Plan` si la arquitectura interna de la rama tiene múltiples caminos razonables.

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
5. Si durante la rama se descubrieron gaps del plan, seguir §2.10.
6. **Gestión de memoria** — seguir §2.9.
7. **Prompt de continuación** — seguir §2.9, paso 4.

### 2.9 Gestión de memoria y transición entre ramas

**Principio**: cada rama = conversación nueva con contexto limpio. El ruido acumulado de una rama (reviews, fixes, debugging) es contraproducente para la siguiente.

#### Estrategia de MEMORY.md

MEMORY.md se **actualiza incrementalmente**, nunca se borra y recrea. Las memorias tienen distinta vida útil:

| Tipo | Vida útil | Cuándo actualizar |
| --- | --- | --- |
| `user` | Larga — preferencias y perfil del usuario | Rara vez; solo si cambia el rol o preferencias |
| `feedback` | Larga — guía de comportamiento validada | Solo si se invalida por cambio de convención |
| `project` | Corta — estado de trabajo en curso | **Cada merge**: marcar rama completada, eliminar WIP |
| `reference` | Media — punteros a sistemas externos | Cuando el sistema externo cambia |

#### Protocolo post-merge (antes de cerrar la conversación)

1. **Actualizar memorias `project`**: marcar la rama como completada en `project_master_plan_v2_progress.md`. Eliminar entradas de trabajo en curso que ya no apliquen.
2. **Guardar descubrimientos no obvios**: si la rama reveló patrones, gotchas o decisiones que NO quedaron en CLAUDE.md ni en docs, guardarlos como memoria `feedback` o `project`.
3. **No guardar lo derivable**: si ya está en el código, git log, CLAUDE.md o docs del repo, no duplicar en memoria.
4. **Generar prompt de continuación**: Claude analiza on-demand qué necesita la siguiente rama (lee su sección del plan, evalúa si hay contexto no persistido en la conversación actual, revisa dependencias) y produce un bloque de texto listo para copiar-pegar. El prompt debe incluir la instrucción de contexto adecuada:

```text
Continúa con docs/MASTER_PLAN_V2.md.
Acabamos de mergear: ✅ [rama completada] (PR #N).
La siguiente es Rama XY `nombre-de-rama`.
[instrucción de contexto — ver reglas abajo]
Ejecuta el protocolo §2.1 Fase -1 completo.
```

#### Decisión de contexto (on-demand, no per-branch)

Claude elige la instrucción de contexto al generar el prompt, basándose en el estado real de la conversación y la memoria — no en un campo estático del plan. Reglas de decisión:

1. **`/clear`** (default) → si todo el contexto relevante ya está persistido en MEMORY.md, CLAUDE.md y docs del repo. MEMORY.md + CLAUDE.md se cargan automáticamente en la nueva conversación. Es el caso más común: el código de la rama anterior ya está en `main`, los docs están actualizados, la memoria refleja el progreso.
2. **`/compact`** → si la conversación actual contiene contexto crítico que aún no está en memoria ni docs y no es práctico persistirlo (ej: acabamos de hacer la Fase -1 de la siguiente rama en esta misma conversación y las decisiones aún no se han guardado). El prompt debe explicar qué contexto se preserva y por qué.
3. **`/clear` + verificar memories** → si hay memorias `project` que podrían estar stale tras el merge (ej: la rama cambió algo que una memoria asume). Incluir en el prompt: "Antes de actuar, verifica que [entry] sigue vigente."

En la práctica, >90% de las transiciones serán `/clear`. `/compact` es la excepción para cuando la conversación fue inusualmente larga y hubo decisiones intermedias no guardadas.

### 2.10 Actualización auditada del plan

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
| 10 | Media + Guide Renderer + PWA | 8 | Medio | Alto | Sí (storage, media URLs) |
| 11 | Knowledge + Assistant + i18n | 6 | Alto | Alto | No |
| 12 | Messaging con variables | 3 | Medio | Alto | No |
| 13 | Guía local + issue reporting | 4 | Bajo | Medio | No |
| 14 | Platform integrations | 4 | Alto | Alto | Posible |

**Total**: 32 ramas (8 ✅ completadas hasta 10B + refactor/shared-action-result; 24 pendientes).

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
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § 13 — concretar el renderer con referencia al nuevo servicio
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `guide_sections.json` y sección de resiliencia del guide engine
- **Skills/tools específicos**:
  - **`/excalidraw-diagram`** **antes** de codificar: diagrama del `GuideTree` (secciones → items → media, flags de visibility por nodo, flujo audience-filter). Committed en `docs/diagrams/guide-tree.excalidraw`.

---

### Rama 9B — `feat/guide-markdown-output`

**Propósito**: renderers que convierten `GuideTree` a markdown, HTML estructurado y PDF. Soporta audience toggle (guest/ai/internal). Todos los formatos incluyen `generatedAt` para auditoría.

**Archivos a crear**:
- `src/lib/renderers/guide-html.ts` — `renderHtml(tree): string` con escape manual (`&<>"'`) — zero-dep, nunca emite HTML arbitrario desde values
- `src/lib/renderers/guide-pdf.tsx` — `renderPdf(tree): Promise<Buffer>` vía `@react-pdf/renderer` (server-side, sin headless browser)
- `src/app/api/properties/[propertyId]/guide/route.ts` — `GET ?audience=guest|ai|internal&format=md|html|json|pdf`. Auth gating diferido (sin sistema de auth aún); todas las audiences accesibles públicamente hasta que se implemente autenticación.
- `src/components/guide-preview.tsx` — client component con selector audience (3) + format (md/html/json); PDF se expone como link de descarga directa

**Archivos a modificar**:
- `src/lib/renderers/guide-markdown.ts` — expandir stub de 9A: media como `![caption](url)`, children de items, header con `generatedAt`. Preservar estructura base (snapshots de 9A siguen válidos salvo header).
- `src/app/properties/[propertyId]/guest-guide/page.tsx` — añadir `<GuidePreview />` encima del bloque draft/published (coexistencia con versionado; 9C rediseña)

**Tests**:
- `src/test/guide-markdown.test.ts` — expansión: media, children, generatedAt
- `src/test/guide-html-sanitization.test.ts` — HTML escapado correctamente, `<script>` y atributos event se neutralizan
- `src/test/guide-api-route.test.ts` — smoke del endpoint: 200 con cada format, 400 con audience/format inválido, Content-Type correcto

**Criterio de done**: el endpoint `GET /api/properties/:id/guide?audience=guest&format=md` devuelve markdown sanitizado listo para publicar. PDF descargable desde el preview.

**Preparación**:
- **Contexto a leer**:
  - El servicio creado en 9A (`src/lib/services/guide-rendering.service.ts`) y sus tipos
  - `src/app/properties/[propertyId]/guest-guide/page.tsx` actual (shell)
  - `docs/API_ROUTES.md` (patrón de rutas y error shape)
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
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Publishing workflow"
  - `docs/ARCHITECTURE_OVERVIEW.md` § 6 "Derived layers" — citar `GuideVersion.treeJson` como snapshot inmutable
- **Skills/tools específicos**:
  - **Agent code-architect** si hay duda sobre esquema del diff (granularidad sección vs item).

---

### Rama 9D — `feat/guide-shareable-link`

**Propósito**: link público compartible por propiedad (sin auth) con filtro `guest`-only. El host envía un solo link estable que siempre apunta a la última versión publicada.

**Decisiones cerradas en Fase -1 (2026-04-16)**:
- Slug en `Property` (no en `GuideVersion`) — un link estable por propiedad, siempre resuelve a la versión publicada activa.
- Si no hay versión publicada → página amigable ("guía no disponible"), no 404.
- QR incluido en esta rama (lib ligera `qrcode`, SVG output).
- `NEXT_PUBLIC_BASE_URL` env var para construir link completo copiable.
- Renderizado server-side con `renderHtml()` embebido — permite og:title/og:description para previews en WhatsApp/iMessage.

**Archivos a crear**:
- `src/app/g/[slug]/page.tsx` — ruta pública, fuera de AppShell, audience=guest forzado sobre treeJson
- `src/app/g/[slug]/not-available.tsx` — componente "guía no disponible" (sin versión publicada)
- `src/lib/services/guide-slug.service.ts` — `generateSlug(): string`, `ensurePropertySlug(propertyId): string` (retry en colisión P2002)

**Archivos a modificar**:
- `prisma/schema.prisma` — `Property.publicSlug String? @unique`
- `src/app/properties/[propertyId]/publishing/page.tsx` — sección con link compartible + botón copiar + QR
- `src/lib/actions/guide.actions.ts` — `publishGuideVersionAction` llama a `ensurePropertySlug` al publicar

**Tests**:
- `src/test/guide-public-render.test.ts` — versión publicada accesible sin auth; `sensitive` nunca aparece; `internal` tampoco
- `src/test/guide-slug-collision.test.ts` — generación retry-safe

**Criterio de done**: host copia un link, se lo manda al huésped, el huésped ve la guía sin cuenta.

**Preparación**:
- **Contexto a leer**:
  - Configuración de rutas públicas en Next.js — si hay otras rutas sin auth en el repo, ver el patrón (`src/app/` buscar `layout.tsx` con auth guard para ver dónde aplica)
  - `docs/SECURITY_AND_AUDIT.md` (completo)
  - Código de 9B y 9C
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § 5 "Route map" — añadir `/g/:slug` como ruta pública
  - `docs/SECURITY_AND_AUDIT.md` — concretar regla de que `/g/*` siempre fuerza audience=guest
- **Skills/tools específicos**:
  - **`/playwright-cli`** al final: verificar que el link público abre correctamente sin sesión y que los campos `sensitive`/`internal` no aparecen en el DOM.

---

## FASE 10 — Media real

**Objetivo**: habilitar uploads reales. Sin fotos, la Guest Guide vale a medias.

### Rama 10A — `feat/media-storage`

**Propósito**: integración con Cloudflare R2 (S3-compatible) + presigned URLs + blurhash.

**Decisiones cerradas en Fase -1 (2026-04-16)**:
- **Provider**: Cloudflare R2 (egress gratis, S3-compatible API via `@aws-sdk/*`).
- **mimeTypes permitidos**: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`, `video/mp4`.
- **Tamaño máximo**: 10MB imágenes, 100MB vídeo.
- **Key structure**: `{propertyId}/{assetId}/{originalFileName}`.
- **Upload**: presigned PUT URL (browser → R2 directo, sin pasar por server).
- **Blurhash**: generar en `confirmUploadAction` para lazy-loading en guía pública.
- **Resize/optimization**: diferido a rama separada post-10A (ver ROADMAP.md § Futuro diferido).

**Archivos a crear**:
- `src/lib/services/media-storage.service.ts` — `getUploadUrl`, `getDownloadUrl`, `deleteObject`
- `src/lib/actions/media.actions.ts` — server actions wrapping presigned URLs
- Variables de entorno: `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

**Archivos a modificar**:
- `prisma/schema.prisma` — `MediaAsset` + `sizeBytes Int?` + `blurhash String?`
- No hay UI de upload en esta rama (viene en 10B)

**Tests**:
- `src/test/media-storage.test.ts` — mock S3 client, verificar flujo presigned
- `src/test/media-upload-action.test.ts` — action retorna URL válida; error si mimeType no permitido

**Criterio de done**: server actions crean asset + presigned URL; confirmar upload genera blurhash; delete limpia R2 + DB. Tests pasan.

**Preparación**:
- **Contexto a leer**:
  - `docs/FEATURES/MEDIA_ASSETS.md` (completo)
  - `prisma/schema.prisma` — modelos `MediaAsset`, `MediaAssignment`
  - `src/app/properties/[propertyId]/media/page.tsx` y `create-media-form.tsx` actuales
  - `.env.example` si existe (para ver convención de env vars)
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MEDIA_ASSETS.md` — añadir sección "Storage provider" con provider elegido, bucket, IAM policy de referencia
  - `CLAUDE.md` § "Entorno y comandos" — añadir env vars requeridas para dev local
- **Skills/tools específicos**:
  - **Context7** (auto) — imprescindible para ver API actual de `@aws-sdk/client-s3` o `@aws-sdk/s3-presigned-post`.
  - **`/firecrawl-search`** antes: comparar costes S3 vs R2 vs Supabase si no está decidido.

---

### Rama 10B — `feat/media-per-entity`

**Propósito**: gallery por entidad con upload real (drag & drop, multi-archivo, presigned URL → R2). Consume `MediaAssignment` ya modelado. Soporta reordenación drag & drop y cover photo por entidad.

**Decisiones acordadas en Fase -1**:

- **entityTypes soportados**: `property`, `space`, `access_method`, `amenity_instance`, `system`. `local_place` se añade en fase 13 cuando exista la entidad.
- **Cover photo**: vía `usageKey = "cover"` en `MediaAssignment` (max 1 por entidad, validado en action).
- **Legacy cleanup**: eliminar `createMediaAssetAction` de `editor.actions.ts`; migrar `create-media-form.tsx` al flujo `requestUploadAction` → presigned PUT → `confirmUploadAction` de `media.actions.ts`.
- **Gallery como componente portátil**: diseñado para reubicarse fácilmente (e.g. futuro guide builder interactivo).
- **Reorder incluido**: drag & drop para reordenar thumbnails en la gallery.
- **Upload múltiple**: batch upload (arrastrar N archivos, subida en paralelo).

**Schema** (Prisma):

- Añadir `@@unique([mediaAssetId, entityType, entityId])` a `MediaAssignment`

**Archivos a modificar**:

- `prisma/schema.prisma` — unique constraint en `MediaAssignment`
- `src/lib/actions/media.actions.ts` — nuevas actions: `assignMediaAction`, `unassignMediaAction`, `reorderMediaAction`, `setCoverAction`, `getEntityMediaAction`
- `src/lib/actions/editor.actions.ts` — eliminar `createMediaAssetAction` (legacy)
- `src/app/properties/[propertyId]/media/page.tsx` — vista global agrupada por entidad + upload real
- `src/app/properties/[propertyId]/media/create-media-form.tsx` — reemplazar con `UploadDropzone` real
- `src/app/properties/[propertyId]/spaces/space-card.tsx` — sección "Fotos (N)" colapsable con `EntityGallery`
- `src/app/properties/[propertyId]/access/access-form.tsx` — `EntityGallery` por método de acceso
- `src/app/properties/[propertyId]/amenities/amenity-detail-panel.tsx` — `EntityGallery` por amenity instance

**Archivos a crear**:

- `src/components/media/entity-gallery.tsx` — gallery reutilizable (portátil) con upload inline, reorder, cover
- `src/components/media/media-thumbnail.tsx` — thumbnail con fallback visual, acciones (delete, set cover)
- `src/components/media/upload-dropzone.tsx` — drag & drop multi-archivo, presigned flow completo

**Tests**:

- `src/test/media-per-entity.test.ts` — CRUD assignments: assign, unassign, reorder, set cover, unicidad, entityType validation

**Criterio de done**: cada entidad relevante tiene gallery propia con upload real; cover photo seleccionable; reordenación funcional; upload múltiple; vista global agrupada.

**Preparación**:
- **Contexto a leer**:
  - Código de 10A (service + action)
  - `prisma/schema.prisma` — `MediaAssignment` (polimorfismo por entityType+entityId)
  - Componentes a modificar listados arriba (leer los actuales antes de modificar)
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MEDIA_ASSETS.md` § "Assignments" — confirmar convención polimórfica + entityTypes + cover
- **Skills/tools específicos**:
  - **`/simplify`** tras implementar: `entity-gallery` se usa en 4+ sitios, conviene revisar duplicación.

---

### Rama 10C — `feat/media-in-guide`

**Propósito**: poblar `GuideItem.media[]` (hoy siempre `[]`) con assets reales por entidad y renderizar `<figure>` en markdown/HTML. La ruta estable `/g/:slug/media/:assetId-:hashPrefix/:variant` ya la proporciona 10D — 10C **nunca** emite URLs presignadas (invariante en `guide-rendering-proxy-urls.test.ts`).

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- **Variante por defecto en 10C**: `md` (800 px) únicamente. La multi-variante para galería con lightbox se implementa en 10E (React renderer).
- **Entidades con media**: `property` (cover → primer item de Llegada), `space` (items del resolver `spaces`), `PropertyAmenityInstance` (items del resolver `amenities`), `access_method` (cuando `property.primaryAccessMethod` tiene assignments sobre la clave de taxonomía correspondiente).
- **Filtro por role**: todos los assets con `status="ready"` y `MediaAsset.visibility` compatible con la audiencia, ordenados por `MediaAssignment.sortOrder`. El renderer decide el cap visual (máx 3 por item en markdown para no saturar).
- **Caption**: `MediaAsset.caption` como fuente única; sin fallback (figcaption omitido si está vacío).
- **`alt` derivado** (mejora C): si `caption` está vacío, se computa `alt` a partir de `assetRoleKey` + entity label ("Cover de Cocina") para no romper accesibilidad WCAG.
- **`variants`** (mejora B): `GuideMedia` incluye `variants: { thumb, md, full }` en todas las URLs desde 10C. Coste en `treeJson` (~3× tamaño del bloque media), pero 10E/10H (PWA) y cualquier consumidor srcset lo reutilizan sin recomputar.
- **Flag `includesMedia` en secciones**: `arrival`, `spaces`, `amenities`, `local` → `true`; `rules`, `contacts`, `emergency` → `false`. El batch loader omite las secciones con `includesMedia:false` para evitar cargar assignments que no se van a renderizar.

**Archivos a crear**:
- `src/lib/services/guide-media.service.ts` — `loadEntityMedia(propertyId, audience, entityRefs)` → `Map<entityKey, GuideMedia[]>`. Una sola query batch `findMany` sobre `MediaAssignment` con `IN` (entityIds), filtra por `visibility` y `status="ready"`, ordena por `sortOrder`. Construye las URLs con `buildMediaProxyUrl()` para las tres variantes.
- `src/test/guide-with-media.test.ts` — items con assignments tienen `media[]` no vacío; assets con `visibility > audience` excluidos; URLs siempre `/g/:slug/media/...` con las 3 variantes.
- `src/test/guide-media-batch.test.ts` — una sola query para todos los entityIds de la guía (no N+1).
- `src/test/guide-markdown-media.test.ts` — markdown emite `<figure>` con alt derivado, cap de 3 imágenes por item, ruta `/md` por defecto.

**Archivos a modificar**:
- `src/lib/services/guide-rendering.service.ts` — `loadGuideContext` invoca `loadEntityMedia` para el conjunto de entityIds detectados; resolvers de `arrival / spaces / amenities / local` leen el mapa y pueblan `GuideItem.media`. Resolver de `arrival` adjunta cover de `property` al primer item (checkin o access).
- `src/lib/renderers/guide-markdown.ts` + `guide-html.ts` — al renderizar un `GuideItem` con `media.length > 0`, emitir `<figure>…<figcaption>…</figcaption></figure>` (HTML) / `![alt](url) *caption*` (markdown), usando `variants.md` por defecto. Cap de 3 por item.
- `src/lib/types/guide-tree.ts` — `GuideMedia` pasa de `{ url, role?, caption? }` a `{ assetId, variants: { thumb, md, full }, alt, caption?, role?, mimeType }`.
- `taxonomies/guide_sections.json` — añadir `"includesMedia": boolean` por sección.
- `src/lib/taxonomy-loader.ts` — ampliar Zod de `guide_sections.json` con `includesMedia`.
- `src/test/guide-rendering-proxy-urls.test.ts` — ahora con assignments reales, asegura que las URLs son proxy estables (`/g/*/media/*`) para las 3 variantes y nunca `r2.cloudflarestorage.com`.

**Sin cambios de schema Prisma**. `MediaAsset` y `MediaAssignment` ya existen (10A/10B).

**Criterio de done**: guía publicada con assignments emite items con `media[]` conteniendo las 3 variantes proxy; markdown/HTML muestra `<figure>` con `md`; test `guide-rendering-proxy-urls.test.ts` sigue en verde (0 URLs presignadas).

**Preparación**:
- **Contexto a leer**:
  - Servicios de 9A, 9B; storage de 10A/10B; proxy de 10D (`buildMediaProxyUrl`, `resolvePublicAsset`).
  - `src/lib/services/media-proxy.service.ts`, `src/lib/types/media-variant.ts`.
  - `taxonomies/guide_sections.json`.
  - Invariantes en `src/test/guide-rendering-proxy-urls.test.ts`.
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MEDIA_ASSETS.md` § "In guide rendering" — contract de `GuideMedia`, variante por defecto, cap por renderer.
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` — media es parte del árbol rendered; variante `md` para huésped.
  - `CLAUDE.md` § "Patrones de Sistemas" — regla del cap de 3 imágenes en markdown/HTML (galería multi-variante llega con 10E).
- **Skills/tools específicos**: Defaults §2 (`/pre-commit-review`, `/simplify`, `/review-pr-comments`, `/revise-claude-md`).

---

### Rama 10D — `feat/guide-media-proxy`

**Propósito**: introducir una ruta estable `/g/:slug/media/:assetId/:variant` que desacopla el HTML cacheado del ciclo de vida de las URLs presignadas de R2. Sin esto, cualquier guía renderizada por ISR/CDN explotará al caducar la firma (típicamente 1h). Es **pre-requisito arquitectónico** de 10E (renderer) y de 10H (PWA cache offline).

**Motivación** (research):
- [IMPLEMENTATION_PLAN.md:L68-L92](research/IMPLEMENTATION_PLAN.md#L68-L92) — "No incrustes URLs presignadas de S3/R2 de 1 hora directamente en HTML prerenderizado si ese HTML va a vivir días o semanas en caché. Te explotará en la cara justo cuando el huésped abra la guía desde el tren."
- [GUEST_GUIDE_SPEC.md:L94-L102](research/GUEST_GUIDE_SPEC.md#L94-L102) — reglas de seguridad: no publicar contenido sensible en HTML estático.
- La deuda latente existe hoy en 9D/10C: el resolver de media produce URLs firmadas que se serializan en `GuideVersion.treeJson`.

**Decisiones a cerrar en Fase -1**:
- Variantes soportadas: mínimo `thumb` (256px), `md` (800px), `full` (original). ¿`avif` on-the-fly o pre-generado en 10A/10B?
- Estrategia de transformación: Sharp en-Node (server action) vs Cloudflare Image Resizing vs diferido a rama separada post-10H.
- Cache header: `Cache-Control: public, max-age=31536000, immutable` + ETag por `contentHash` de `MediaAsset`.
- Autorización: asset público si el `MediaAssignment` pertenece a una `Property` con `publicSlug` y hay `GuideVersion.status = published`; de lo contrario 404.
- Fallback cuando la variante no existe: stream del original con warning de log, no 404.

**Archivos a crear**:
- `src/app/g/[slug]/media/[assetId]/[variant]/route.ts` — GET handler, valida slug+asset, resuelve object key, stream del binario con cache headers.
- `src/lib/services/media-proxy.service.ts` — `resolvePublicAsset(slug, assetId)`, `getVariantStream(asset, variant)`, `buildCacheHeaders(contentHash, variant)`.
- `src/lib/services/media-variants.service.ts` — generación on-demand o retrieval de variante pre-generada.
- `src/lib/types/media-variant.ts` — enum `MediaVariantKey` + mapeo a dimensiones.

**Archivos a modificar**:
- `src/lib/services/guide-rendering.service.ts` — emitir rutas proxy relativas (`/g/{slug}/media/{assetId}/{variant}`), **nunca** URLs firmadas.
- `src/lib/renderers/guide-markdown.ts` + `guide-html.ts` — consumir las nuevas rutas estables.
- `prisma/schema.prisma` — `MediaAsset.contentHash String?` si no existe aún (para ETag y cache busting).
- `src/app/g/[slug]/page.tsx` — pasar `slug` al renderer para que pueda construir URLs relativas.

**Tests**:
- `src/test/media-proxy-route.test.ts` — 200 con variantes válidas, 404 si slug no publicado, 404 si asset no asignado a esa property, Content-Type correcto, ETag presente.
- `src/test/media-proxy-cache.test.ts` — headers `Cache-Control immutable` + ETag estable para contentHash.
- `src/test/media-proxy-auth.test.ts` — asset de property sin `publicSlug` nunca sirve.
- `src/test/guide-rendering-proxy-urls.test.ts` — `composeGuide` nunca emite `https://*.r2.cloudflarestorage.com` ni `X-Amz-*`.

**Criterio de done**: guía publicada sirve media por ruta estable; las URLs presignadas de R2 no aparecen nunca en HTML/markdown cacheado; cache hit por CDN verificado con un ciclo de 25h simulado (sin romperse al caducar firma original).

**Preparación**:
- **Contexto a leer**:
  - [docs/research/IMPLEMENTATION_PLAN.md:L68-L106](research/IMPLEMENTATION_PLAN.md) — media caching strategy + offline tiers.
  - [docs/research/GUEST_GUIDE_SPEC.md:L94-L102](research/GUEST_GUIDE_SPEC.md) — seguridad de accesos y datos sensibles.
  - `src/lib/services/media-storage.service.ts` (10A) y `src/lib/services/guide-rendering.service.ts` (9A).
  - `src/app/g/[slug]/page.tsx` (9D).
  - `prisma/schema.prisma` — `MediaAsset`, `MediaAssignment`, `GuideVersion`.
  - `docs/FEATURES/MEDIA_ASSETS.md` (completo).
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/MEDIA_ASSETS.md` § "Public media proxy" — ruta, variantes, cache policy.
  - `docs/ARCHITECTURE_OVERVIEW.md` § 5 "Route map" — añadir `/g/:slug/media/:assetId/:variant`.
  - `docs/SECURITY_AND_AUDIT.md` — regla "never embed presigned URLs in cacheable HTML".
  - `CLAUDE.md` § "Patrones de Sistemas" — nota sobre media proxy.
- **Skills/tools específicos**:
  - Defaults §2: `/pre-commit-review`, `/simplify`, `/review-pr-comments`, `/revise-claude-md`.
  - **Context7** (auto) — `@aws-sdk/client-s3` (`GetObjectCommand` streaming), `next/cache` (cache headers en App Router), `next/server` (`NextResponse` streaming).
  - **`/firecrawl-search`** antes — "image proxy stable url presigned S3 caching", "next.js app router stream response".
  - **`/playwright-cli`** al final — verificar que `<img>` en `/g/:slug` carga sin 403 tras 2h.
  - **Agent code-architect** — decidir entre Sharp in-Node vs Cloudflare Image Resizing si la decisión no quedó cerrada en Fase -1.

---

### Rama 10E — `feat/guide-react-renderer`

**Propósito**: reemplazar `renderHtml()` + `dangerouslySetInnerHTML` en la ruta pública `/g/:slug` con un **renderer React** config-driven que recorre `GuideTree` con componentes styled, galería con lightbox, TOC sticky, empty states, brand theming por property y WCAG 2.2 AA. Incluye la **reestructuración de `guide_sections.json`** por journey del huésped (añade Esenciales aggregator, Cómo usar la casa, Salida; fusiona contacts en Ayuda y emergencias).

**Motivación** (research):
- [GUEST_GUIDE_SPEC.md:L33-L81](research/GUEST_GUIDE_SPEC.md) — arquitectura de información por journey del huésped, no por taxonomía interna.
- [GUEST_GUIDE_SPEC.md:L104-L132](research/GUEST_GUIDE_SPEC.md) — layout single-column, TOC sticky, cards/accordions/chips/galerías.
- [GUEST_GUIDE_SPEC.md:L146-L160](research/GUEST_GUIDE_SPEC.md) — WCAG 2.2 AA, multilenguaje (hook), empty states explícitos.
- [GUEST_GUIDE_SPEC.md:L162-L210](research/GUEST_GUIDE_SPEC.md) — design tokens (escala, spacing, radius, targets).
- [IMPLEMENTATION_PLAN.md:L29-L49](research/IMPLEMENTATION_PLAN.md) — stack front-end (`yet-another-react-lightbox`, `react-leaflet`, `IntersectionObserver` puro para TOC).
- [IMPLEMENTATION_PLAN.md:L171-L183](research/IMPLEMENTATION_PLAN.md) — lo que NO implementar (no PDF largo, no tabs en móvil, no hero gigante).

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- Design tokens: adoptar **principios** (escala tipográfica Inter 13/14/15/16/20/28, spacing 4/8/12/16/24/32/48, radius 12/10, targets 44×44, contraste AA, sombras mínimas) **mapeados a los tokens existentes del repo** (`--color-primary-500` indigo, no el teal `#0F766E` del research).
- Brand theming por property: `Property.brandLogoUrl?` + `brandPrimaryColor?` (validado a HEX AA). No fonts personalizados en este scope.
- Lightbox: `yet-another-react-lightbox` con plugin video habilitado.
- Mapas: componente stub con interfaz `GuideMap`; Leaflet se cablea en 13C.
- Secciones nuevas en `guide_sections.json`:
  - `gs.essentials` — aggregator, `sourceResolverKeys: ["arrival", "amenities", "rules", "contacts"]`, filtros `journeyTags: ["essential"]` en items.
  - `gs.howto` — nueva, renderiza `SpaceFeature` + `AmenityInstance.runbookJson` cuando exista.
  - `gs.checkout` — nueva, items desde `policy_taxonomy` con `journeyStage: "checkout"`.
  - `gs.emergency` — absorbe `contacts` con rol `emergency_service` / `host_primary` / `host_backup`.
- Hooks tipados para `sensitiveAccessAllowed` y `journeyStage` quedan apagados por defecto (activación en FUTURE cuando exista reservation context).
- ISR para shell pública (no datos sensibles): `revalidate` + `revalidateTag('guide-' + slug)`.

**Archivos a crear**:
- `src/components/public-guide/guide-renderer.tsx` — root server component, itera `GuideTree.sections`.
- `src/components/public-guide/section-card.tsx` — card con icono + header + empty state por sección.
- `src/components/public-guide/guide-item.tsx` — item con fields (labeled pairs), media, children, `deprecated` visual.
- `src/components/public-guide/guide-toc.tsx` — client island con `IntersectionObserver`, scroll-to-section.
- `src/components/public-guide/guide-media-gallery.tsx` — galería con `yet-another-react-lightbox` (imágenes + video).
- `src/components/public-guide/guide-map.tsx` — stub con contract `GuideMap`, lazy-loaded.
- `src/components/public-guide/guide-empty-state.tsx` — "no hay X, usa Y" explícito.
- `src/components/public-guide/guide-brand-header.tsx` — logo + nombre + color primario por property.
- `src/config/registries/public-guide-section-registry.ts` — mapa `sectionKey → Component` (config-driven, extensible vía taxonomía).
- `src/app/g/[slug]/guide.css` — estilos mobile-first + breakpoints.
- `src/lib/services/guide-sections/essentials-aggregator.ts` — resuelve Esenciales desde múltiples `sourceResolverKeys`.

**Archivos a modificar**:
- `taxonomies/guide_sections.json` — reestructuración completa (Esenciales, Cómo usar, Salida, fusión contacts→Emergency) + nuevos flags (`journeyStage`, `isHero`, `isAggregator`, `sourceResolverKeys`, `journeyTags`).
- `src/lib/services/guide-rendering.service.ts` — resolvers nuevos (`howto`, `checkout`) + soporte aggregator + graceful degradation.
- `src/lib/types/guide-tree.ts` — añadir `journeyStage?`, `journeyTags?`, `runbookJson?` en `GuideItem`; `isHero?`, `isAggregator?` en `GuideSection`. Hooks tipados para `sensitiveAccessAllowed`.
- `src/lib/taxonomy-loader.ts` — actualizar Zod schema de `guide_sections.json`.
- `prisma/schema.prisma` — `Property.brandLogoUrl String?`, `Property.brandPrimaryColor String?`.
- `src/app/g/[slug]/page.tsx` — sustituir `renderHtml()` + `dangerouslySetInnerHTML` con `<GuideRenderer tree={guestTree} slug={slug} />`.

**Tests**:
- `src/test/guide-react-renderer.test.tsx` — cada sección se renderiza; media en galería; TOC contiene secciones no vacías; deprecated marcado visualmente.
- `src/test/guide-sections-journey.test.ts` — `gs.essentials` agrega desde múltiples resolvers; `gs.howto` incluye items con `runbookJson`; `gs.checkout` filtra por `journeyStage`.
- `src/test/guide-brand-theming.test.ts` — property sin branding cae a tokens default; con branding inyecta CSS vars.
- `src/test/guide-accessibility.test.ts` — axe-core smoke: sin violations WCAG 2.2 AA en fixture renderizada.
- `src/test/guide-empty-states.test.ts` — cada sección emite empty state explícito en audience=guest.
- `src/test/guide-sections-coverage.test.ts` (actualizar de 9A) — cubre las nuevas secciones.

**Criterio de done**: `/g/:slug` se ve profesional, mobile-first, con TOC navegable, iconos, cards, galería lightbox (imagen+video), empty states explícitos, brand theming aplicado. Añadir una sección nueva a `guide_sections.json` la renderiza automáticamente sin tocar componentes. Axe-core sin violations AA. Lighthouse mobile Performance ≥85.

**Preparación**:
- **Contexto a leer**:
  - [docs/research/GUEST_GUIDE_SPEC.md:L33-L210](research/GUEST_GUIDE_SPEC.md) — IA, layout, patterns, tokens.
  - [docs/research/IMPLEMENTATION_PLAN.md:L29-L67](research/IMPLEMENTATION_PLAN.md) — stack frontend + RAG store context.
  - Código de 10D (media proxy — URLs ya estables), 10C (media en guide), 9A (GuideTree types).
  - `taxonomies/guide_sections.json` actual.
  - `src/config/registries/icon-registry.ts`, `renderer-registry.ts` (patrones existentes).
  - `src/lib/types/guide-tree.ts`.
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § "Public guide rendering" — patrón renderer React.
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Public guide renderer" — cómo se extiende (taxonomía + registry).
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Sections journey" — documentar nueva IA.
  - `CLAUDE.md` § "Patrones de UI" — añadir tokens public-guide + brand theming.
- **Skills/tools específicos**:
  - Defaults §2.
  - **Context7** (auto) — `yet-another-react-lightbox` (v3.x), `react-leaflet`, Next.js 15 Server Components + ISR.
  - **`/firecrawl-search`** antes — "airbnb guidebook UX", "touch stay digital guidebook mobile", "hostfully guest app layout". Benchmark visual.
  - **`/excalidraw-diagram`** antes — layout mobile/tablet/desktop + jerarquía visual del renderer.
  - **Agent code-architect** — decidir organización de `public-guide-section-registry` vs resolver-per-section.
  - **Agent code-explorer** — mapear consumidores actuales de `renderHtml()` antes de reemplazar.
  - **`/playwright-cli`** al final — responsive (375/768/1280), TOC, lightbox, empty states, brand theming.
  - **`/simplify`** tras implementar — 9 componentes nuevos, buscar duplicación.

---

### Rama 10F — `feat/guide-hero-quick-actions`

**Propósito**: bloque hero "Inicio de estancia" — panel operativo NO decorativo — arriba del pliegue, con 4 respuestas inmediatas (entrar / aparcar / Wi-Fi / ayuda) + quick actions universales click-to-call, click-to-WhatsApp, copy Wi-Fi password, abrir-en-Maps. Toast de feedback al copiar. Instrumentación ligera de clicks para métricas futuras.

**Motivación** (research):
- [GUEST_GUIDE_SPEC.md:L39-L46](research/GUEST_GUIDE_SPEC.md) — "Inicio de estancia: no es una portada decorativa; es un panel operativo".
- [GUEST_GUIDE_SPEC.md:L113-L121](research/GUEST_GUIDE_SPEC.md) — "Quick actions siempre visibles para lo urgente".
- [GUEST_GUIDE_SPEC.md:L211-L234](research/GUEST_GUIDE_SPEC.md) — copiar WiFi con un toque, click-to-call, abrir en Maps (interacciones valiosas).
- [IMPLEMENTATION_PLAN.md:L113-L115](research/IMPLEMENTATION_PLAN.md) — "Copy Wi-Fi / copy code / abrir en Maps / click-to-call" marcado Alto impacto / Bajo esfuerzo.

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- Quick actions declarativas en `guide_sections.json` vía array `quickActionKeys: ["wifi_copy", "call_host", "whatsapp_host", "maps_open", "access_how"]` en la sección hero.
- Registry `quick-action-registry.ts`: cada action = `{ id, label, icon, handler, visibilityAudience, resolveValue(tree) }`. Handlers: `copy`, `tel:`, `wa.me/`, `geo:`/`https://maps.apple.com/`.
- Instrumentación: evento `quickActionClick` a `localStorage` + `navigator.sendBeacon` a endpoint `/api/g/:slug/_track` (no-op hasta que exista dashboard; sólo registra en Vercel logs).
- Feedback UX: `<Toast>` visible 2s, tecla Escape cierra, role="status" para lectores de pantalla.
- Añadir action nueva = 1 entrada en registry + declararla en la taxonomía. NO se tocan componentes.

**Archivos a crear**:
- `src/components/public-guide/guide-hero.tsx` — server component, lee sección `isHero` de la taxonomía y resuelve 4 quick answers (access/parking/wifi/help).
- `src/components/public-guide/quick-action-button.tsx` — client island, handler despachado por registry.
- `src/components/public-guide/toast.tsx` — primitive a11y-compliant.
- `src/config/registries/quick-action-registry.ts` — registry + validador Zod.
- `src/app/api/g/[slug]/_track/route.ts` — POST no-op, guarda evento en logs.
- `src/lib/client/quick-action-tracker.ts` — sendBeacon helper.

**Archivos a modificar**:
- `taxonomies/guide_sections.json` — marcar `gs.essentials` con `isHero: true` + `quickActionKeys: [...]`.
- `src/components/public-guide/guide-renderer.tsx` (de 10E) — renderiza `<GuideHero>` cuando `section.isHero`.
- `src/lib/taxonomy-loader.ts` — Zod actualizado para `isHero`, `quickActionKeys`.

**Tests**:
- `src/test/guide-hero.test.tsx` — hero aparece encima de TOC, resuelve 4 answers desde fixture.
- `src/test/quick-action-registry.test.ts` — cada action válida resuelve valor correcto; action desconocida en taxonomía lanza en boot.
- `src/test/quick-action-handlers.test.ts` — `copy` usa `navigator.clipboard`, `tel:` construye URI correcta, `wa.me` respeta E.164, `maps_open` genera URL universal (iOS+Android).
- `src/test/guide-track-endpoint.test.ts` — POST con body válido responde 204; payload malformado 400.

**Criterio de done**: huésped abre `/g/:slug`, el hero muestra las 4 respuestas críticas arriba, un tap copia el WiFi con toast confirmando, otro abre Maps a la dirección, otro llama/WhatsAppea al contacto principal. Sin acciones hardcoded — todo desde taxonomía + registry.

**Preparación**:
- **Contexto a leer**:
  - [docs/research/GUEST_GUIDE_SPEC.md:L39-L50](research/GUEST_GUIDE_SPEC.md), [L113-L121](research/GUEST_GUIDE_SPEC.md), [L211-L234](research/GUEST_GUIDE_SPEC.md).
  - [docs/research/IMPLEMENTATION_PLAN.md:L109-L127](research/IMPLEMENTATION_PLAN.md) — roadmap por impacto/esfuerzo.
  - Renderer de 10E + registries existentes (`icon-registry`, `field-type-registry`).
- **Docs a actualizar al terminar**:
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Quick actions" — cómo se añade una action nueva.
  - `docs/API_ROUTES.md` — documentar `POST /api/g/:slug/_track` (no-op por ahora).
- **Skills/tools específicos**:
  - Defaults §2.
  - **Context7** (auto) — Clipboard API spec, URI schemes `tel:`/`wa.me`/`geo:`/universal Maps links.
  - **`/playwright-cli`** — verificar copy-to-clipboard en chromium + webkit, comportamiento `tel:` en mobile emulation.
  - **`/simplify`** tras implementar — validar que 10E+10F no duplican lógica de resolución.

---

### Rama 10G — `feat/guide-client-search`

**Propósito**: buscador client-side con Fuse.js en el header de la guía pública. Index construido desde `GuideTree` guest filtrado (nunca incluye `internal`/`sensitive`), fuzzy + weighted keys, resultados instant con scroll-to-section. Coexiste con 11F (semantic search) como capa instant/offline; Fuse.js responde en <20ms sin red, 11F responde con comprensión semántica cuando hay conexión.

**Motivación** (research):
- [GUEST_GUIDE_SPEC.md:L113-L116](research/GUEST_GUIDE_SPEC.md) — "Búsqueda universal como primer mecanismo de recuperación. Si el huésped piensa 'Wi-Fi' y tarda más de un segundo en deducir dónde está, ya has perdido".
- [GUEST_GUIDE_SPEC.md:L248-L251](research/GUEST_GUIDE_SPEC.md) — métrica "Search success rate".
- [IMPLEMENTATION_PLAN.md:L46-L48](research/IMPLEMENTATION_PLAN.md) — Fuse.js por defecto, FlexSearch como upgrade para datasets grandes.
- [IMPLEMENTATION_PLAN.md:L113-L114](research/IMPLEMENTATION_PLAN.md) — roadmap marca "Búsqueda universal con Fuse.js" como Alto/Bajo.

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- Index embebido en RSC y pasado al client island como JSON minificado — evita round-trip extra al montar.
- Fuse options: `threshold: 0.35`, `keys: [{name: "label", weight: 2}, {name: "fields.value", weight: 1.5}, {name: "keywords", weight: 1}]`.
- Resultados cap 8; si 0 resultados, mensaje "nada coincide — prueba 'wifi', 'parking', 'checkout'..." + log de query fallida vía `_track`.
- Keyboard: `/` abre search, `Escape` cierra, `Enter` navega al primero.
- No interactúa con 11F todavía (esa rama lo integrará como fallback semántico).

**Archivos a crear**:
- `src/components/public-guide/guide-search.tsx` — client island, usa `useDeferredValue` para queries.
- `src/lib/client/guide-search-index.ts` — builder de index desde `GuideTree` guest, cliente-side.
- `src/lib/services/guide-search-index.service.ts` — server-side builder (mismo shape) para SSR inicial.
- `src/lib/types/guide-search-hit.ts` — shape de hit + ref al sectionId para scroll.

**Archivos a modificar**:
- `src/components/public-guide/guide-renderer.tsx` (de 10E) — monta `<GuideSearch>` en el shell header.
- `src/app/g/[slug]/page.tsx` — serializa index minificado como prop.
- `taxonomies/guide_sections.json` — campo opcional `searchableKeywords[]` por sección (hint manual cuando el label no basta).

**Tests**:
- `src/test/guide-search-index.test.ts` — build desde fixture; "wifi" match amenity de wifi; "parking" match amenity/rule parking; item `sensitive` **nunca** aparece en index.
- `src/test/guide-search.test.tsx` — componente filtra en vivo; teclado `/` abre; `Enter` navega; 0 resultados muestra hint.
- `src/test/guide-search-performance.test.ts` — p95 <20ms en fixture realista (200 items).

**Criterio de done**: huésped tipea "wifi" y ve resultado en <1 frame, scroll lleva al item. Search funciona sin red. Analítica básica de queries sin resultado.

**Preparación**:
- **Contexto a leer**:
  - [docs/research/IMPLEMENTATION_PLAN.md:L44-L49](research/IMPLEMENTATION_PLAN.md).
  - Renderer de 10E, hero de 10F.
  - `GuideTree` types (9A) y filtrado guest (9A `filterByAudience`).
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § "Public guide rendering" — añadir capa search.
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Client search" — separación con 11F semantic.
- **Skills/tools específicos**:
  - Defaults §2.
  - **Context7** (auto) — `fuse.js` v7.x (`threshold`, `keys`, `includeMatches`), `React.useDeferredValue`.
  - **`/playwright-cli`** — verificar `/` shortcut + screen reader labels.
  - **`/firecrawl-search`** opcional — "guidebook search UX zero-result hint".

---

### Rama 10H — `feat/guide-pwa-offline`

**Propósito**: convertir la guía pública en PWA instalable con caché crítica offline en 3 niveles. Sin red, el huésped sigue viendo Llegada, Wi-Fi, Ayuda y Salida. Add-to-Home-Screen nudge aparece después de la primera visita útil, no en el primer segundo.

**Motivación** (research):
- [GUEST_GUIDE_SPEC.md:L227-L232](research/GUEST_GUIDE_SPEC.md) — "Modo offline / conexión lenta... la guía debe mantener funcional el shell, el bloque esencial, los textos críticos y miniaturas de acceso".
- [GUEST_GUIDE_SPEC.md:L230-L232](research/GUEST_GUIDE_SPEC.md) — Add to Home Screen "solo después del primer valor real".
- [IMPLEMENTATION_PLAN.md:L49](research/IMPLEMENTATION_PLAN.md) — "enfoque manual alineado con docs oficiales de Next.js", NO `next-pwa` (poco mantenido + problemas con App Router).
- [IMPLEMENTATION_PLAN.md:L95-L106](research/IMPLEMENTATION_PLAN.md) — 3 niveles de caché (shell/CSS/íconos → predictive image → lazy noncritical).

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- Service worker **manual**, no `next-pwa`.
- Cache strategy:
  - **Nivel 1 (cache-first)**: shell HTML, CSS, fuentes Inter subset, íconos, JSON crítico de secciones hero/essentials/checkout/emergency.
  - **Nivel 2 (stale-while-revalidate)**: thumbnails de fachada/acceso/parking/hero + 1 imagen por espacio (vía `/g/:slug/media/:id/thumb` de 10D).
  - **Nivel 3 (network-first con fallback timeout 2s)**: galerías completas, vídeo, mapas.
- A2HS nudge: disparado tras 2 visitas o tiempo acumulado >90s; dismissable permanente vía `localStorage`.
- Versionado del SW por `contentHash` del bundle de secciones críticas; skipWaiting + clientsClaim on activate para forzar refresh sin tab reload.
- Fallback page `/g/[slug]/offline` con mensaje y lista de secciones cacheadas.

**Archivos a crear**:
- `public/manifest.json` — nombre, íconos 192/512, theme_color (usa brand primary de la property vía server render de `/g/:slug/manifest.webmanifest` con query param).
- `public/sw.js` — service worker manual (plantilla ES modules).
- `src/app/g/[slug]/manifest.webmanifest/route.ts` — manifest dinámico por property.
- `src/lib/client/service-worker-register.ts` — registro + update detection.
- `src/components/public-guide/install-nudge.tsx` — client island con trigger condicional.
- `src/app/g/[slug]/offline/page.tsx` — fallback offline page.
- `scripts/build-sw-manifest.mjs` — genera lista de assets críticos en build time.

**Archivos a modificar**:
- `next.config.ts` — headers para `/sw.js` (no-cache), CSP si aplica.
- `src/app/g/[slug]/layout.tsx` (crear si no existe) — mete `<ServiceWorkerRegister />` + `<InstallNudge />`.
- `src/components/public-guide/guide-renderer.tsx` (de 10E) — marca secciones `critical: true` para precache.
- `taxonomies/guide_sections.json` — flag `offlineCacheTier: 1|2|3` por sección.

**Tests**:
- `src/test/guide-pwa-manifest.test.ts` — manifest valida schema, ícono 512x512 requerido.
- `src/test/guide-sw-cache-tiers.test.ts` — simulated install, cache populated correctamente por tier.
- `src/test/guide-install-nudge.test.tsx` — no aparece en primera visita; aparece tras trigger.
- `src/test/guide-offline-fallback.test.ts` — fetch con network-off retorna offline page con lista de cacheadas.

**Criterio de done**: Lighthouse PWA ≥90. Airplane mode mostrando secciones Nivel 1 sin degradación. A2HS nudge verificado en iOS Safari + Chrome Android. No cache corruption al deploy siguiente (SW versioning funciona).

**Preparación**:
- **Contexto a leer**:
  - [docs/research/GUEST_GUIDE_SPEC.md:L225-L234](research/GUEST_GUIDE_SPEC.md).
  - [docs/research/IMPLEMENTATION_PLAN.md:L49-L50](research/IMPLEMENTATION_PLAN.md), [L94-L106](research/IMPLEMENTATION_PLAN.md).
  - Media proxy de 10D (rutas estables imprescindibles para cache).
  - Renderer de 10E, hero de 10F, search de 10G.
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § "Public guide rendering" — añadir PWA section.
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Offline strategy".
  - `CLAUDE.md` § "Entorno y comandos" — nota sobre SW en dev (http vs https, chrome://serviceworker-internals).
- **Skills/tools específicos**:
  - Defaults §2.
  - **Context7** (auto) — Service Worker API, Next.js 15 manifest + dynamic headers, MDN cache storage strategies.
  - **`/firecrawl-search`** antes — "next.js 15 app router pwa service worker manual", "touch stay offline guest guide".
  - **`/playwright-cli`** — test airplane mode (`browserContext.setOffline(true)`), A2HS trigger en chromium-mobile emulation.
  - **Agent code-architect** — diseñar versionado del SW + strategy de invalidación si la decisión no quedó cerrada.

---

## FASE 11 — Knowledge + Assistant + i18n

**Objetivo**: knowledge base viva, retrieval de calidad production-grade (hybrid BM25+vector + Cohere Rerank + contextual prefix) y assistant con visibility hermética. Diferenciador del producto.

### Rama 11A — `feat/knowledge-autoextract`

**Propósito**: extraer hechos estructurados desde Rules, Access, Contacts, Amenities, Spaces, Systems, Policies hacia `KnowledgeItem` con los **campos AI completos** que espera el retrieval pipeline. Recomputable determinístico, como `PropertyDerived`.

**Motivación**: el modelo actual de `KnowledgeItem` es minimalista. El retriever hybrid + rerank necesita, por cada item, los campos de [AI_KNOWLEDGE_BASE_SPEC.md:L40-L139](research/AI_KNOWLEDGE_BASE_SPEC.md) (contextual payload) y [AI_KNOWLEDGE_BASE_SPEC.md:L370-L425](research/AI_KNOWLEDGE_BASE_SPEC.md) (campos del modelo). Sin estos campos tipificados — `chunkType`, `locale`, `audience`, `journeyStage`, `entityType`, `entityId`, `contextPrefix`, `bm25Text`, `embedding`, `tokens`, `lastModified`, `sourceFields[]`, `confidenceScore`, `tags[]` — no hay filtros duros en retrieval ni trazabilidad de citas.

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- **Taxonomía de chunks**: `fact | procedure | policy | place | troubleshooting | summary | template` ([AI_KNOWLEDGE_BASE_SPEC.md:L149-L192](research/AI_KNOWLEDGE_BASE_SPEC.md)). Cada extractor produce 1 o N items con `chunkType` explícito.
- **Generación de embeddings**: diferida a 11C (aquí solo se persiste el texto + metadata). 11A deja `embedding: null` + `bm25Text` listo; 11C puebla embeddings en batch post-i18n.
- **Invalidación**: `sourceType` + `sourceId` + `sourceFields[]` (campos de la entidad que el item referencia). Editar `Property.checkInTime` invalida solo items cuyo `sourceFields` incluye `checkInTime`.
- **`journeyStage`**: enum `pre_arrival | arrival | stay | checkout | post_checkout | any`, mapeado desde la sección de origen (arrival→arrival, rules→stay, etc.) + override manual editable.
- **`confidenceScore` inicial**: 1.0 para autoextract determinístico; 0.5 para items creados a mano; editable.

**Archivos a crear**:
- `src/lib/services/knowledge-extract.service.ts`:
  - `extractFromProperty(propertyId, locale = 'es')` — genera `KnowledgeItem[]` con campos AI completos
  - Un extractor por fuente con chunking semántico: `extractFromRules`, `extractFromAccess`, `extractFromContacts`, `extractFromAmenities`, `extractFromSpaces`, `extractFromSystems`, `extractFromPolicies`
  - `buildBm25Text(item)` — texto normalizado para BM25 (diacrítica plegada + lowercase + stopwords fuera)
  - `buildContextPrefix(item)` — prefijo contextual à la Contextual Retrieval ([AI_KNOWLEDGE_BASE_SPEC.md:L194-L206](research/AI_KNOWLEDGE_BASE_SPEC.md)): `"En [propertyName], sección [section], sobre [entityLabel]: …"`
- `taxonomies/knowledge_templates.json` — plantillas versionadas por `sourceType × chunkType × locale` (ej: `{"check_in_time": "El check-in es a las {{value}} en {{propertyName}}."}`)
- `taxonomies/chunk_types.json` — catálogo de `chunkType` con descripción y rules de uso (validado con Zod en el loader)

**Archivos a modificar**:
- `prisma/schema.prisma` — `KnowledgeItem` expandido con todos los campos AI (ver Motivación). Campos nuevos: `chunkType String`, `locale String`, `audience String`, `journeyStage String`, `entityType String`, `entityId String?`, `contextPrefix String`, `bm25Text String`, `embedding Unsupported("vector(1536)")?` (pgvector), `tokens Int`, `sourceFields String[]`, `confidenceScore Float @default(1.0)`, `tags String[]`. Índices: `@@index([propertyId, audience, locale, journeyStage])`, `@@index([propertyId, chunkType])`. **Migración**: `prisma db push --accept-data-loss` en dev (no hay KnowledgeItem en prod).
- `src/lib/actions/editor.actions.ts` — invalidar KnowledgeItems por `sourceFields` tras mutación canónica; fire-and-forget llamada a `extractFromProperty`
- `src/lib/types/knowledge.ts` (nuevo) — tipos TS derivados del schema + Zod para validación de extractors

**Tests**:
- `src/test/knowledge-extract.test.ts` — property fixture (3 spaces + 5 amenities + 1 access + 3 rules) genera N items con `chunkType`, `journeyStage` y `audience` correctos
- `src/test/knowledge-extract-context-prefix.test.ts` — prefix correcto en los 7 chunkTypes; no-hardcoded de IDs (fail si aparece `am.wifi` literal)
- `src/test/knowledge-invalidation.test.ts` — editar `Property.checkInTime` invalida solo items con `sourceFields` incluye `checkInTime`; no toca el resto
- `src/test/knowledge-visibility-boundary.test.ts` — items con `audience = sensitive` nunca salen de un extractor cuyo origen es `Property.houseRules` público (fail-loud)

**Criterio de done**: página `/knowledge` muestra hechos extraídos + editables. Rebuild determinístico (mismo input → mismo output). Schema tiene todos los campos AI listos para retrieval hybrid.

**Preparación**:
- **Contexto a leer**:
  - [AI_KNOWLEDGE_BASE_SPEC.md:L7-L139](research/AI_KNOWLEDGE_BASE_SPEC.md) — casos de uso + AI context schema completo
  - [AI_KNOWLEDGE_BASE_SPEC.md:L141-L206](research/AI_KNOWLEDGE_BASE_SPEC.md) — chunk fields + chunking + contextual retrieval
  - [AI_KNOWLEDGE_BASE_SPEC.md:L370-L425](research/AI_KNOWLEDGE_BASE_SPEC.md) — campos del modelo `KnowledgeItem`
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` (completo)
  - `prisma/schema.prisma` — modelos actuales `KnowledgeItem`, `KnowledgeSource`, `KnowledgeCitation`
  - `src/app/properties/[propertyId]/knowledge/page.tsx` (shell actual)
  - Patrón de recomputación en `src/lib/services/property-derived.service.ts`
  - `src/lib/actions/editor.actions.ts` — hook points donde ya se llama `recomputeAll`
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Knowledge extraction" — describir extractores + templates + contextPrefix
  - `docs/DATA_MODEL.md` § `KnowledgeItem` — reflejar schema expandido
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `knowledge_templates.json` + `chunk_types.json`
- **Skills/tools específicos**:
  - **Agent code-explorer** — trazar qué mutaciones tocan qué entidades (necesario para mapear `sourceFields` correctos).
  - **Agent code-architect** — diseñar el contrato de extractors para que los 7 sean simétricos (factory pattern).
  - **Context7** (auto) — pgvector schema + Prisma `Unsupported` type.

---

### Rama 11B — `feat/knowledge-i18n`

**Propósito**: soporte i18n en `KnowledgeItem` como **filtro duro** del retriever (no fallback silencioso cross-locale). Un item se indexa por `(propertyId, locale)`; el retriever filtra por locale del huésped antes de vector search.

**Motivación**: ubicada entre 11A y el retrieval pipeline (11C) por decisión arquitectónica: el retriever necesita `locale` como filtro duro desde el día 1 para evitar que embeddings mezclen idiomas (degrada rerank). Introducirlo después de tener embeddings es costoso (re-indexar todo el corpus). [AI_KNOWLEDGE_BASE_SPEC.md:L40-L139](research/AI_KNOWLEDGE_BASE_SPEC.md) exige `locale` explícito en cada chunk; [IMPLEMENTATION_PLAN.md:L129-L169](research/IMPLEMENTATION_PLAN.md) marca multi-idioma como decisión crítica temprana.

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- **Idiomas MVP**: `es`, `en`. `fr`, `de`, `it`, `pt` planificados como "add one more taxonomy entry + regenerar templates"; no requieren cambios de código.
- **Fallback policy**: si no hay item en `locale` del huésped, responder en `defaultLocale` de la property con nota visible (`"Disponible en Español, traducción automática a English no ofrecida"`). **No hay auto-translate en MVP** — es un deferido (FUTURE.md).
- **Fuente de traducción**: templates i18n en `knowledge_templates.json` tienen variantes por locale (`"check_in_time": { "es": "…", "en": "…" }`). Items libres (editados a mano) requieren traducción manual explícita por el host en UI.
- **UI de traducción**: `/knowledge/[itemId]` muestra selector de locale + estado por locale (`draft | published | missing`). Al menos `defaultLocale` obligatorio.

**Archivos a crear**:
- `src/lib/services/knowledge-i18n.service.ts`:
  - `getItemForLocale(itemId, locale, fallback): KnowledgeItem` — aplica fallback policy
  - `listMissingTranslations(propertyId): { itemId, missingLocales[] }[]` — para dashboard
  - `extractI18n(propertyId, locale)` — wrapper de `extractFromProperty` que genera items para un locale concreto reusando templates
- `src/components/knowledge/locale-switcher.tsx` — tabs por locale con estado (draft/published/missing)

**Archivos a modificar**:
- `taxonomies/knowledge_templates.json` — migrar a estructura `{ templateId: { [locale]: string } }`
- `prisma/schema.prisma` — añadir `KnowledgeItem.defaultLocale String @default("es")` y `@@unique([propertyId, sourceType, sourceId, chunkType, locale])`
- `src/app/properties/[propertyId]/knowledge/page.tsx` — panel de missing translations + acción "Duplicar y traducir manualmente"
- `src/lib/services/knowledge-extract.service.ts` (de 11A) — aceptar `locale` + elegir template variant

**Tests**:
- `src/test/knowledge-i18n-extract.test.ts` — property con default `es`, regenerar para `en` produce items con textos en inglés usando templates i18n
- `src/test/knowledge-i18n-fallback.test.ts` — pedir item en `fr` cuando solo existe `es` → retorna `es` con `_fallbackFrom: 'es'`
- `src/test/knowledge-i18n-unique-key.test.ts` — insertar dos items con misma `(propertyId, sourceType, sourceId, chunkType, locale)` → error P2002

**Criterio de done**: host puede activar `en` como idioma secundario, ver gaps de traducción, completarlos manualmente; items quedan indexados por locale listos para 11C.

**Dependencias**: 11A (schema expandido).

**Preparación**:
- **Contexto a leer**:
  - [AI_KNOWLEDGE_BASE_SPEC.md:L40-L139](research/AI_KNOWLEDGE_BASE_SPEC.md) — `locale` como campo AI
  - [IMPLEMENTATION_PLAN.md:L129-L169](research/IMPLEMENTATION_PLAN.md) — decisión crítica multi-idioma
  - Schema de 11A
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "i18n" — política de fallback + workflow de traducción
  - `docs/FUTURE.md` — añadir "Auto-translate con LLM (DeepL / Claude Sonnet) post-validación"
- **Skills/tools específicos**:
  - **Context7** (auto) — Prisma `@@unique` composite con Json nullable.

---

### Rama 11C — `feat/assistant-retrieval-pipeline`

**Propósito**: pipeline RAG production-grade: hybrid BM25+vector retrieval + Cohere Rerank + contextual prefix + filtros duros (visibility, locale, journeyStage). Intent → retrieve → rerank → filter → synthesize con citas.

**Motivación**: la literatura ([AI_KNOWLEDGE_BASE_SPEC.md:L149-L215](research/AI_KNOWLEDGE_BASE_SPEC.md) + [IMPLEMENTATION_PLAN.md:L51-L66](research/IMPLEMENTATION_PLAN.md)) coincide en que vector search solo rinde ~70% accuracy en corpora pequeños y heterogéneos como una property (decenas a cientos de items). Hybrid (BM25 + vector) + rerank con Cohere Rerank 3 sube a 90%+ en evals. Contextual Retrieval reduce "lost context" en chunks al enriquecer el embedding con prefix.

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- **Embeddings**: Voyage `voyage-3-lite` (1536 dim) — mejor coste/quality que OpenAI `text-embedding-3-small` en benchmarks de RAG small-domain. OpenAI `text-embedding-3-small` como backup configurable.
- **Vector storage**: pgvector en la misma Postgres (simplicidad operativa). Índice `ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`.
- **BM25**: Postgres FTS (`tsvector` + `ts_rank_cd`) sobre `bm25Text` normalizado de 11A. No se añade dependencia nueva (Elasticsearch/Meilisearch).
- **Reranker**: Cohere Rerank 3 (`rerank-multilingual-v3.0`). Fallback a `CohereClient` mock en dev sin API key (retorna identity para tests).
- **LLM síntesis**: Claude Sonnet 4.6 (default). Configurable por env `ASSISTANT_LLM_MODEL`.
- **Filtros duros** (no soft filters): `audience` según requester role, `locale`, `journeyStage` si la pregunta tiene intent-stage detectado. Se aplican **antes** del vector search en el `WHERE` de pgvector.
- **Top-K**: retrieve 20 con hybrid → rerank a 5 → synthesis con estos 5.
- **Citations**: cada respuesta incluye `citations[]` con `knowledgeItemId`, `score`, `sourceType`, `entityLabel`. Si `citations.length === 0`, el pipeline escala a 11D (no inventa respuesta).

**Archivos a crear**:
- `src/lib/services/assistant/intent-resolver.ts` — LLM ligero (Haiku 4.5) para `{ intent, entities, journeyStage?, requestedLocale? }`
- `src/lib/services/assistant/retriever.ts`:
  - `hybridRetrieve(query, filters): Promise<KnowledgeItem[]>` — paralelo BM25 + vector, reciprocal rank fusion (RRF)
  - `applyHardFilters(query, context): Filter` — visibility + locale + journeyStage
- `src/lib/services/assistant/reranker.ts` — Cohere Rerank wrapper + mock provider para dev/test
- `src/lib/services/assistant/synthesizer.ts` — llama LLM con system prompt de [AI_KNOWLEDGE_BASE_SPEC.md:L237-L368](research/AI_KNOWLEDGE_BASE_SPEC.md) + contexto + instrucciones de cita obligatoria
- `src/lib/services/assistant/pipeline.ts` — orquestador `ask(query, context): { answer, citations[], confidenceScore }`
- `src/lib/services/assistant/embeddings.service.ts` — Voyage client + helper `embedBatch(texts[]): number[][]`
- `src/lib/jobs/knowledge-embed-backfill.ts` — job one-shot que embeba todos los KnowledgeItems sin `embedding`. Ejecutable manualmente en dev (`npm run embed:backfill`), scheduled en prod.
- `taxonomies/intent_catalog.json` — catálogo de intents conocidos (wifi, checkin_time, pet_policy, parking, emergency, etc.) con `expectedJourneyStage` para filter hints

**Archivos a modificar**:
- `src/app/api/properties/[propertyId]/assistant/ask/route.ts` — cablear con el nuevo pipeline (ruta **ya existe** en el repo)
- `src/app/properties/[propertyId]/ai/page.tsx` — chat UI real: pregunta → respuesta con citas clicables (linkan al `/knowledge/[itemId]` o a la sección del renderer de 10E)
- `prisma/schema.prisma` — ya tiene `embedding` de 11A; aquí se añade el índice ivfflat via migración SQL manual (`prisma db execute` con `CREATE INDEX CONCURRENTLY …`)
- `package.json` — deps: `voyageai`, `cohere-ai`; scripts: `"embed:backfill": "tsx src/lib/jobs/knowledge-embed-backfill.ts"`

**Tests**:
- `src/test/assistant-retrieval-hybrid.test.ts` — 20 preguntas fixture; hybrid > BM25-only y > vector-only en accuracy
- `src/test/assistant-retrieval-visibility-leak.test.ts` — pregunta que intenta sonsacar secreto (`guestWifiPassword` vs `ownerWifiPassword`) → respuesta audience-safe, citation nunca referencia item `sensitive`
- `src/test/assistant-retrieval-locale-hard-filter.test.ts` — query en `en` nunca retorna items `es` (incluso si tienen embedding similar)
- `src/test/assistant-retrieval-contextual-prefix.test.ts` — embeddings con prefix outperforman embeddings sin prefix en recall@5
- `src/test/assistant-reranker-fallback.test.ts` — sin COHERE_API_KEY, mock provider retorna top-K identity y el pipeline no crashea
- `src/test/assistant-pipeline-no-citations.test.ts` — si rerank top-K tiene scores < threshold, pipeline devuelve `{ escalate: true }` (hook para 11D)

**Criterio de done**: huésped pregunta "¿cómo abro la puerta?" y recibe respuesta con cita al `KnowledgeItem` de access-method; respuesta en su locale; nunca incluye campos sensitive; accuracy ≥ 85% en banco de evals (gate de 11E).

**Dependencias**: 11A (schema + items), 11B (locale filter).

**Preparación**:
- **Contexto a leer**:
  - [AI_KNOWLEDGE_BASE_SPEC.md:L149-L215](research/AI_KNOWLEDGE_BASE_SPEC.md) — chunking + contextual retrieval + flujo retrieval completo
  - [AI_KNOWLEDGE_BASE_SPEC.md:L237-L368](research/AI_KNOWLEDGE_BASE_SPEC.md) — prompt templates de synthesizer
  - [IMPLEMENTATION_PLAN.md:L51-L66](research/IMPLEMENTATION_PLAN.md) — stack back-end + RAG
  - `src/app/api/properties/[propertyId]/assistant/` (árbol completo)
  - Schema de 11A + i18n de 11B
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Assistant pipeline" — diagrama hybrid → rerank → synth + providers elegidos
  - `docs/API_ROUTES.md` — documentar `POST /api/properties/:id/assistant/ask`
  - `CLAUDE.md` § "Entorno y comandos" — env vars `VOYAGE_API_KEY`, `COHERE_API_KEY`, `ASSISTANT_LLM_MODEL`
  - `docs/DATA_MODEL.md` — migración pgvector ivfflat index
- **Skills/tools específicos**:
  - **`/excalidraw-diagram`** **antes** de codificar: diagrama del pipeline (intent → hybrid retrieve → filter → rerank → synth → cite). Imprescindible.
  - **Agent code-architect** — diseñar el contrato de `hybridRetrieve` + RRF (reciprocal rank fusion) + estrategia de filter pushdown a pgvector.
  - **Context7** (auto) — SDK de Voyage, Cohere Rerank, pgvector ivfflat tuning, Anthropic SDK.
  - **`/firecrawl-search`** antes: "Cohere Rerank 3 multilingual vs Voyage rerank benchmarks 2026", "pgvector ivfflat lists parameter tuning small corpus".

---

### Rama 11D — `feat/assistant-escalation`

**Propósito**: si `confidenceScore < threshold` o `citations.length === 0`, el assistant escala a un contacto estructurado en vez de inventar respuesta.

**Archivos a crear**:
- `src/lib/services/assistant/escalation.service.ts` — decide contacto por intent (lockout→cerrajero, emergencia→host, fuera-de-dominio→concierge) usando `taxonomies/escalation_rules.json`
- `taxonomies/escalation_rules.json` — mapeo `intent → contactRole` + fallback `general_host`

**Archivos a modificar**:
- `src/lib/services/assistant/pipeline.ts` (de 11C) — branch escalation cuando confidence baja o sin citations
- `src/app/properties/[propertyId]/ai/page.tsx` — UI de "Te pongo en contacto con…" con tap-to-call/whatsapp (reusa componentes de 10F)

**Tests**:
- `src/test/assistant-escalation.test.ts` — low-confidence intent de "emergencia médica" → escala al contacto con rol `emergency_service`
- `src/test/assistant-escalation-no-match.test.ts` — intent fuera de catálogo → fallback `general_host`, nunca null

**Criterio de done**: preguntas fuera de cobertura se resuelven con contacto estructurado, no con alucinación.

**Dependencias**: 11C (pipeline con hook escalate).

**Preparación**:
- **Contexto a leer**:
  - Pipeline de 11C
  - [AI_KNOWLEDGE_BASE_SPEC.md:L217-L235](research/AI_KNOWLEDGE_BASE_SPEC.md) — qué necesita la IA para escalar bien
  - `prisma/schema.prisma` — modelo `Contact` y `taxonomies/contact_roles.json`
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Escalation"
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `escalation_rules.json`
- **Skills/tools específicos**: ninguno extra.

---

### Rama 11E — `feat/assistant-evals`

**Propósito**: banco de evals + release gate. Sin esto, el assistant no es production-ready y cambios silenciosos de modelo pueden degradar calidad.

**Archivos a crear**:
- `src/test/assistant-evals/fixtures.json` — ≥50 pares `(pregunta, locale, intent esperado, citas mínimas esperadas, respuesta mínima aceptable)` cubriendo los 7 chunkTypes + los 5 journeyStages
- `src/test/assistant-evals/runner.ts` — corre fixtures contra pipeline real (con embedding API real cacheada en fixture)
- `src/test/assistant-evals/release-gate.test.ts` — falla si accuracy < 85% o si recall@5 de citations < 0.9
- `src/test/assistant-evals/metrics.ts` — métricas por intent + journeyStage + locale para dashboard

**Criterio de done**: CI falla si una PR del assistant baja accuracy o recall de citations. Dashboard con breakdown por dimensión.

**Dependencias**: 11C + 11D.

**Preparación**:
- **Contexto a leer**:
  - Pipeline de 11C + escalación de 11D
  - [AI_KNOWLEDGE_BASE_SPEC.md:L237-L368](research/AI_KNOWLEDGE_BASE_SPEC.md) — prompt templates (necesario para construir fixtures fieles al comportamiento esperado)
  - `docs/QA_AND_RELEASE.md` (patrón de release gates)
- **Docs a actualizar al terminar**:
  - `docs/QA_AND_RELEASE.md` § "Release gates" — gate de accuracy + recall@5 con umbrales concretos
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Evals"
- **Skills/tools específicos**:
  - **Agent code-architect** — diseñar estructura de fixtures para que cubran la matriz `intent × chunkType × journeyStage × locale` sin explosión combinatoria.

---

### Rama 11F — `feat/guide-semantic-search`

**Propósito**: buscador semántico en la guía pública (`/g/:slug`) que entiende la intención del huésped y navega al contenido relevante. Reutiliza embeddings + retriever de 11C; coexiste con el Fuse.js client search de 10G como capa complementaria (Fuse para instant/offline, este para lenguaje natural).

**Motivación**: Fuse.js (10G) resuelve búsqueda léxica fuzzy en cliente (rápido, offline, <20ms). Pero no entiende "cómo llego" → arrival, o "mascota" → pet_policy. [GUEST_GUIDE_SPEC.md:L211-L234](research/GUEST_GUIDE_SPEC.md) marca búsqueda semántica como feature diferencial post-MVP. Este es el componente de capa 2: cuando Fuse no encuentra match o el huésped usa lenguaje natural largo, se ofrece "Búsqueda inteligente" que llama al backend.

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- **UX**: Fuse es default (instant como se tecla); si el input supera 4 palabras o Fuse retorna < 3 resultados, aparece CTA "Búsqueda inteligente" que hace request al endpoint semántico.
- **Endpoint público**: `/api/g/[slug]/search` — resuelve slug → propertyId + forza `audience = guest` + `locale = slug.guideVersion.locale`. Nunca expone items `internal`/`sensitive`.
- **Scroll-to-section**: usa el `sectionId` del `GuideTree` serializado en 9C + el TOC de 10E. El resultado trae `{ itemId, sectionId, scrollToAnchor }`.

**Archivos a crear**:
- `src/components/public-guide/guide-search.tsx` — input + resultados instant (Fuse) + CTA "Búsqueda inteligente" (cliente)
- `src/app/api/g/[slug]/search/route.ts` — endpoint público: slug → propertyId → `retriever.hybridRetrieve(query, { audience: 'guest', locale: versionLocale })` → top-5 con `sectionId` resuelto desde `KnowledgeItem.sourceType` + mapa `sourceType → guideSectionId`
- `src/lib/services/guide-search.service.ts` — wrapper sobre retriever de 11C con mapeo a secciones del GuideTree + rate limit por slug (10 req/min)

**Archivos a modificar**:
- `src/components/public-guide/guide-renderer.tsx` (de 10E) — integrar `<GuideSearch>` en el header sticky, conectar resultado con scroll-to-section
- `src/app/g/[slug]/page.tsx` — pasar propertyId + locale al search component

**Tests**:
- `src/test/guide-search.test.ts` — query "cómo llego" retorna sección arrival; query "mascota" retorna pet_policy; query con typo funciona por similitud semántica
- `src/test/guide-search-visibility.test.ts` — nunca retorna items `internal`/`sensitive` aunque el embedding coincida
- `src/test/guide-search-rate-limit.test.ts` — >10 req/min al mismo slug → 429

**Criterio de done**: huésped puede buscar con lenguaje natural y navegar directamente al contenido relevante en la guía pública.

**Dependencias**: 11C (retriever + embeddings), 10E (renderer con TOC scroll-to), 10G (Fuse como capa 1).

**Preparación**:
- **Contexto a leer**:
  - [GUEST_GUIDE_SPEC.md:L211-L234](research/GUEST_GUIDE_SPEC.md) — interactividad + búsqueda
  - Pipeline de 11C (retriever hybrid)
  - Renderer de 10E (guide-renderer, TOC, scroll-to-section)
  - Fuse search de 10G (para coexistencia)
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Public guide search" — arquitectura de dos capas
  - `docs/API_ROUTES.md` — documentar `GET /api/g/:slug/search?q=`
- **Skills/tools específicos**:
  - **Context7** (auto) — Next.js rate limiting por ruta pública.

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
  - Renderer HTML de 9B/10C + renderer React de 10E (donde el `<GuideMap>` se monta como client island)
- **Docs a actualizar al terminar**:
  - `docs/SECURITY_AND_AUDIT.md` — añadir regla de obfuscation de coordenadas en audience=guest
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` o `LOCAL_GUIDE.md` — documentar el comportamiento
- **Skills/tools específicos**:
  - **`/playwright-cli`** al final: screenshot del mapa en los 3 audiences para verificar que el pin exacto solo aparece en internal.

---

### Rama 13D — `feat/guide-issue-reporting`

**Propósito**: el huésped reporta problemas desde la guía pública (`/g/:slug`) en cualquier sección — el reporte abre un `Incident` estructurado, notifica al host y cierra el loop con estado visible. Patrón Breezeway aplicado al stack propio.

**Motivación**: [GUEST_GUIDE_SPEC.md:L236-L262](research/GUEST_GUIDE_SPEC.md) identifica "reporte de incidencias" como feature post-MVP de alto valor (reduce llamadas al host + feedback loop para mejorar la guía). El modelo `Incident` ya existe (creado en fases v1); lo que falta es el punto de entrada desde la guía pública + cableado con visibility (el huésped solo puede reportar; el host ve + resuelve).

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- **Punto de entrada**: botón flotante "¿Algo no funciona?" visible en todas las secciones del renderer de 10E + CTA contextual en items con `troubleshooting` attached. Abre drawer/modal con form estructurado.
- **Campos del form**: categoría (chips desde `taxonomies/incident_categories.json` — wifi, electrodoméstico, limpieza, ruido, acceso, otro) + descripción libre (max 500 char) + opcional foto (reusa UploadDropzone de 10B) + auto-captura de `spaceId`/`amenityId` si el reporte se lanza desde un item concreto.
- **Autenticación**: guest-only sin login, identificado por `GuideVersion.slug` + cookie temporal firmada; el host recibe notificación al email registrado + badge en `/properties/[id]/incidents`.
- **Notificación al host**: email (reusa sistema de 12B si existe; si no, fire-and-forget con Resend/Postmark decidido en Fase -1) + optional webhook/SMS en FUTURE.md.
- **Estado visible al huésped**: tras enviar, el huésped ve "Reporte enviado" + opcional "track status" con `incidentId` en URL (`/g/:slug/incidents/:id`). El host puede marcar `in_progress | resolved`, estado reflejado al huésped.

**Archivos a crear**:
- `src/components/public-guide/issue-reporter.tsx` — botón flotante + drawer con form (client island)
- `src/app/api/g/[slug]/incidents/route.ts` — POST crea Incident (audience=guest), retorna `incidentId`
- `src/app/api/g/[slug]/incidents/[id]/route.ts` — GET estado del incident (visibility=guest-safe)
- `src/app/g/[slug]/incidents/[id]/page.tsx` — página pública read-only de estado del reporte
- `src/lib/services/incident-from-guest.service.ts` — crea Incident con `origin: 'guest_guide'`, `reporterType: 'guest'`, link opcional a `Space`/`Amenity`/`System`
- `taxonomies/incident_categories.json` — categorías editables
- `src/lib/services/incident-notification.service.ts` — wrapper del provider de email (no crear si 12B ya lo tiene)

**Archivos a modificar**:
- `prisma/schema.prisma` — `Incident` existe; añadir `origin String @default("internal")`, `reporterType String @default("host")`, `guestContactOptional String?` (opt-in email/whatsapp del huésped para seguimiento)
- `src/components/public-guide/guide-renderer.tsx` (de 10E) — montar `<IssueReporter>` como overlay + prop `attachedItemId` contextual
- `src/app/properties/[propertyId]/incidents/page.tsx` — filtro por `origin: 'guest_guide'`, badge nuevo si hay reportes sin ver
- `src/lib/visibility.ts` — regla: un Incident con `origin: 'guest_guide'` es visible al reporter (guest) solo sobre campos `{ status, createdAt, resolvedAt, category }`, nunca sobre notas internas del host

**Tests**:
- `src/test/guest-incident-create.test.ts` — POST desde slug guest crea Incident con origin correcto, enlaza a space si `spaceId` en body
- `src/test/guest-incident-visibility.test.ts` — GET `/api/g/:slug/incidents/:id` nunca retorna `internalNotes` aunque el huésped las pida
- `src/test/guest-incident-rate-limit.test.ts` — >5 reportes/hora desde mismo slug → 429 (spam guard)
- `src/test/incident-notification.test.ts` — crear incident desde guest dispara email al host (mock provider)

**Criterio de done**: huésped puede reportar "wifi no funciona en salón" en <30 seg, adjuntar foto, recibir confirmación con track URL. Host recibe notificación + ve reporte en panel con contexto (space, timestamp, foto).

**Dependencias**: 10B (UploadDropzone), 10E (renderer para montar el overlay), ideal 12B (scheduler/email provider estabilizado, aunque no obligatorio).

**Preparación**:
- **Contexto a leer**:
  - [GUEST_GUIDE_SPEC.md:L236-L262](research/GUEST_GUIDE_SPEC.md) — métricas + issue reporting
  - `prisma/schema.prisma` — modelo `Incident` actual
  - `src/app/properties/[propertyId]/incidents/` — UI existente del host
  - `src/lib/visibility.ts` — patrón de filtrado por audiencia
  - Renderer de 10E (para montaje del overlay)
  - UploadDropzone de 10B (reutilización)
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` o `LOCAL_GUIDE.md` § "Issue reporting"
  - `docs/API_ROUTES.md` — `POST /api/g/:slug/incidents` + `GET /api/g/:slug/incidents/:id`
  - `docs/SECURITY_AND_AUDIT.md` § "Guest-originated writes" — rate limit + visibility del Incident
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Mandatory taxonomies" — añadir `incident_categories.json`
- **Skills/tools específicos**:
  - **`/firecrawl-search`** antes: "Breezeway guest reporting flow UX 2026", benchmarks Hostfully/Guesty de issue-reporting para huéspedes.
  - **Agent code-architect** — decidir provider de email (Resend vs Postmark vs reutilizar lo de 12B) si no está cerrado en Fase -1.
  - **`/playwright-cli`** al final: flujo completo guest reporta → host ve → marca resolved → guest ve "resuelto".

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
Fase 8 ✅ (independiente, cheap)
  8A Completeness to JSON
  8B Field-type registry
  8C Docs/memory sync

Fase 9 ✅ (independiente una vez 8 hecho)
  9A Rendering engine → 9B Markdown/HTML → 9C Publish workflow → 9D Shareable link

Fase 10 (paralelo con 9 en 10A/B/C; secuencial desde 10D)
  10A ✅ R2 storage → 10B ✅ Per-entity gallery → 10C Media in guide
                                                    ▼
                                        10D Media proxy (/g/:slug/media/:assetId/:variant)
                                                    ▼
                                        10E React renderer (journey IA + brand theming + WCAG 2.2 AA)
                                                    ▼
                                        10F Hero + quick-actions (copy-wifi/call/whatsapp/maps)
                                                    ▼
                                        10G Client search (Fuse.js, <20ms p95)
                                                    ▼
                                        10H PWA (manual SW + 3-tier offline cache)

Fase 11 (requiere 10E para montar UI y 9D para embeddings consistentes)
  11A Knowledge autoextract (schema AI completo)
      ▼
  11B Knowledge i18n (locale hard filter)
      ▼
  11C Retrieval pipeline (hybrid BM25+vector + Cohere Rerank + contextual prefix)
      ▼
  11D Escalation ─┐
  11E Evals ◄─────┤ (11E depende de 11C + 11D)
      ▼
  11F Semantic search en guía pública (capa 2 de Fuse 10G)

Fase 12 (requiere 11A mínimo para resolver variables con knowledge)
  12A Variables → 12B Automations → 12C Starter packs

Fase 13 (independiente post-10E; 13B reusa scheduler de 12B; 13D reusa 10B + 10E)
  13A POIs → 13B Events → 13C Maps
                            ▼
                          13D Issue reporting

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

- Fase 8 ✅: 3 PRs → completada
- Fase 9 ✅: 4 PRs → completada
- Fase 10: 8 PRs. 10A/B ✅ (merged). 10C paralelo con 9; 10D→10E→10F→10G→10H secuencial. Resto de la fase: 2-3 semanas
- Fase 11: 6 PRs secuenciales (11A→11B→11C→{11D,11E}→11F) → 4-5 semanas. 11C es la rama más costosa (providers, tuning, evals iniciales)
- Fase 12: 12A independiente, 12B→12C secuencial → 1-2 semanas
- Fase 13: 4 PRs; 13A/B/C paralelizables, 13D depende de 10E → 2 semanas
- Fase 14: depende de decisión estratégica; 4 PRs secuenciales → 6-8 semanas

**Total plan**: 32 ramas (8 ✅ completadas, 24 pendientes). Orden óptimo: terminar 10 (renderer desbloquea 11F + 13D), 11 en dedicated sprint, 12+13 en paralelo, 14 según demanda estratégica.

---

## 8. Decisiones abiertas (confirmar antes de empezar cada fase)

1. ~~**Provider de storage para media (Fase 10)**~~: ✅ Cloudflare R2 (decidido en 10A).
2. **Service Worker strategy (Fase 10H)**: SW manual propio (decidido en Fase -1 de 10H) vs `next-pwa`. Confirmar versionado del SW (single bumped version vs per-asset hash) antes de 10H.
3. **Reranker provider (Fase 11C)**: Cohere Rerank 3 `rerank-multilingual-v3.0` (default Fase -1) vs Voyage Rerank. Confirmar antes de 11C según pricing actual + latencia p95.
4. **Embeddings provider (Fase 11C)**: Voyage `voyage-3-lite` (default) vs OpenAI `text-embedding-3-small`. Decidir antes de 11C.
5. **i18n fallback policy (Fase 11B)**: locale missing → mostrar en `defaultLocale` con nota visible (default) vs auto-translate con LLM (diferido a FUTURE). Confirmar.
6. **Scheduler para messaging automations (Fase 12B)**: cron simple (Vercel cron) vs queue (BullMQ). Depende de volumen esperado.
7. **Email provider para issue-reporting (Fase 13D)**: reusar lo de 12B si existe vs Resend vs Postmark. Decidir antes de 13D.
8. **Events provider (Fase 13B)**: Eventbrite vs Ticketmaster vs scraping. Decidir antes de 13B.
9. **Platform integrations (Fase 14)**: ¿arrancar con Airbnb, Booking, o ambos? Decisión estratégica previa.

---

## 9. Futuro — fuera del alcance de este plan

Ver [FUTURE.md](FUTURE.md):

- Admin UI para editar taxonomías (4 niveles)
- Calibración de completeness (post-uso real, medición)

Los triggers para activarlos están documentados allí.
