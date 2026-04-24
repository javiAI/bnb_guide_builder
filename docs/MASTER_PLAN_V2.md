# Plan maestro V2 — Outputs, Intelligence & Integrations

Versión: 2026-04-18 (rev. 5 — Fase 15 Liora Design Replatform añadida como prep condicional: 7 ramas bloqueadas por entrega del paquete de diseño; no bloquean 10G/H/I ni Fases 11-14)
Continuación de: [archive/v1-master-plan-executed.md](archive/v1-master-plan-executed.md) (fases 1A–7B completadas)
Alcance: 8 fases, 41 ramas, ~41 PRs independientes y revisables

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

Cada una de las ramas sigue este ciclo. Las herramientas listadas aquí son el **default**. Cada rama solo cita herramientas *extra* específicas. Referencias a herramientas: ver `docs/archive/global-skills-reference.md` para qué hace cada una.

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
| 10 | Media + Guide Renderer + Presentation layer + PWA | 9 | Medio | Alto | Sí (storage, media URLs, `GuideTree` schema v3) |
| 11 | Knowledge + Assistant + i18n | 6 | Alto | Alto | No |
| 12 | Messaging con variables | 3 | Medio | Alto | No |
| 13 | Guía local + issue reporting | 4 | Bajo | Medio | No |
| 14 | Platform integrations | 4 | Alto | Alto | Posible |

**Total**: 33 ramas (12 ✅ completadas hasta 10E; 21 pendientes). Math: Fase 8 (3) + Fase 9 (4) + 10A–10E (5) = 12. La rama `refactor/shared-action-result` (PR #55) queda **fuera** de este recuento del plan por ser refactor interno, no rama numerada. El alta de la rama 10F `fix/guest-presentation-layer` (rev. 4, [HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md](research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md)) separa **presentación** de **modelo** antes de abrir la senda de UX premium (hero, search, PWA).

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

## FASE 10 — Media, Presentation layer y Guest UX premium

**Objetivo macro**: pasar de "tenemos los datos y un renderer estructurado" a "el huésped recibe una experiencia móvil operativa, sin fuga de modelo interno, con acciones críticas a un toque y funcionando offline".

La fase tenía originalmente foco en media (10A–10D) + renderer (10E) + hero/search/PWA (10F/G/H). La auditoría externa de [HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md](research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md) detectó un problema bloqueante que precede a cualquier polish visual o performance: **el pipeline `composeGuide → filterByAudience → render` filtra por visibilidad pero NO traduce el modelo interno a una capa de presentación adecuada al huésped**. El guest todavía puede ver — cuando el contenido existe — JSON crudo (`policiesJson`, `featuresJson`, `accessMethodsJson`), claves técnicas (`rm.smoking_outdoor_only`, `ct.host`), copy editorial pensado para el host ("Añade al menos un contacto de anfitrión..."), o labels internos ("Propiedad", "Slot"). Arreglar el hero o meter búsqueda sobre un modelo que sigue filtrando estructura interna es construir encima de un bug de contrato.

Por eso rev.4 inserta una nueva rama **10F — `fix/guest-presentation-layer`** entre el renderer (10E) y la iteración de UX (hero/search/PWA). Su scope es quirúrgico: añadir un paso terminal `normalizeGuideForPresentation(tree, audience)` que convierte cada `GuideItem` en un objeto listo para renderizar, aplica presenters humanizados (taxonomía + registry), sella invariantes anti-leak y prepara (sin consumir) los flags editoriales que las ramas posteriores usarán (`heroEligible`, `quickActionEligible`, `guestCriticality`). Bumpea `GUIDE_TREE_SCHEMA_VERSION` a 3. Renumera 10F→10G, 10G→10H, 10H→10I.

**Reprioridad (post-auditoría)**:

1. **10C/D/E quedan como están** — media + proxy + renderer son infraestructura irrenunciable.
2. **10F (nueva)** — presentation boundary. *Esta es ahora la rama de mayor valor por esfuerzo unitario*: destrábala y todo el resto de UX gana.
3. **10G hero + quick actions** — consume ya las ayudas del presenter (`heroEligible`, `quickActionEligible`, `displayValue` listo para copiar). Curación real queda protegida por invariantes.
4. **10H search** — indexa sobre `displayValue` / `displayFields`, no sobre raw.
5. **10I PWA** — caché sobre el output ya presentado + invariante "offline nunca escapa más de lo que escapaba online".

Sin fotos, la Guest Guide vale a medias. Sin capa de presentación, además, **tampoco se puede publicar con orgullo** — no hay polish cosmético que tape un `"rm.smoking_outdoor_only"` en la pantalla del huésped.

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

**Propósito**: poblar `GuideItem.media[]` (hoy siempre `[]`) con assets reales por entidad y renderizarlos en markdown/HTML: el renderer markdown emite imagen en sintaxis markdown (`![alt](url) *caption*`) con caption textual cuando exista, y el renderer HTML emite `<figure>/<figcaption>`. La ruta estable `/g/:slug/media/:assetId-:hashPrefix/:variant` ya la proporciona 10D — 10C **nunca** emite URLs presignadas (invariante en `guide-rendering-proxy-urls.test.ts`).

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- **Variante por defecto en 10C**: `md` (800 px) únicamente. La multi-variante para galería con lightbox se implementa en 10E (React renderer).
- **Entidades con media**: `property` (cover → primer item de Llegada), `space` (items del resolver `spaces`), `PropertyAmenityInstance` (items del resolver `amenities`), `access_method` (cuando `property.primaryAccessMethod` tiene assignments sobre la clave de taxonomía correspondiente).
- **Filtro por role**: todos los assets con `status="ready"` y `MediaAsset.visibility` compatible con la audiencia, ordenados por `MediaAssignment.sortOrder`. El renderer decide el cap visual (máx 3 por item en markdown para no saturar).
- **Caption**: `MediaAsset.caption` como fuente única; sin fallback (figcaption omitido si está vacío).
- **`alt` derivado** (mejora C): si `caption` está vacío, se computa `alt` a partir de `assetRoleKey` + entity label ("Cover de Cocina") para no romper accesibilidad WCAG.
- **`variants`** (mejora B): `GuideMedia` incluye `variants: { thumb, md, full }` en todas las URLs desde 10C. Coste en `treeJson` (~3× tamaño del bloque media), pero 10E/10H (PWA) y cualquier consumidor srcset lo reutilizan sin recomputar.
- **Flag `includesMedia` en secciones**: `arrival`, `spaces`, `amenities` → `true`; `local`, `rules`, `contacts`, `emergency` → `false`. `local` flipea a `true` cuando llegue la rama 13D. El batch loader omite las secciones con `includesMedia:false` para evitar cargar assignments que no se van a renderizar.

**Archivos a crear**:
- `src/lib/services/guide-media.service.ts` — `loadEntityMedia(publicSlug, audience, refs)` → `Map<entityKey, GuideMedia[]>`. Si `publicSlug` es `null`, retorna temprano sin consultar. Una sola query batch `findMany` sobre `MediaAssignment` con `IN` (entityIds), filtra por `visibility`, `status="ready"` y `mimeType startsWith "image/"`, ordena por `sortOrder`. Construye las URLs con `buildMediaProxyUrl()` para las tres variantes.
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

**Decisiones cerradas en Fase -1 (2026-04-17, kickoff 10E)**:
- Design tokens: adoptar **principios** (escala tipográfica Inter 13/14/15/16/20/28, spacing 4/8/12/16/24/32/48, radius 12/10, targets 44×44, contraste AA, sombras mínimas) **mapeados a los tokens existentes del repo** (`--color-primary-500` indigo, no el teal `#0F766E` del research).
- Brand theming por property: `Property.brandLogoUrl?` + `Property.brandPaletteKey?` (FK lógica a `BRAND_PALETTE`). **No HEX libre** — curated palette chooser (6-8 colores con par `{light, dark}` pre-validado AA contra texto neutral-50/neutral-900). `src/config/brand-palette.ts` define los pares; cada pair se precomputa aplicando regla HSL (`dark = lighten(light, ~+20L) · desaturate(-10S)`) congelada en build, no en runtime. Dark primary auto-derivado **dentro del scope de esta rama**. No fonts personalizados.
- Lightbox: `yet-another-react-lightbox` v3 + plugin video. **Lazy-loaded con `next/dynamic({ ssr: false })`** en tap a imagen — no entra en el bundle inicial del shell público (protege Lighthouse mobile ≥85).
- Mapas: componente stub con interfaz `GuideMap`; Leaflet se cablea en 13C.
- Arquitectura de renderers: **registry `public-guide-section-registry.ts`** (sectionKey → Component), no pivot monolítico. Aunque incialmente 1-2 renderers bastan, la registry es la opción de largo plazo coherente con `icon-registry`/`field-type-registry` del repo.
- Secciones nuevas en `guide_sections.json`:
  - `gs.essentials` — aggregator, `sourceResolverKeys: ["arrival", "amenities", "rules", "contacts"]`, filtra items cuyo `taxonomyKey` lleva `journeyTags: ["essential"]` en su taxonomía de origen. **Dedup semantics**: `essentials` **clona** los items en el hero, las secciones originales **siguen apareciendo** intactas. El TOC sticky filtra secciones con `isAggregator: true` (aparecen visualmente al inicio, no se listan en el TOC para evitar saltos duplicados).
  - `gs.howto` — nueva, renderiza `SpaceFeature` + `AmenityInstance.runbookJson`.
  - `gs.checkout` — nueva, items desde `policy_taxonomy` con `journeyStage: "checkout"` (campo **añadido en esta rama** a las entries relevantes).
  - `gs.emergency` — absorbe `contacts` con rol `emergency_service` / `host_primary` / `host_backup`.
- **Journey tags source**: campo `journeyTags: string[]` añadido a `amenity_taxonomy.json` + `policy_taxonomy.json` + (si aplica) `access_method_taxonomy.json`. Resolver los lee al emitir `GuideItem.journeyTags`. No hard-code en resolvers ni en `guide_sections.json`.
- **Empty state copy**: campo `emptyCopy: string` por sección en `guide_sections.json`. Renderer consume directamente — añadir copy nuevo = editar JSON, no componentes.
- Hooks tipados para `sensitiveAccessAllowed` y `journeyStage` quedan apagados por defecto (activación en FUTURE cuando exista reservation context).
- ISR para shell pública (no datos sensibles): **solo tag** — `export const revalidate = false` + `revalidateTag('guide-' + slug)` invocado en `publishGuideVersionAction`. Sin revalidación periódica (evita hits innecesarios a una guía que no cambia).
- **Schema version de `GuideVersion.treeJson`**: añadir columna `treeSchemaVersion Int @default(1)` en `GuideVersion`. Snapshots pre-10E (v1) se renderizan con degradación: el renderer v2 acepta secciones sin `isHero`/`isAggregator`/`journeyTags` (todos `?`) y emite un log `[guide-renderer] snapshot outdated — recomendado re-publicar` cuando detecta `treeSchemaVersion < 2`. Defaults en tipos + compat runtime, sin forzar re-publish masivo en deploy.
- `AmenityInstance.runbookJson Json?` **se añade en esta rama** (no diferido). Prisma change: 1 columna nullable más en `amenity_instances`. Resolver de `gs.howto` lo emite cuando `!= null`.
- **Release gates de accesibilidad dobles**: (1) `guide-accessibility.test.ts` Vitest unit sobre fixture renderizada (rápido, bloquea local + CI) + (2) Playwright smoke `axe-playwright` en `/g/<fixture>` renderizado de verdad (detecta focus trap de lightbox, aria-live de toasts, interacciones con teclado). Ambos son gate de PR.

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
- `src/config/brand-palette.ts` — curated palette chooser: 6-8 pares `{ key, label, light, dark }` AA-validados; dark precomputado por regla HSL congelada.
- `src/app/g/[slug]/guide.css` — estilos mobile-first + breakpoints.
- `src/lib/services/guide-sections/essentials-aggregator.ts` — resuelve Esenciales desde múltiples `sourceResolverKeys` con dedup (clona sin eliminar originales).
- `src/test/guide-renderer-playwright.spec.ts` — Playwright smoke con `axe-playwright` sobre `/g/<fixture>` (release gate).

**Archivos a modificar**:
- `taxonomies/guide_sections.json` — reestructuración completa (Esenciales, Cómo usar, Salida, fusión contacts→Emergency) + nuevos flags (`journeyStage`, `isHero`, `isAggregator`, `sourceResolverKeys`, `journeyTags`, `emptyCopy`).
- `taxonomies/amenity_taxonomy.json` — añadir `journeyTags: string[]` (marcar wifi/access_code/heating_primary/etc. como `["essential"]`).
- `taxonomies/policy_taxonomy.json` — añadir `journeyStage?: "arrival" | "stay" | "checkout"` a las policies relevantes + `journeyTags?: string[]`.
- `taxonomies/access_method_taxonomy.json` — añadir `journeyTags?: string[]` si aplica para `arrival` essential items.
- `src/lib/services/guide-rendering.service.ts` — resolvers nuevos (`howto`, `checkout`) + soporte aggregator + graceful degradation. Emitir `journeyTags` en los items leyendo de taxonomías.
- `src/lib/types/guide-tree.ts` — añadir `journeyStage?`, `journeyTags?`, `runbookJson?` en `GuideItem`; `isHero?`, `isAggregator?`, `emptyCopy?` en `GuideSection`; `schemaVersion?: number` en `GuideTree`. Hooks tipados para `sensitiveAccessAllowed`.
- `src/lib/taxonomy-loader.ts` — actualizar Zod schema de `guide_sections.json` + taxonomías con nuevos campos.
- `prisma/schema.prisma` — `Property.brandLogoUrl String?`, `Property.brandPaletteKey String?`, `AmenityInstance.runbookJson Json?`, `GuideVersion.treeSchemaVersion Int @default(1)`.
- `src/lib/actions/guide.actions.ts` (o equivalente que aloje `publishGuideVersionAction`) — invocar `revalidateTag('guide-' + slug)` tras publish/unpublish/rollback + escribir `treeSchemaVersion: 2` en nuevos snapshots.
- `src/app/g/[slug]/page.tsx` — sustituir `renderHtml()` + `dangerouslySetInnerHTML` con `<GuideRenderer tree={guestTree} slug={slug} />`, `export const revalidate = false`, log `snapshot outdated` si `treeSchemaVersion < 2`.

**Tests**:
- `src/test/guide-react-renderer.test.tsx` — cada sección se renderiza; media en galería (mock del lightbox lazy); TOC contiene secciones no vacías y **excluye aggregators** (`isAggregator: true`); deprecated marcado visualmente.
- `src/test/guide-sections-journey.test.ts` — `gs.essentials` clona items sin eliminar originales; `gs.howto` incluye items con `runbookJson`; `gs.checkout` filtra por `journeyStage`.
- `src/test/guide-brand-theming.test.ts` — property sin branding cae a tokens default; con `brandPaletteKey` inyecta CSS vars `{ primary-light, primary-dark }` del palette. Palette desconocida en DB cae a default con warning.
- `src/test/guide-accessibility.test.ts` — axe-core smoke (Vitest): sin violations WCAG 2.2 AA en fixture renderizada (unit, no DOM real).
- `src/test/guide-renderer-playwright.spec.ts` — `axe-playwright` sobre `/g/<fixture>` real (release gate): focus trap del lightbox, aria-live, keyboard nav del TOC, lazy-loading del lightbox solo tras tap.
- `src/test/guide-empty-states.test.ts` — cada sección emite `emptyCopy` explícito en audience=guest; sección sin `emptyCopy` lanza en Zod (no fallback silencioso).
- `src/test/guide-schema-version-compat.test.ts` — snapshot v1 (sin `isHero`/`journeyTags`) renderiza sin romper + emite log de "outdated"; snapshot v2 no emite log.
- `src/test/brand-palette.test.ts` — cada pair del palette cumple contraste AA (4.5:1) contra neutral-50 y neutral-900; HSL derivation determinista.
- `src/test/guide-sections-coverage.test.ts` (actualizar de 9A) — cubre las nuevas secciones.

**Criterio de done**: `/g/:slug` se ve profesional, mobile-first, con TOC navegable (sin aggregators), iconos, cards, galería lightbox lazy-loaded (imagen+video), empty states explícitos desde `emptyCopy`, brand theming aplicado vía `brandPaletteKey` con par light+dark. Añadir una sección nueva a `guide_sections.json` la renderiza automáticamente sin tocar componentes (solo registry entry cuando el renderer difiere). Axe-core sin violations AA **en Vitest y Playwright**. Lighthouse mobile Performance ≥85 con lightbox lazy. Snapshots v1 (pre-10E) renderizan con degradación + log de "outdated"; snapshots v2 sin log.

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

### Rama 10F — `fix/guest-presentation-layer`

**Propósito**: sellar la frontera entre **modelo interno** (JSON, enums, copy editorial del host) y **presentación al huésped**. Introduce el paso terminal `normalizeGuideForPresentation(tree, audience)` al final del pipeline (`composeGuide → filterByAudience → normalizeGuideForPresentation → render`), un **presenter registry** (taxonomyKey → formatter humanizado) y el contrato de fields de presentación (`presentationType?`, `displayValue?`, `displayFields?`, `presentationWarnings?`). Bumpea `GUIDE_TREE_SCHEMA_VERSION` a 3 y documenta la degradación de snapshots pre-v3 (se normalizan en boot al servir). Prepara — **sin consumir** — los flags editoriales que las ramas posteriores usarán: `heroEligible`, `quickActionEligible`, `guestCriticality`, `hideWhenEmptyForGuest`. Deja invariantes y tests de regresión como red de seguridad permanente.

**Por qué esta rama (resumen del fallo actual)**:

- `policies.jsonSchemaRef: "rooms.smoking_rules"` que viajen a `guest` todavía pueden renderizarse como JSON crudo porque no hay normalización post-filter.
- Enums de taxonomía (`rm.smoking_outdoor_only`, `ct.host`, `am.wifi`) y claves de sección (`gs.essentials`) filtran sin un diccionario humano (`EnumLabels`).
- `emptyCopy` de `guide_sections.json` — copy editorial pensada para el host ("Añade normas de ruido, fumar, mascotas y eventos.") — hoy sale tal cual a `audience=guest`.
- `GuideSection.label` interno ("Normas de la casa"), `GuideItem.label` igual al roleKey (`ct.cleaning`) y JSON contenedores (`featuresJson`, `accessMethodsJson`) no tienen traducción declarativa.
- No hay invariante que bloquee un regreso: basta con un resolver nuevo que escriba `value: JSON.stringify(...)` y nadie se da cuenta hasta QA manual.

**Motivación (auditoría externa)**:

- [HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md §1](research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md) — "Arquitectura sólida, frontera guest↔modelo floja".
- [HANDOFF §2](research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md) — inventario de leaks visibles.
- [HANDOFF §4](research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md) — por qué arreglar hero/búsqueda antes de cerrar la frontera es construir sobre bug.
- [HANDOFF §7](research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md) — spec precisa del normalizador + presenter registry + invariantes.

**Decisiones cerradas en Fase -1 (2026-04-17)**:

- **Pipeline canónico**: `composeGuide → filterByAudience → normalizeGuideForPresentation → render`. El normalizador es **terminal y puro** (input tree filtrado → output tree presentado); no hace DB, no muta input. Se invoca también al servir `snapshotJson` — snapshots pre-v3 pasan por él con un warning `pre-v3-normalize`.
- **Contrato de tipo (superficie mínima)**: `GuideItem` crece con 4 campos opcionales. **No se añaden flags derivables**:
  - `presentationType?: "text" | "enum" | "policy" | "contact" | "amenity" | "space" | "checkin_window" | "access_instruction" | "raw"` — `raw` es sentinel de bug (solo en `audience=internal`, en `guest` bloquea el render con warning + empty state).
  - `displayValue?: string` — primary value humanizado.
  - `displayFields?: Array<{ label: string; value: string; icon?: string; href?: string }>` — fields ya traducidos; `href` habilita `tel:`/`mailto:`/`https://wa.me/`.
  - `presentationWarnings?: string[]` — p.ej. `"missing-taxonomy-label:rm.smoking_outdoor_only"`.
- **No** se añaden `heroEligible` / `quickActionEligible` / `guestCriticality` al tipo `GuideItem` en esta rama — se declaran en las **taxonomías** (`amenity_taxonomy.json`, `policy_taxonomy.json`, `contact_roles.json`) y se propagan como `displayFields.meta` solo si el presenter los usa. Las ramas 10G (hero) y 10H (search) los leen.
- **Presenter registry** (`src/config/registries/presenter-registry.ts`): `Map<string, (item, context) => { displayValue, displayFields, presentationType, warnings[] }>`. Claves = `taxonomyKey` o `presentationType`. Default fallback: presenter `generic-text` que limpia y escapa.
  - Cobertura mínima **obligatoria en esta rama**: todas las keys de `policy_taxonomy.json`, todas de `contact_roles.json`, todas de `amenity_taxonomy.json`.
  - `access_method` queda para cuando realmente aparezca una key problemática sin presenter — el test de cobertura lo forzará.
  - Test `presenter-coverage.test.ts` falla si existe `taxonomyKey` en las 3 taxonomías sin presenter y sin fallback explícito declarado.
- **Taxonomías extendidas** (3 archivos, solo añadir campos, ningún remove):
  - `policy_taxonomy.json` → cada entry: `guestLabel?`, `guestDescription?`, `icon?`, `heroEligible?: boolean`, `quickActionEligible?: boolean`, `guestCriticality?: "critical" | "high" | "normal" | "low"`.
  - `contact_roles.json` → cada entry: `guestLabel?`, `icon?`, `heroEligible?`, `quickActionEligible?`, `guestCriticality?`.
  - `amenity_taxonomy.json` → cada entry: `guestLabel?`, `guestDescription?`, `icon?`, `heroEligible?`, `quickActionEligible?`, `guestCriticality?`.
  - Zod del loader se extiende con defaults seguros (`heroEligible: false`, `guestCriticality: "normal"`).
- **`guide_sections.json`** — se añade `emptyCopyGuest?: string` y `hideWhenEmptyForGuest?: boolean`. `emptyCopy` queda como copy **para host** (audience `internal`). Si `emptyCopyGuest` falta y audience=guest, el normalizador NO emite ninguna copy editorial; la sección se puede ocultar (`hideWhenEmptyForGuest`) o emite un empty state neutro (`"—"`). Nunca se muestra copy editorial del host al huésped.
- **`GUIDE_TREE_SCHEMA_VERSION = 3`** (en `guide-tree.ts`). Snapshots pre-v3 se re-normalizan al servir (runtime no migra; no se reescriben en DB). Se loggea una vez por request con `snapshotPreV3`.
- **Invariantes anti-leak (tests)**:
  1. Para `audience=guest`, ningún `GuideItemField.value` ni `displayValue` empieza por `{`, `[`, contiene `\"json\":`, o termina en `}`.
  2. Ningún `displayValue` / `displayFields.value` en `audience=guest` coincide con una **clave** de taxonomía (`^[a-z]+(_[a-z]+)*\\.[a-z_]+$` — `rm.x`, `ct.y`, `am.z`).
  3. Ninguna `section.emptyCopy` aparece en el tree cuando `audience=guest`; solo puede aparecer `emptyCopyGuest` si está declarado.
  4. Ningún `displayValue` o `label` en `audience=guest` está en la deny-list de labels internos: `"Slot"`, `"Propiedad"`, `"Config JSON"`, `"Raw"`, etc. (lista en `src/test/guest-leak-invariants.ts`).
  5. Items con `presentationType === "raw"` en `audience=guest` → error en render (no se muestra; log).
- **Observabilidad**: el normalizador cuenta `presentationWarnings` por tree y emite un `Sentry.captureMessage` (o `console.warn` en dev) con el top-10 warnings por property — sirve para auditar coverage de presenters al crecer las taxonomías.
- **Scope NO incluido (explicit out-of-scope)**:
  - No cambia el renderer (10E) salvo para llamar al normalizador y consumir `displayValue`/`displayFields` en lugar de `value`/`fields`.
  - No curación de hero, ni búsqueda, ni PWA — eso queda en 10G/H/I.
  - No migración de snapshots publicados en DB (se normalizan al servir).
  - No crea `presentationType: "raw"` nuevos — solo se usa como sentinel de bug.
  - No cambia `GuideItemField.visibility` (sigue filtrando por audience). La capa de presentación opera **después** del filter.

**Archivos a crear**:

- `src/lib/services/guide-presentation.service.ts` — función pura `normalizeGuideForPresentation(tree: GuideTree, audience: GuideAudience): GuideTree`. Recorre secciones + items + children recursivamente y llama al presenter registry.
- `src/config/registries/presenter-registry.ts` — `Map<string, Presenter>` + helper `getPresenter(item)` con fallback a `generic-text`.
- `src/lib/presenters/policy-presenter.ts` — presenter para items con `taxonomyKey` que empieza por `rm.` o `pl.`. Consume `policy_taxonomy.json[key].guestLabel` / `guestDescription`.
- `src/lib/presenters/contact-presenter.ts` — presenter para `ct.*`. Emite `displayFields` con `href: "tel:+..."` para teléfono, `href: "https://wa.me/..."` si hay flag `whatsappAvailable`, `href: "mailto:..."` para email.
- `src/lib/presenters/amenity-presenter.ts` — presenter para `am.*`. Consume `amenity_taxonomy.json[key].guestLabel`, `guestDescription`, `icon`.
- `src/lib/presenters/space-presenter.ts` — presenter para items de `gs.spaces`; humaniza `spaceType` + bed summary + features.
- `src/lib/presenters/checkin-window-presenter.ts` — presenter específico para el par `checkInStart/checkInEnd` → `"De 16:00 a 22:00"` con locale.
- `src/lib/presenters/access-instruction-presenter.ts` — presenter para `accessMethodsJson` (humaniza JSON → lista de pasos) cuando el flag `primaryAccessMethod` existe.
- `src/lib/presenters/generic-text-presenter.ts` — fallback: escapa HTML, deja string plano, loggea `missing-presenter` warning.
- `src/test/guide-presentation.test.ts` — happy path: cada presenter produce `displayValue` no-vacío para fixture real.
- `src/test/guest-leak-invariants.test.ts` — 5 invariantes descritas arriba, corre sobre fixture "todo configurado con valores raros" (enums deprecated, JSON en campos libres, contact sin label).
- `src/test/presenter-coverage.test.ts` — para cada `taxonomyKey` en `policy_taxonomy.json | contact_roles.json | amenity_taxonomy.json`, debe existir presenter o estar en allowlist explícita.
- `src/test/guest-schema-version.test.ts` — trees recién compuestos llevan `schemaVersion: 3`; snapshots fixture pre-v3 pasan por normalizador y quedan válidos con warning.

**Archivos a modificar**:

- `src/lib/types/guide-tree.ts` — añadir los 4 campos opcionales a `GuideItem`, bump `GUIDE_TREE_SCHEMA_VERSION = 3`, documentar contrato (comment top-of-file).
- `src/lib/services/guide-rendering.service.ts` — `composeGuide(...)` llama a `normalizeGuideForPresentation(tree, audience)` como último paso antes de devolver. El normalizador vive en un módulo separado para test-aislado.
- `src/app/g/[slug]/page.tsx` — cuando sirve `snapshotJson` legacy, pasa por `normalizeGuideForPresentation` si `schemaVersion` ausente o `<3`. Loguea `snapshotPreV3` una vez por request.
- `src/lib/actions/guide.actions.ts` — al **publicar** (`publishGuideVersionAction`), persistir el tree ya normalizado (con `schemaVersion: 3`). No hay backfill masivo; snapshots viejos se normalizan al servir.
- `taxonomies/policy_taxonomy.json` — añadir `guestLabel` / `guestDescription` / `icon` / `heroEligible` / `quickActionEligible` / `guestCriticality` a cada entry (valores concretos, nada `null`).
- `taxonomies/contact_roles.json` — idem.
- `taxonomies/amenity_taxonomy.json` — idem.
- `taxonomies/guide_sections.json` — añadir `emptyCopyGuest` + `hideWhenEmptyForGuest` a cada sección; renombrar semántica: `emptyCopy` pasa a significar "copy para host/internal". Ajustar Zod en `taxonomy-loader.ts`.
- `src/lib/taxonomy-loader.ts` — Zod extendido + tipos derivados exportados.
- `src/components/public-guide/guide-renderer.tsx` — consume `displayValue` / `displayFields` (ya humanizados); si `presentationType === "raw"` en audience guest, renderiza nada + log. NO debe volver a formatear; el normalizador es la única fuente de verdad.
- `src/test/guide-rendering.test.ts` — actualizar mocks y expectativas para que verifiquen `displayValue` donde antes miraban `value`.
- Playwright + axe-core diferidos al harness dedicado (ver rama `chore/e2e-harness-public-guide` más abajo). Aquí no se añade ni `@axe-core/playwright` ni `playwright.config.ts`.

**Tests (mínimo)**:

- `guide-presentation.test.ts` — purity + idempotence + audience-awareness; cada presenter produce `displayValue` / `displayFields` esperados.
- `guest-leak-invariants.test.ts` — **5 invariantes** anti-leak sobre fixture adversarial, verificadas sobre tree + markdown + html render paths.
- `presenter-coverage.test.ts` — cobertura 100% de `pol.*` (prefix) y `ct.*` (prefix) + auditoría de fallback genérico.
- `guest-schema-version.test.ts` — `GUIDE_TREE_SCHEMA_VERSION = 3` emitido al publicar; snapshots pre-v3 pasan por normalizador al servir (idempotencia verificada).
- `guide-empty-states.test.ts` — matriz A3 (`emptyCopy` host vs `emptyCopyGuest` vs `hideWhenEmptyForGuest`) validada sección por sección; `emptyCopy` host nunca llega a `audience=guest`.
- `src/test/fixtures/adversarial-property.ts` — fixture compartida que empaqueta los 5 leak shapes (raw JSON, taxonomy keys, editorial host copy, internal labels, empty section forzada).

**Criterio de done**:

- `npm run test` verde (incluye los 5 archivos de tests nuevos: `guide-presentation`, `guest-leak-invariants`, `presenter-coverage`, `guide-empty-states`, `guest-schema-version`).
- `tsc --noEmit` verde tras `prisma generate`.
- Las 5 invariantes anti-leak verificadas unitariamente con fixture adversarial empaquetada en `src/test/fixtures/adversarial-property.ts` (cobertura sobre el tree + markdown + html).
- Smoke manual con `/g/:slug` sobre fixture adversarial (valores enum desconocidos + JSON en campos libres + contacto con `label === roleKey`) muestra empty-state neutro o texto humanizado, nunca JSON ni enums.
- `/simplify` pasado sobre todos los cambios de la rama antes de abrir PR.
- **Playwright + axe-core diferidos a la rama `chore/e2e-harness-public-guide`** (ver sección dedicada más abajo): 10F cierra con gates unitarios exhaustivos; el harness E2E+a11y queda como rama formal siguiente, reutilizable por 10G/10H/10I.

**Preparación**:

- **Contexto a leer**:
  - [docs/research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md](research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md) — completa, especialmente §§1, 2, 4, 7.
  - [docs/research/GUEST_GUIDE_SPEC.md](research/GUEST_GUIDE_SPEC.md) §§ sobre audience separation + emergency/contacts.
  - `src/lib/services/guide-rendering.service.ts`, `src/lib/types/guide-tree.ts`, `src/test/guide-rendering.test.ts` (pipeline actual).
  - `taxonomies/policy_taxonomy.json`, `taxonomies/contact_roles.json`, `taxonomies/amenity_taxonomy.json`, `taxonomies/guide_sections.json`.
  - `src/config/registries/field-type-registry.ts` (modelo mental del registry pattern a replicar).
  - `docs/FEATURES/GUEST_GUIDE_UX.md` (creado en este plan-update PR) para conocer qué espera consumir 10G/H.
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § "Rendering model" — marcar la capa de presentación como componente estable (no sólo planeada).
  - `docs/CONFIG_DRIVEN_SYSTEM.md` § "Presenter registry" — mover de "añadir presenter" a "presenters activos por taxonomía".
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Sections journey" — pipeline con paso normalizador.
  - `CLAUDE.md` § "Patrones — Guía pública (audience=guest)" — reforzar invariantes y añadir las reglas duras que surjan durante la implementación.
  - `docs/QA_AND_RELEASE.md` § "Final release gates" — marcar gates 8–11 (anti-leak) como verificados automáticamente por esta rama.
  - `docs/ROADMAP.md` — marcar 10F ✅ al terminar.
- **Skills/tools obligatorios** (ver [GUEST_GUIDE_UX.md § Tooling obligatorio](../FEATURES/GUEST_GUIDE_UX.md)):
  - **Agent `code-explorer`** antes de tocar código — mapear todos los puntos donde el renderer actual lee `value`/`fields` directamente (para saber cuántos sitios tocar sin romper).
  - **Agent `code-architect`** antes de codificar — consolidar la decisión `registry-por-clave vs presenter-por-type` y el shape exacto de `displayFields`. Output mínimo: 1 documento interno con los contratos.
  - **Context7** (auto) — Zod v3 defaults + `z.discriminatedUnion`.
  - **`/simplify`** obligatorio antes de abrir PR (§2.6).
  - **`/pre-commit-review`** antes de cada commit (§2.6).
  - Playwright + `@axe-core/playwright`: **no aquí** — viven en la rama `chore/e2e-harness-public-guide`, que introduce la infra compartida por 10G/10H/10I.

**Relación con ramas posteriores**:

- **10G `feat/guide-hero-quick-actions`** lee `heroEligible` + `quickActionEligible` de las taxonomías extendidas aquí; consume `displayValue` para copy/WA text; no puede regresar a `value` raw.
- **10H `feat/guide-client-search`** indexa `displayValue` + `displayFields.value` como único input → no hay forma de filtrar por enums internos (bonus: el invariante 2 impide que lo intente).
- **10I `feat/guide-pwa-offline`** cachea el tree ya normalizado; ganar offline no degrada la frontera.
- **Fase 11 `feat/knowledge-autoextract`** puede usar `presenter-registry` para generar `bm25Text` humanizado de KnowledgeItems — reutilización directa.

---

### Rama 10G — `feat/guide-hero-quick-actions`

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
- `package.json` — añadir deps de UI guest declaradas en [GUEST_GUIDE_UX.md § Librerías recomendadas](../FEATURES/GUEST_GUIDE_UX.md): `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide-react`, `date-fns`, `@radix-ui/react-accordion`, `@radix-ui/react-dialog`, `@radix-ui/react-toast`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-scroll-area`, `@radix-ui/react-visually-hidden`. `framer-motion` **solo** si una microinteracción concreta lo justifica; si no, CSS.

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
- **Skills/tools obligatorios** (ver [GUEST_GUIDE_UX.md § Tooling obligatorio](../FEATURES/GUEST_GUIDE_UX.md)):
  - **`/excalidraw-diagram`** **antes de codificar** — mockup del hero en mobile 375 y desktop 1280 (las 4 respuestas críticas + quick actions); commit del `.excalidraw` en `docs/research/sketches/10G-hero.excalidraw`.
  - **`/firecrawl-search`** antes — re-benchmark de hero/quick-actions en Touch Stay / Hostfully / Enso / Breezeway / Airbnb (últimos 6 meses).
  - **Agent `code-architect`** — valida shape del `quick-action-registry` + contrato `resolveValue(tree)` antes de implementar.
  - **Context7** (auto) — Clipboard API spec, URI schemes `tel:`/`wa.me`/`geo:`/universal Maps links, `@radix-ui/react-toast`.
  - **E2E + axe-core**: reutilizar el harness compartido introducido en la rama `chore/e2e-harness-public-guide`. 10G añade specs específicos para hero + quick actions (copy/tel/wa.me/maps) en las 3 viewports; los gates de accesibilidad heredan `serious/critical = 0`.
  - **`/simplify`** tras implementar — validar que 10E+10F+10G no duplican lógica de resolución.
  - **`/pre-commit-review`** antes de cada commit.

---

### Rama 10H — `feat/guide-client-search`

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
- `package.json` — añadir `fuse.js` (cliente) como dependency.

**Tests**:
- `src/test/guide-search-index.test.ts` — build desde fixture; "wifi" match amenity de wifi; "parking" match amenity/rule parking; item `sensitive` **nunca** aparece en index.
- `src/test/guide-search.test.tsx` — componente filtra en vivo; teclado `/` abre, `Escape` cierra, `Enter` navega, `ArrowUp`/`ArrowDown` mueven selección; 0 resultados muestra hint.
- `src/test/guide-search-performance.test.ts` — p95 <20ms en fixture realista (200 items).
- Playwright e2e en 3 viewports (375/768/1280) con `@axe-core/playwright` — focus trap del overlay, screen-reader labels, contraste AA del hint de cero resultados. 0 violations serious/critical.

**Criterio de done**: huésped tipea "wifi" y ve resultado en <1 frame, scroll lleva al item. Search funciona sin red. Analítica básica de queries sin resultado.

**Preparación**:
- **Contexto a leer**:
  - [docs/research/IMPLEMENTATION_PLAN.md:L44-L49](research/IMPLEMENTATION_PLAN.md).
  - Renderer de 10E, presentation layer de 10F, hero de 10G.
  - `GuideTree` types (9A) y filtrado guest (9A `filterByAudience`).
  - **Importante**: el index se construye desde `displayValue` / `displayFields.value` (10F), nunca desde `value` raw. Invariante: un hit nunca puede exponer texto que no haya pasado por el normalizador.
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § "Public guide rendering" — añadir capa search.
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Client search" — separación con 11F semantic.
- **Skills/tools obligatorios** (ver [GUEST_GUIDE_UX.md § Tooling obligatorio](../FEATURES/GUEST_GUIDE_UX.md)):
  - **Agent `code-architect`** — valida shape del index + pesos antes de codificar (el index es un artefacto caliente, cambios posteriores fuerzan recomputar todo).
  - **Context7** (auto) — `fuse.js` v7.x (`threshold`, `keys`, `includeMatches`), `React.useDeferredValue`.
  - **E2E + axe-core**: reutilizar el harness compartido (`chore/e2e-harness-public-guide`). 10H añade specs para teclado (`/` abre, `Escape` cierra, `Enter` navega, arrows mueven selección), focus trap, y cero-results hint; gates a11y heredan `serious/critical = 0`.
  - **`/firecrawl-search`** — "guidebook instant search UX zero-result hint" + benchmarks de overlays en Airbnb / Touch Stay.
  - **`/simplify`** + **`/pre-commit-review`** obligatorios antes de PR.

---

### Rama 10I — `feat/guide-pwa-offline`

**Propósito**: convertir la guía pública en PWA instalable con caché crítica offline en 3 niveles. Sin red, el huésped sigue viendo Llegada, Wi-Fi, Ayuda y Salida. Add-to-Home-Screen nudge aparece después de la primera visita útil, no en el primer segundo.

**Motivación** (research):
- [GUEST_GUIDE_SPEC.md:L227-L232](research/GUEST_GUIDE_SPEC.md) — "Modo offline / conexión lenta... la guía debe mantener funcional el shell, el bloque esencial, los textos críticos y miniaturas de acceso".
- [GUEST_GUIDE_SPEC.md:L230-L232](research/GUEST_GUIDE_SPEC.md) — Add to Home Screen "solo después del primer valor real".
- [IMPLEMENTATION_PLAN.md:L49](research/IMPLEMENTATION_PLAN.md) — "enfoque manual alineado con docs oficiales de Next.js", NO `next-pwa` (poco mantenido + problemas con App Router).
- [IMPLEMENTATION_PLAN.md:L95-L106](research/IMPLEMENTATION_PLAN.md) — 3 niveles de caché (shell/CSS/íconos → predictive image → lazy noncritical).

**Decisiones cerradas en Fase -1 (2026-04-17, ajustadas 2026-04-19 al arrancar la rama)**:
- Service worker **manual**, no `next-pwa`.
- **Aislamiento por slug**: el SW se sirve desde `/g/[slug]/sw.js` (route handler dinámico) con `scope: "/g/[slug]/"` estricto. Un SW por property — el riesgo de leak cross-property pesa más que el coste operativo de mantener N registros activos. Caches namespaced por slug (`guide-<slug>-tier{N}-<v>`, donde `<slug>` se sustituye en runtime).
- Cache strategy:
  - **Nivel 1 (cache-first)**: CSS, fuentes Inter subset, íconos, manifest, offline page, JSON crítico de secciones `essentials`/`arrival`/`checkout`/`emergency` (incluye Llegada — la spec L227 la enumera explícitamente junto a Wi-Fi/Ayuda/Salida).
  - **HTML del slug**: `stale-while-revalidate` (no cache-first). Online: red gana siempre. Offline: cae al cache. Razón: `revalidatePath('/g/[slug]')` server-side debe llegar al usuario en la siguiente visita sin esperar a un cambio de versión del SW.
  - **Nivel 2 (stale-while-revalidate)**: primer thumb por espacio configurado (vía `/g/[slug]/media/[assetId]-[hashPrefix]/thumb` de 10D), con cap global de **12 imágenes** para acotar el peso del cache en propiedades grandes.
  - **Nivel 3 (network-first con fallback timeout 2s)**: galerías completas, vídeo, mapas.
- A2HS nudge: disparado tras 2 visitas o tiempo acumulado >90s; dismissible permanente vía `localStorage`. iOS Safari (sin `beforeinstallprompt`): modal manual mínimo con instrucciones nativas ("compartir → añadir a inicio"); mismo dismiss persistente. Copy y estética sobrios — re-skinable por Liora sin tocar lógica.
- Versionado del SW: reusa el `buildVersion` de `GuideSearchIndex` de 10H (SHA-1 12 chars sobre el tree). Inyectado en la URL de registro como `?v={buildVersion}` para forzar reinstalación al cambiar contenido. `skipWaiting()` + `clients.claim()` en `activate`.
- Fallback page `/g/[slug]/offline`: lista hardcodeada de secciones tier 1 (asunción dura: SW activo ⇒ tier 1 garantizado). Si SW no activo, mensaje "abre primero la guía con conexión".
- Theme color del manifest: derivado del `brandPaletteKey` actual de la property. Aceptado que instalaciones pre-Liora retengan ese color hasta reinstalar (iOS captura tile color al instalar).

**Archivos a crear**:
- `src/lib/server/sw-template.ts` — plantilla string del service worker (vanilla ES). **Vive fuera de `public/`** para que Next no la sirva como asset estático en `/sw.js` (eso reabriría un SW global con scope `/`, contradiciendo la decisión de aislamiento por slug). El route handler de la siguiente entrada importa el template, sustituye `__SLUG__` y `__SW_VERSION__`, y lo devuelve con `Content-Type: application/javascript`.
- `src/app/g/[slug]/sw.js/route.ts` — sirve el SW por slug con headers `Cache-Control: no-cache` y `Service-Worker-Allowed: /g/[slug]/`.
- `src/app/g/[slug]/manifest.webmanifest/route.ts` — manifest dinámico por property (nombre, íconos 192/512 + maskable, theme_color desde palette, scope/start_url por slug). **Único endpoint de manifest** — no se mantiene un `public/manifest.json` estático.
- `src/app/g/[slug]/layout.tsx` — crea el shell con `<link rel="manifest">` apuntando al endpoint dinámico, monta `<ServiceWorkerRegister />` + `<InstallNudge />`.
- `src/app/g/[slug]/offline/page.tsx` — fallback offline page (Server Component) con lista hardcodeada de secciones tier 1.
- `src/lib/client/service-worker-register.ts` — registra `/g/[slug]/sw.js?v={buildVersion}` con scope estricto, detecta `updatefound` y postea `SKIP_WAITING`.
- `src/lib/client/sw-precache-manifest.ts` — lista de assets críticos a precachear, codificada a mano (volumen pequeño, estable). Test de invariante valida que cada path apunta a un archivo existente.
- `src/components/public-guide/install-nudge.tsx` — client island con trigger condicional + branching iOS/Chromium.
- Íconos PWA placeholders en `public/icons/` (`guide-192.png`, `guide-512.png`, `guide-512-maskable.png`) — Liora los repondrá.

**Archivos a modificar**:
- `next.config.ts` — currently empty; añadir bloque `headers()` si fuera necesario para CSP (los headers del SW se sirven desde el route handler, no desde aquí).
- `src/components/public-guide/guide-renderer.tsx` (de 10E) — exponer al cliente la lista de secciones tier 1 (o equivalente) para que el SW pueda confirmar precache tras el primer render.
- `taxonomies/guide_sections.json` — flag `offlineCacheTier: 1|2|3` por sección. Tier 1: `gs.essentials`, `gs.arrival`, `gs.checkout`, `gs.emergency`. Tier 2: `gs.spaces`, `gs.amenities`. Tier 3: `gs.howto`, `gs.local`. Test de invariante falla si alguna sección no declara tier.

**Tests** (3 vitest + 1 E2E):
- `src/test/guide-pwa-manifest.test.ts` — manifest dinámico valida schema (name, short_name, scope, start_url por slug, íconos 192/512 + maskable, theme_color resuelto desde palette).
- `src/test/guide-sections-cache-tier.test.ts` — invariante: cada entrada de `guide_sections.json` declara `offlineCacheTier ∈ {1,2,3}`; tier 1 incluye los 4 mínimos (essentials, arrival, checkout, emergency).
- `src/test/guide-install-nudge.test.tsx` — primera visita no muestra nudge; aparece tras 2 visitas (mock localStorage); dismiss persiste.
- `e2e/guide-pwa-offline.spec.ts` (harness 10J) — airplane mode (`browserContext.setOffline(true)`): tras primera visita online, tier 1 sigue renderizando, offline page accesible. Axe-core sobre offline page: 0 serious/critical. A2HS: nudge aparece tras 2 visitas y desaparece al dismiss. Cache invalidation: tras cambio de `buildVersion`, el SW reemplaza la cache del tier 1.

**Criterio de done**: Lighthouse PWA ≥90. Airplane mode mostrando secciones Nivel 1 sin degradación. A2HS nudge verificado en iOS Safari + Chrome Android. No cache corruption al deploy siguiente (SW versioning funciona).

**Preparación**:
- **Contexto a leer**:
  - [docs/research/GUEST_GUIDE_SPEC.md:L225-L234](research/GUEST_GUIDE_SPEC.md).
  - [docs/research/IMPLEMENTATION_PLAN.md:L49-L50](research/IMPLEMENTATION_PLAN.md), [L94-L106](research/IMPLEMENTATION_PLAN.md).
  - Media proxy de 10D (rutas estables imprescindibles para cache).
  - Renderer de 10E, presentation layer de 10F, hero de 10G, search de 10H.
- **Docs a actualizar al terminar**:
  - `docs/ARCHITECTURE_OVERVIEW.md` § "Public guide rendering" — añadir PWA section.
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Offline strategy".
  - `CLAUDE.md` § "Entorno y comandos" — nota sobre SW en dev (http vs https, chrome://serviceworker-internals).
- **Skills/tools específicos**:
  - Defaults §2.
  - **Context7** (auto) — Service Worker API, Next.js 15 manifest + dynamic headers, MDN cache storage strategies.
  - **`/firecrawl-search`** antes — "next.js 15 app router pwa service worker manual", "touch stay offline guest guide".
  - **E2E**: reutilizar el harness (`chore/e2e-harness-public-guide`). 10I añade specs de airplane mode (`browserContext.setOffline(true)`) y A2HS trigger en chromium-mobile emulation, más cache-tier assertions.
  - **Agent code-architect** — diseñar versionado del SW + strategy de invalidación si la decisión no quedó cerrada.

---

### Rama 10J — `chore/e2e-harness-public-guide`

**Propósito**: introducir **una única vez** el harness E2E + accesibilidad que 10G, 10H y 10I reutilizan. Instala Playwright + `@axe-core/playwright`, define `playwright.config.ts` con 3 viewports (mobile 375, tablet 768, desktop 1280), monta fixtures navegables (`property-empty`, `property-rich`, `property-adversarial`) y deja specs mínimos que verifican los gates anti-leak (regex JSON crudo, regex de claves taxonómicas) y los gates de accesibilidad (axe-core, 0 violations serious/critical) sobre la ruta pública `/g/:slug`.

**Por qué sale de 10F**: 10F entregó las invariantes anti-leak como **tests unitarios exhaustivos** (tree + markdown + html) sobre fixture adversarial. Un Playwright stub-nivel añadido sólo para "cerrar 10F" habría sido pseudo-E2E débil — mismo coste que harness real pero sin la infra reutilizable que 10G/10H/10I necesitan. Mejor invertir una rama formal en el harness que será el gate de release para todo el bloque de guía pública.

**Decisiones cerradas en Fase -1 (pendiente al crear la rama)**:

- **Fixtures de propiedades navegables** en `src/test/fixtures/e2e/` (3 shapes: empty/rich/adversarial). Adversarial **reutiliza** `src/test/fixtures/adversarial-property.ts` de 10F — no duplicar.
- **Estrategia de servidor**: `next start` en puerto random + seed de DB via `prisma db push` sobre una SQLite temporal (`DATABASE_URL=file:./e2e-tmp.db`) o — preferible — fixtures en memoria vía mock del repositorio. Decisión final en Fase -1 de la rama.
- **Script npm**: `npm run test:e2e` (single command: seed → build → start → playwright test → teardown). Timeouts CI-friendly.
- **CI hook**: gate bloqueante en el workflow principal. Si axe-core detecta `serious` o `critical` → falla la PR. Si alguno de los regex anti-leak hace match → falla la PR.

**Archivos a crear**:

- `playwright.config.ts` — projects chromium (375/768/1280) + webkit-mobile (375).
- `e2e/public-guide.spec.ts` — smoke: renderiza las 3 fixtures, valida estructura básica, captura screenshots baseline.
- `e2e/guest-leak-invariants.spec.ts` — regex anti-leak sobre el DOM renderizado (invariantes 1–4 de 10F como E2E complementario).
- `e2e/axe-a11y.spec.ts` — `@axe-core/playwright` sobre cada fixture × cada viewport; 0 violations serious/critical.
- `src/test/fixtures/e2e/` — helpers para seedar fixtures `empty` / `rich` / `adversarial` en el server.
- `.github/workflows/e2e.yml` (o extender el workflow existente) — job E2E paralelo al job unit.

**Archivos a modificar**:

- `package.json` — añadir `@playwright/test`, `@axe-core/playwright` como devDependencies; añadir `test:e2e` script.
- `README.md` — sección "E2E tests" con comandos.
- `docs/QA_AND_RELEASE.md` — mover los gates Playwright+axe de 10F/G/H/I a esta rama como gate compartido.

**Tests (el harness ES el test)**:

- Las 3 suites de specs cubren los 3 gates: smoke + anti-leak + a11y.
- Fixtures `rich` y `adversarial` ejercitan todos los presenters/resolvers de 10F.

**Criterio de done**:

- `npm run test:e2e` verde local (3 viewports).
- CI verde: job E2E ejecuta en PRs y bloquea merge si falla.
- `docs/QA_AND_RELEASE.md` actualizado con el nuevo gate.
- 10G/10H/10I: su sección "Skills/tools" referencia este harness para Playwright+axe en vez de pedir herramientas ad-hoc.

**Preparación**:

- **Contexto a leer**:
  - [Playwright docs](https://playwright.dev/docs/intro) — fixtures, project configs, test lifecycle.
  - [@axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright) — integración, severity levels.
  - `src/test/fixtures/adversarial-property.ts` (10F) — punto de partida de la fixture adversarial navegable.
  - 10F PR entera — entender qué invariantes ya están cubiertas unitariamente para no duplicar.
- **Docs a actualizar al terminar**:
  - `docs/QA_AND_RELEASE.md` — nuevo gate "E2E + axe-core" + comandos.
  - `docs/ARCHITECTURE_OVERVIEW.md` — sección "Testing" añade layer E2E.
  - `CLAUDE.md` § "Entorno y comandos" — nota sobre `npm run test:e2e` + DB temporal.
  - `docs/ROADMAP.md` — marcar 10J ✅.
- **Skills/tools**:
  - **Context7** (auto) — Playwright v1.x, `@axe-core/playwright`, Next.js `next start`.
  - **`/firecrawl-search`** — "playwright next.js 15 app router fixtures", "axe-core serious violations threshold".
  - **`/simplify`** + **`/pre-commit-review`** obligatorios antes de PR.

---

## FASE 11 — Knowledge + Assistant + i18n

**Objetivo**: knowledge base viva, retrieval de calidad production-grade (hybrid BM25+vector + Cohere Rerank + contextual prefix) y assistant con visibility hermética. Diferenciador del producto.

### Rama 11A — `feat/knowledge-autoextract`

**Propósito**: extraer hechos estructurados desde Rules, Access, Contacts, Amenities, Spaces, Systems, Policies hacia `KnowledgeItem` con los **campos AI completos** que espera el retrieval pipeline. Recomputable determinístico, como `PropertyDerived`.

**Motivación**: el modelo actual de `KnowledgeItem` es minimalista. El retriever hybrid + rerank necesita, por cada item, los campos de [AI_KNOWLEDGE_BASE_SPEC.md:L40-L139](research/AI_KNOWLEDGE_BASE_SPEC.md) (contextual payload) y [AI_KNOWLEDGE_BASE_SPEC.md:L370-L425](research/AI_KNOWLEDGE_BASE_SPEC.md) (campos del modelo). Sin estos campos tipificados — `chunkType`, `locale`, `audience`, `journeyStage`, `entityType`, `entityId`, `contextPrefix`, `bm25Text`, `embedding`, `tokens`, `lastModified`, `sourceFields[]`, `confidenceScore`, `tags[]` — no hay filtros duros en retrieval ni trazabilidad de citas.

**Decisiones cerradas en Fase -1 (2026-04-17)**:
- **Taxonomía de chunks**: `fact | procedure | policy | place | troubleshooting | summary | template` ([AI_KNOWLEDGE_BASE_SPEC.md:L149-L192](research/AI_KNOWLEDGE_BASE_SPEC.md)). Cada extractor produce 1 o N items con `chunkType` explícito.
- **Generación de embeddings**: diferida a 11C (aquí solo se persiste el texto + metadata). 11A no añade la columna `embedding` (pgvector llega con 11C); `bm25Text` queda listo. 11C crea la columna `embedding vector(512)` + columna FTS generated `bm25_tsv` + index GIN, y puebla embeddings en batch.
- **Invalidación (implementación real de 11A)**: granularidad `entityType` + `entityId?`. Delete-then-reextract por sección completa (cuando `entityId=null`) o entidad concreta. `sourceFields[]` son metadatos de trazabilidad por chunk, no determinan el scope de invalidación en esta rama — ese nivel de granularidad se introduce en 11B.
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
- `prisma/schema.prisma` — `KnowledgeItem` expandido. Campos añadidos en 11A: `chunkType`, `locale`, `entityType`, `entityId?`, `contextPrefix`, `bm25Text`, `canonicalQuestion?`, `contentHash?`, `tokens`, `sourceFields[]`, `tags[]`, `validFrom?`, `validTo?`. `embedding` **no** se añade en 11A — pgvector + Voyage se incorporan en 11C. `audience` → se usa campo `visibility` ya existente. Índices: `@@index([propertyId, visibility, locale])`, `@@index([propertyId, entityType, entityId])`. **Migración**: `prisma db push --accept-data-loss` en dev.
- `src/lib/actions/editor.actions.ts` — 22 call sites fire-and-forget (`invalidateKnowledgeInBackground` / `deleteEntityChunksInBackground`) en todos los puntos de mutación, con scope `entityType + entityId?`
- `src/lib/types/knowledge.ts` (nuevo) — tipos TS derivados del schema + Zod para validación de extractors

**Tests**:
- `src/test/knowledge-extract.test.ts` — property fixture (3 spaces + 5 amenities + 1 access + 3 rules) genera N items con `chunkType`, `journeyStage` y `audience` correctos
- `src/test/knowledge-extract-context-prefix.test.ts` — prefix correcto en los 7 chunkTypes; no-hardcoded de IDs (fail si aparece `am.wifi` literal)
- `src/test/knowledge-invalidation.test.ts` — invalidación por `entityType+entityId?` borra solo el scope correcto; `deleteEntityChunksInBackground` borra solo el entityId dado
- `src/test/knowledge-visibility-boundary.test.ts` — items con `audience = sensitive` nunca salen de un extractor cuyo origen es `Property.houseRules` público (fail-loud)

**Criterio de done**: página `/knowledge` muestra hechos extraídos + editables. Rebuild determinístico (mismo input → mismo output). Schema tiene todos los campos AI listos para retrieval hybrid.

**Ajustes implementados en Fase -1 (2026-04-19)**:

- `audience` → no se añade como campo nuevo; se usa el campo `visibility` ya existente. Plan decía `audience String`, implementación usa `visibility` (guest/ai/internal/sensitive) ya tipado.
- Campos añadidos que no estaban en el plan pero sí en `docs/research/AI_KNOWLEDGE_BASE_SPEC.md`: `canonicalQuestion`, `contentHash`, `validFrom`, `validTo`. Los cuatro están en el schema.
- `contextPrefix` es multi-línea (5 líneas): `Propiedad: …`, `Sección: …`, `Destinado a: …`, `Sensibilidad: …`, `Pregunta que responde: "…"`. El plan describía un prefijo de una línea — spec tiene precedencia.
- `validFrom`/`validTo`: siempre `null` en 11A (sin inferencia heurística desde texto). Solo se rellenan si la fuente estructurada lo provee explícitamente.
- Sanitización de secretos de acceso: `buildSafeAccessDescription` (unifica `buildSafeUnitAccessDescription` + `buildSafeBuildingAccessDescription`) excluye `customDesc` (puede contener PINs). Solo labels de taxonomía + `customLabel`. Limitación conocida: `customLabel` es texto libre — si el host embebe un PIN aquí, aparece en el chunk. Eliminación garantizada de secretos en texto libre requiere capa estructurada (fases posteriores).
- Invalidación: por `entityType` + `entityId` opcional (delete-then-reextract). No por `sourceFields` individuales — ese nivel de granularidad se introduce en 11B con `@@unique`.
- Ruta de spec corregida: `docs/research/AI_KNOWLEDGE_BASE_SPEC.md` (no `research/` sin `docs/`).
- Extractor `extractFromRules` del plan → renombrado `extractFromPolicies` (alineado con model `policiesJson` de Property).

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

**Decisiones cerradas en Fase -1 (2026-04-17) + ejecución (2026-04-19)**:
- **Idiomas MVP**: `es`, `en`. `SUPPORTED_LOCALES = ["es", "en"] as const`; `isSupportedLocale()` type guard centraliza la validación.
- **Identidad cross-locale**: chunks autoextracted se emparejan entre locales por `(propertyId, entityType, entityId, templateKey)`, **no** por `id + locale` (el id es per-row y no sobrevive a un re-extract). `templateKey String?` es la clave semántica estable del chunk — NOT NULL para autoextract, NULL para items manuales (quedan fuera del grafo cross-locale).
- **Fallback policy**: si no hay item en `locale` del huésped, se devuelve el sibling del `defaultLocale` anotado con `_fallbackFrom`. **No hay auto-translate en MVP** — diferido a FUTURE.md.
- **Items manuales**: `getItemForLocale` retorna `null` para `templateKey = null` cuando el locale pedido difiere del del source. `listMissingTranslations` los excluye con `templateKey: { not: null }` en ambas queries.
- **Localización real**: los 4 extractores inline (`contacts`, `amenities`, `spaces`, `systems`) emiten `topic`/`bodyMd` en inglés cuando `locale="en"` ("Contact:", "has", "is a", "Beds:", "How to use:", "Phone:", "Availability:"). Los extractores template-based (`property`, `access`, `policy`) siguen usando `knowledge_templates.json` que ya tenía variantes `es`/`en`.
- **Regeneración**: `regenerateLocaleAction(locale)` + `extractFromPropertyAll(propertyId, locale)`. Scoped delete por `(propertyId, locale, isAutoExtracted)` — nunca borra los items del otro locale ni los manuales.

**Archivos creados**:
- `src/lib/services/knowledge-i18n.service.ts`:
  - `SUPPORTED_LOCALES` / `isSupportedLocale()` — type guard exportado
  - `getItemForLocale(itemId, locale, fallbackLocale): ItemWithFallback | null` — resuelve por identidad semántica (`entityType, entityId, templateKey`), anota `_fallbackFrom`; retorna `null` para items manuales cuando cruza locale
  - `listMissingTranslations(propertyId, defaultLocale, targetLocales): MissingTranslation[]` — match por `(entityType, entityId, templateKey, locale)`; excluye `templateKey: null`; por cada chunk del defaultLocale emite las localizaciones faltantes
  - `getLocaleStatusForProperty(propertyId, targetLocales): LocaleStatus[]` — counts agregados para el dashboard
  - `extractI18n` — wrapper de `extractFromPropertyAll` por locale
- `src/app/properties/[propertyId]/knowledge/locale-switcher.tsx` — tabs por locale con badge missing/present + botón "Generar"

**Archivos modificados**:
- `prisma/schema.prisma` — `Property.defaultLocale String @default("es")`, `KnowledgeItem.templateKey String? @map("template_key")`, `@@index([propertyId, entityType, entityId, templateKey, locale])`. Migraciones versionadas: `20260418000000_backfill_autoextract_and_drift` (consolida 11A + drift sin migrar) + `20260419150000_add_knowledge_i18n` (11B). Cadena ejecutable desde DB vacía con `prisma migrate deploy`.
- `taxonomies/knowledge_templates.json` — top-level `"locale": "es-ES"` → `"defaultLocale": "es"` (describe el fallback por defecto de los templates, no un locale único)
- `src/lib/types/knowledge.ts` — `ExtractedChunk.templateKey: string`
- `src/lib/services/knowledge-extract.service.ts` — cada chunk autoextracted setea `templateKey` con un literal `"..."` del extractor (el código es la fuente canónica; ejemplos: `overview`, `checkin_time`, `checkout_time`, `capacity`, `checkin_logistics`, `unit_access`, `building_access`, `pets`, `smoking`, `children`, `quiet_hours`, `contact_info`, `amenity_existence`, `amenity_usage`, `space_info`, `system_info`, `system_troubleshooting`). Inline extractors localizan `topic` + `bodyMd` según `locale`.
- `src/lib/actions/knowledge.actions.ts` — `regenerateLocaleAction` valida con `isSupportedLocale` antes de delegar
- `src/app/properties/[propertyId]/knowledge/page.tsx` — `activeLocale` se clampa con `isSupportedLocale(localeParam)`; `?locale=fr` cae al `defaultLocale` sin estado incoherente

**Tests**:
- `src/test/knowledge-i18n-extract.test.ts` — property con default `es`, regenerar para `en` produce items con textos en inglés; `buildContextPrefix` y `buildBm25Text` respetan locale
- `src/test/knowledge-i18n-fallback.test.ts` — identidad `templateKey`: 4 property facts no colapsan; cross-locale sibling resuelto con row id distinto; manual items `templateKey=null` no cruzan locales; `_fallbackFrom` anotado al caer al defaultLocale; `listMissingTranslations` excluye `templateKey: null` vía filtro de query
- `src/test/knowledge-i18n-no-leak.test.ts` — los 4 inline extractors en `locale="en"` no emiten strings ES (`Teléfono`, `Disponibilidad`, `Contacto:`, `dispone de`, `es un/una`, `Camas:`, `Cómo usar:`)
- `src/test/knowledge-i18n-idempotency.test.ts` — `extractFromPropertyAll(propertyId, "en")` scopea `deleteMany` a `locale="en"` y nunca toca `locale="es"`
- `src/test/knowledge-locale-validation.test.ts` — `regenerateLocaleAction` acepta `es`/`en`, rechaza `fr`/empty con error friendly y no invoca el extractor

**Criterio de done**: host puede activar `en` como idioma secundario, ver gaps de traducción (pairing por templateKey, no por topic), completarlos manualmente o por regeneración; items quedan indexados por locale listos para 11C; locale desconocido nunca deja la UI en estado incoherente; manual items coexisten con autoextracted sin romper el pairing cross-locale.

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

### Rama 11C — `feat/assistant-retrieval-pipeline` ✅ (2026-04-19)

**Propósito**: pipeline RAG production-grade: hybrid BM25+vector retrieval + Cohere Rerank + contextual prefix + filtros duros (visibility, locale, journeyStage). Intent → retrieve → rerank → filter → synthesize con citas.

**Decisiones efectivamente implementadas (ajuste vs spec Fase -1)**:
- Voyage `voyage-3-lite` con **dim = 512** (no 1536 — la variante `-lite` rinde 512 nativos, es la config oficial). pgvector column `vector(512)`.
- **Sin índice ANN** en MVP. Con el scope efectivo (propertyId + locale + visibility) los corpora son <1k rows; el escaneo lineal en el WHERE filtrado es más barato y evita tuning de `ivfflat (lists)`/`hnsw`. Se reintroducirá cuando un tenant supere ~10k rows.
- BM25 via Postgres FTS con **columna generated `bm25_tsv`** (`tsvector`) + GIN. Declarados en `schema.prisma` como `bm25Tsv Unsupported("tsvector")` + `@@index([bm25Tsv], type: Gin)` para que `prisma migrate diff` mantenga paridad con la DB, pero no son queriables vía Prisma Client — el acceso efectivo sigue siendo `$queryRaw`/`$executeRaw`.
- Reranker: Cohere `rerank-multilingual-v3.0` (REST directo, no SDK).
- LLM síntesis: Claude Sonnet 4.6 por default, `ASSISTANT_LLM_MODEL` overrideable.
- Intent resolver: Claude **Haiku 4.5** (`claude-haiku-4-5-20251001`) pinned — no configurable. Heurística keyword-based como fallback cuando falta key o la llamada falla.
- Citation shape: `{ knowledgeItemId, sourceType, entityLabel, score }` (NO `sourceId/quoteOrNote/relevanceScore`).
- `citationsJson` en `AssistantMessage` guarda un envelope `{ citations, escalationReason }` — no se añadió columna de escalationReason para evitar migración.
- Invariantes duras: `sensitive` NUNCA en `allowedVisibilitiesFor`; dev/test degrada a stubs con warnings, prod falla rápido sin `VOYAGE_API_KEY`/`COHERE_API_KEY`/`ANTHROPIC_API_KEY`.
- Invalidación incremental (no delete-then-reextract destructivo): `upsertChunksIncremental` clasifica chunks por `(entityType|entityId|templateKey)`; preserva `embedding` cuando `contentHash` no cambia. El backfill idempotente (`src/lib/jobs/knowledge-embed-backfill.ts`) selecciona rows con `embedding IS NULL`, o cuyo `embedding_model` no coincida con `provider.modelId`, o cuyo `embedding_version` no coincida con `provider.version`.

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

### Rama 11D — `feat/assistant-escalation` ✅ (ver entrega real)

**Propósito**: cuando el synthesizer decide `escalated: true`, el pipeline resuelve un contacto estructurado en vez de inventar respuesta.

**Reconciliación con lo entregado (2026-04-19)**:
- **Trigger exclusivo**: `synthesized.escalated === true` (sentinel `ESCALATE:` o ausencia de `[N]` refs). La spec original decía "si `confidenceScore < threshold` o `citations.length === 0`" — se reconcilió a un único trigger para evitar doble gate (la mandatory-citation rule + ESCALATE ya cubren ambos casos desde 11C y añadir threshold crearía divergencia silenciosa).
- **Intent resolver**: heurística pura en `resolveEscalationIntent` (accent-strip NFD, keywords ES/EN desde `taxonomies/escalation_rules.json`, longest-match tiebreak, emergency precedence). Classifier LLM (Haiku) queda **diferido a 11E** porque la heurística pasa el precision gate ≥0.95 + recall 1.0 en los 4 intents críticos (`int.lockout`, `int.emergency_medical`, `int.emergency_fire`, `int.general`) sobre corpus de 53 rows. Activar Haiku solo si la cobertura de intents crece y la heurística pierde precisión.
- **Persistence**: `AssistantMessage.citationsJson` envelope extendido con `escalationContact: EscalationResolution | null`. Sin migración (confirma patrón de 11C).
- **UI**: `<EscalationHandoff>` inline en `AssistantChat` (operator-only). Widget huésped equivalente queda **diferido a 11F** (coexistencia con semantic search público).

**Archivos entregados**:
- `src/lib/services/assistant/escalation-intent.ts` — heurística pura
- `src/lib/services/assistant/escalation.service.ts` — cascada 3-tier (`intent`/`intent_with_host`/`fallback`), visibility defense-in-depth, channel projection (tel/wa.me/mailto)
- `taxonomies/escalation_rules.json` + `src/lib/taxonomy-loader.ts` (`loadEscalationRules()`, Zod)
- `src/lib/schemas/assistant.schema.ts` — `escalationResolutionSchema` + embed en `askResponseSchema` (nullable required)
- `src/components/assistant/EscalationHandoff.tsx` + wiring en `AssistantChat`
- Pipeline wiring en `src/lib/services/assistant/pipeline.ts` — resolución inline de `intent → contact` guardada por `synthesized.escalated` (happy path no toca `prisma.contact.findMany`)
- Tests: `assistant-escalation-intent.test.ts` (53) + `assistant-escalation-intent-precision.test.ts` (9) + `assistant-escalation-service.test.ts` (15) + `assistant-schema-escalation.test.ts` (5) + `escalation-handoff.test.tsx` (6) + happy-path guard en `assistant-pipeline.test.ts`

**Diferidos documentados**:
- **Haiku intent classifier** → diferido a una rama posterior (NO forma parte de 11E). La heurística cubre los 4 intents críticos con precision ≥0.95 y 100% recall; el classifier solo justifica costo cuando aparezca un intent corpus que la heurística no resuelva. Reabrir con su propia Fase -1 cuando ocurra.
- **Guest-facing UI de escalation** → 11F (widget huésped coexistiendo con semantic search).
- **Per-contact `escalationIntents[]` override** → `docs/FUTURE.md` (cuando un host quiera mapear explícitamente un contacto a un intent sin pasar por `contactType`).

---

### Rama 11E — `feat/assistant-evals` ✅

**Propósito**: banco de evals + release gate. Sin esto, el assistant no es production-ready y cambios silenciosos de modelo pueden degradar calidad.

**Archivos creados**:
- `src/test/assistant-evals/fixtures.json` — 60 pares etiquetados en ES (35) + EN (25) cubriendo los 5 chunkTypes × 5 journeyStages × 2 locales
- `src/test/assistant-evals/knowledge-items-corpus.ts` — corpus hand-written de 57 items (2 properties sintéticas: Madrid urban + Tarifa beach)
- `src/test/assistant-evals/semantic-embeddings.ts` — `SemanticBowEmbeddingProvider` (token-level BoW 512-d, determinista, stopword-filtered ES+EN) que reemplaza al MockEmbeddingProvider en el gate para que el canal vector cargue señal real en vez de ruido SHA-256
- `src/test/assistant-evals/cached-embeddings.ts` + `scripts/refresh-eval-embeddings.ts` — cache opcional de vectores Voyage (uso `EVAL_EMBED_REFRESH=1 VOYAGE_API_KEY=...`), no consumida por el gate
- `src/test/assistant-evals/runner.ts` — pinea los 4 resolvers (embedding=BoW, reranker=identity, synthesizer=stub, intent=heuristic) vía `__set*ForTests`, seedea DB, itera fixtures por `ask()`
- `src/test/assistant-evals/metrics.ts` — accuracy (fact-substring match) + recall@5 (|expected ∩ cited_top5| / |expected|) + breakdowns por language/journeyStage/chunkType
- `src/test/assistant-evals/release-gate.test.ts` — falla si accuracy < 0.85 o recall@5 < 0.9; escribe `eval-artifacts/{eval-summary.json, eval-runs.json, eval-report.md}`
- `src/test/assistant-evals/property-seed.ts` — seed idempotente (2 properties + 57 items) con embeddings batched en un `UPDATE ... FROM unnest(...)`
- `vitest.evals.config.ts` + scripts `eval:assistant` / `eval:assistant:refresh` en `package.json`
- CI: nuevo job `evals` en `.github/workflows/ci.yml` con `pgvector/pgvector:pg16`, corre `prisma migrate deploy` + `npm run eval:assistant`, sube `eval-artifacts/` como artefacto (retención 14 días)

**Resultados**: accuracy 95% / recall@5 95% (gates 85% / 90%) — margen sano que absorbe ruido determinístico del BoW sobre prefix-matches cortos en BM25.

**Criterio de done**: ✅ CI falla si una PR del assistant baja accuracy o recall@5; artifacts JSON/markdown subidos en cada run para debug.

**Dependencias**: 11C + 11D ✅.

**Scope explícitamente excluido**:
- **Haiku intent classifier**: la heurística de 11D cubre los 4 intents críticos con precision ≥0.95 y recall 100%; el classifier solo entra cuando aparezca un corpus que la heurística no resuelva. Se diferirá a una rama dedicada con su propia Fase -1.
- **Dashboard UI**: los artifacts JSON + markdown son suficientes; no se añade página de dashboard en este repo (la UI de observabilidad externa puede consumirlos).
- **Real Voyage embeddings en CI**: el gate corre con `SemanticBowEmbeddingProvider` para ser determinístico y no depender de claves. El script de refresh queda como lever opcional para un gate de mayor fidelidad en el futuro.

---

### Rama 11F — `feat/guide-semantic-search` ✅ (2026-04-20, PR #73)

**Estado**: MERGED (d92c8e0).

**Propósito**: buscador semántico en la guía pública (`/g/:slug`) que entiende la intención del huésped y navega al contenido relevante. Reutiliza embeddings + retriever de 11C; coexiste con el Fuse.js client search de 10H como capa complementaria (Fuse para instant/offline, este para lenguaje natural).

**Motivación**: Fuse.js (10H) resuelve búsqueda léxica fuzzy en cliente (rápido, offline, <20ms). Pero no entiende "cómo llego" → arrival, o "mascota" → pet_policy. [GUEST_GUIDE_SPEC.md:L211-L234](research/GUEST_GUIDE_SPEC.md) marca búsqueda semántica como feature diferencial post-MVP. Este es el componente de capa 2: cuando Fuse no encuentra match o el huésped usa lenguaje natural largo, se ofrece "Búsqueda inteligente" que llama al backend.

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

**Dependencias**: 11C (retriever + embeddings), 10E (renderer con TOC scroll-to), 10F (capa de presentación — garantiza que los hits devuelvan `displayValue`/`displayFields` humanizados), 10H (Fuse como capa 1).

**Preparación**:
- **Contexto a leer**:
  - [GUEST_GUIDE_SPEC.md:L211-L234](research/GUEST_GUIDE_SPEC.md) — interactividad + búsqueda
  - Pipeline de 11C (retriever hybrid)
  - Renderer de 10E (guide-renderer, TOC, scroll-to-section)
  - Fuse search de 10H (para coexistencia)
- **Docs a actualizar al terminar**:
  - `docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md` § "Public guide search" — arquitectura de dos capas
  - `docs/API_ROUTES.md` — documentar `GET /api/g/:slug/search?q=`
- **Skills/tools específicos**:
  - **Context7** (auto) — Next.js rate limiting por ruta pública.

**Ejecución (2026-04-20)**:

- **Files añadidos**:
  - `src/lib/services/guide-search.service.ts` — orquestador (slug → propertyId + locale + published-check → `hybridRetrieve` con `audience='guest'` forzado → map a `sectionId` + anchor + snippet). Rate-limit in-memory per slug (10 req/min) con pruning de buckets vacíos (cap 256). Exports `guideSemanticSearch`, `__resetRateLimitForTests`, `__guide_search_internal` (test-only).
  - `src/app/api/g/[slug]/search/route.ts` — `runtime=nodejs`, `dynamic=force-dynamic`, Zod schema `q ∈ [2,200]`. Códigos: 400 (`invalid_query`), 404 (`not_found`), 429 (`rate_limited` + `Retry-After`), 200 (`{hits, degraded}`), 500 (`internal_error`). `Cache-Control: no-store` en todas.
  - `src/test/guide-search.test.ts` (10 tests), `guide-search-visibility.test.ts` (3 — invariante `audience='guest'` y locale desde DB), `guide-search-rate-limit.test.ts` (4 — con `vi.useFakeTimers`), `guide-search-mapping.test.ts` (5 — exhaustividad por `EntityType`, sin aggregators, overrides de checkout).
- **Files modificados**:
  - `taxonomies/guide_sections.json` — añadido `entityTypes[]` a las 9 secciones. No-aggregators cubren los 7 `EntityType` canónicos; aggregators quedan con `[]`.
  - `src/lib/taxonomy-loader.ts` — schema extendido (`entityTypes: z.array(z.enum(ENTITY_TYPES))`), exhaustividad chequeada al boot (throw si falta un `EntityType`), nuevo helper `getSectionIdForEntity(entityType, journeyStage: JourneyStage|null)` con override `journeyStage==='checkout' → gs.checkout`.
  - `src/components/public-guide/guide-search.tsx` — nueva prop requerida `slug: string`, `SemanticState` discriminada (`idle|loading|ok|error|rate-limited`), debounce 300ms para CTA, `AbortController` sobre cambio de query / cierre de diálogo, lista semántica con `<button>` por item (a11y: tab-navegable, `focus-visible` outline), Enter con 0-hits Fuse dispara semantic si la CTA está elegible.
  - `src/components/public-guide/guide.css` — estilos minimal (funcional únicamente) para `.guide-search__semantic-cta`, `.guide-search__divider`, `.guide-search__inline-note`, `.guide-search__inline-error`, `.guide-search__result--semantic`.
  - `src/app/g/[slug]/page.tsx`, `src/app/g/e2e/[fixture]/page.tsx`, `src/components/public-guide/guide-renderer.tsx`, `src/test/guide-hero.test.tsx`, `src/test/guide-search.test.tsx` — threading de `slug` end-to-end.
- **Invariantes enforced**:
  - `audience` nunca se lee del request — el servicio lo fuerza a `"guest"` (test `guide-search-visibility.test.ts`).
  - `locale` viene de `Property.defaultLocale`, nunca del cliente (mismo test).
  - `allowedVisibilitiesFor('guest')` de 11C nunca retorna `sensitive` — invariante delegado al retriever, pinneado en `assistant-retriever-internals.test.ts`.
  - Exhaustividad `EntityType → sectionId`: el loader throwea al boot si alguna entrada de `ENTITY_TYPES` no está reclamada por un `entityTypes[]` no-aggregator.
- **Decisiones (diff sobre el plan original)**:
  - **Locale desde `Property.defaultLocale`, no desde `GuideVersion`**: `GuideVersion` no tiene columna `locale` en el schema actual. Patrón canónico del repo (`knowledge.actions.ts`, `knowledge-extract.service.ts`) usa `Property.defaultLocale`. Invariante equivalente para el huésped (guide pública siempre en el locale del property publisher).
  - **Mapping config-driven**: `entityType → sectionId` vive en `taxonomies/guide_sections.json` (`entityTypes[]`) + helper `getSectionIdForEntity`. Añadir un nuevo `EntityType` = editar el JSON + tests exhaustivos fallan si no se reclama.
  - **Rate-limit in-memory** (Map<slug, ring-buffer>): suficiente para MVP single-process single-region. Documentado upgrade path a Redis.
  - **Sin reranker / sin synthesizer** en el path público: blindaje explícito (la rama no los importa). Se consumen `item.bodyMd` + `item.canonicalQuestion` directamente para construir snippet.
  - **Respuesta recortada**: `{hits, degraded}` — quitamos `stats` internos (scopeSize/bm25Hits/vectorHits) que el retriever devuelve, para no filtrar telemetría de pipeline al cliente público.
- **Deferred a futuras ramas**:
  - Sharding del rate-limit en Redis (multi-region) — seguirá in-memory mientras 11 viva en un solo proceso.
  - ANN index sobre `knowledge_items.embedding` — no necesario al scope `propertyId + locale + visibility`.
  - E2E playwright del CTA/semantic-list — 10J cubre shell + anti-leak + axe; la search pipe se cubre con 30 unit tests.
  - Polish visual de la CTA y la lista semántica — explícitamente diferido a FASE 15 (Liora Design Replatform).

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
- `package.json` — si no están aún (esperado que 10G los haya añadido ya): `react-hook-form`, `@hookform/resolvers`, `@radix-ui/react-dialog` (drawer/modal del reporter); `zod` ya está en el proyecto. Reusar `yet-another-react-lightbox` solo si se previsualizan las fotos adjuntas.

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
- **Skills/tools obligatorios** (ver [GUEST_GUIDE_UX.md § Tooling obligatorio](../FEATURES/GUEST_GUIDE_UX.md)):
  - **`/excalidraw-diagram`** antes de codificar — wireframe del drawer del reporter en mobile 375 (orden de campos, tamaños de targets, posición de CTA); commit en `docs/research/sketches/13D-issue-reporter.excalidraw`.
  - **`/firecrawl-search`** antes: "Breezeway guest reporting flow UX 2026", benchmarks Hostfully/Guesty de issue-reporting para huéspedes.
  - **Agent `code-architect`** — decidir provider de email (Resend vs Postmark vs reutilizar lo de 12B) si no está cerrado en Fase -1 + validar esquema Zod de validación del form.
  - **Context7** (auto) — `react-hook-form` + `@hookform/resolvers/zod`, `@radix-ui/react-dialog` (focus trap, portal, `forceMount`).
  - **`/playwright-cli`** en 3 viewports (375/768/1280): flujo completo guest reporta → host ve → marca resolved → guest ve "resuelto". Verifica focus trap del drawer, `Escape` cierra, campos obligatorios bloquean submit.
  - **`@axe-core/playwright`** — 0 violations serious/critical sobre el drawer abierto (labels, aria-describedby para errores de validación, contraste).
  - **`/simplify`** + **`/pre-commit-review`** obligatorios antes de PR.

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

### Rama 14E — `feat/booking-import-preview`

**Propósito**: simetría Booking a 14D. Preview-only reconciliation para Booking.com payloads con el mismo diff framework que Airbnb.

**Archivos a crear**:
- `src/lib/imports/booking/catalogs.ts` — reverse indices (booking-property-types, booking-amenities) desde 14A platform catalogs
- `src/lib/imports/booking/parser.ts` — parseBookingToCanonical, análogo a `airbnbToCanonical` pero mapea divergencias Booking (no `check_in_method` enum → `checkin_instructions` free-text, no `accessibility_features` namespace, `max_occupancy` no `person_capacity`, `policies.*` no `listing_policies.*`, `fees.*` no `pricing.*`)
- `src/lib/imports/booking/serialize.ts` — orquestador (validate → parse → load context → diff)
- `src/lib/schemas/booking-listing-input.ts` — strict Zod schema para inbound Booking JSON (derivado de `src/lib/schemas/booking-listing.ts` export schema pero como input superset)

**Archivos a modificar**:
- `src/app/api/properties/[propertyId]/import/booking/preview/route.ts` — POST endpoint análogo a Airbnb
- `src/app/properties/[propertyId]/settings/page.tsx` — importar + render BookingImportPreview component
- `src/app/properties/[propertyId]/settings/booking-import-preview.tsx` — UI simétrica a `airbnb-import-preview.tsx` pero adaptada a shape Booking
- `docs/FEATURES/PLATFORM_INTEGRATIONS.md` — § Import de Booking, divergencias vs Airbnb

**Tests**:
- `src/test/booking-import-parser.test.ts` — Booking payload → canonical + warnings (unresolved IDs, schema divergences)
- `src/test/import-diff-engine.test.ts` — extends existing (reusa engine, valida que Booking context poblada correctamente)
- `src/test/import-preview-no-mutate.test.ts` — extends existing (añade ruta `/booking/preview`)

**Criterio de done**:
- Booking JSON → diff rendering sin mutations, paridad UX con Airbnb preview
- Divergencias documentadas claramente (missing check_in_method, no accessibility, etc.)
- Tests: parser happy path + unresolved + missing fields, no-mutate gate
- Docs: sección 14E en PLATFORM_INTEGRATIONS.md explain Booking-specific shape + reconciliation behavior

**Reutiliza de 14D**:
- `PropertyImportContext` (type compartido, fields aplicables)
- `computeImportDiff` (engine provider-agnostic, sin cambios)
- `ImportDiff` + `ImportWarning` types
- `diff-engine.ts` lógica (scalar/policies/presence/amenities/freeText/customs igual)
- Pattern de UI preview (textarea + sections rendering)

**Cambia por Booking shape**:
- `max_occupancy` mapeado a `personCapacity` (1:1)
- `fees.{cleaning, extra_person}` → `pricing.{cleaningFee, extraPersonFee}` (nombre cambio, semántica igual)
- `policies.*` → `policiesJson` (field nombre, structure igual)
- `house_rules_text` (no split per sección como Airbnb)
- `checkin_instructions` → freeText.checkInInstructions (no enum, diff-only libre-text)
- Ningún `accessibility_features.*` (silent drop en parser, sin warnings)
- Ningún `commercial_photography` (not in Booking manifest)
- `propertyType` mapeo via 14A catalogs pero denominación PCT (Booking Property Classification Types) vs Airbnb direct IDs

**No-alcance**:
- No apply (deferred a 14F)
- No API credentials reales (manual JSON input only)
- No auditoría persistente
- No sincronización automática

**Preparación**:
- **Contexto a leer**:
  - 14D implementación (airbnb parser/catalogs/UI)
  - 14C export (Booking shape divergences)
  - 14A platform catalogs (Booking reverse mapping)
  - `docs/FEATURES/PLATFORM_INTEGRATIONS.md` § Booking
- **Docs a actualizar al terminar**: PLATFORM_INTEGRATIONS.md § 8 "Import — Booking preview"
- **Skills/tools específicos**: ninguno (architecture reusa de 14D)

---

### Rama 14F — `feat/platform-import-apply`

**Propósito**: introduce mutaciones reales en DB para aplicar diffs validados. Cierra el ciclo de import: preview → decision → apply.

**Archivos a crear**:
- `src/lib/imports/shared/apply-strategies.ts` — estrategias de resolución para cada categoría de diff (overwrite / keep_current / take_import / skip)
- `src/lib/imports/shared/import-applier.service.ts` — orquestador que toma `ImportDiff` + resolución-por-entrada y ejecuta mutations en transaction
- `src/lib/services/audit-integration.ts` — log writer para import apply (quién, qué, cuándo, resultado) usando `AuditLog` schema
- `src/app/api/properties/[propertyId]/import/{airbnb|booking}/apply/route.ts` — POST endpoints (Airbnb + Booking)
- `src/lib/actions/import-apply.action.ts` — server action wrapper para UI

**Archivos a modificar**:
- `src/app/properties/[propertyId]/settings/airbnb-import-preview.tsx` — añadir botón "Aplicar" + modal de resolución de conflictos
- `src/app/properties/[propertyId]/settings/booking-import-preview.tsx` — mismo patrón
- `docs/FEATURES/PLATFORM_INTEGRATIONS.md` — § Apply (estrategias, auditoría, idempotencia)
- `docs/SECURITY_AND_AUDIT.md` — audit log contract para imports (actor, propertyId, payload hash, decisions, result)

**Tests**:
- `src/test/import-applier-strategies.test.ts` — validar cada estrategia (overwrite crea versiones de Spaces, keep skips, take imports con warnings, skip emite noop)
- `src/test/import-apply-idempotence.test.ts` — re-apply same import = zero new mutations
- `src/test/import-apply-no-partial.test.ts` — transaction rollback si error mid-apply (atomicity)
- `src/test/import-audit-log.test.ts` — every apply logs actor + propertyId + payload hash + decisions + result
- E2E: reconcile diff → resolve conflicts → apply → verify DB + audit log

**Criterio de done**:
- Apply endpoint accepts `{diff, resolutions: {[field]: strategy}}` payload
- Mutaciones aplicadas en $transaction (atomicity guaranteed)
- Audit log entries para cada apply (quién, propertyId, payload fingerprint, decisions, timestamp, result)
- Idempotence validated: re-apply same import = 1 log entry, 0 additional mutations
- UI modal resolve conflicts + progress feedback
- Docs explain strategy semantics + audit contract + idempotence guarantee

**Estrategias (por entrada DiffEntry)**:
- **overwrite**: incoming replaces current (fresh/conflict → take_import)
- **keep_current**: skip incoming (conflict → keep_db)
- **take_import**: only if fresh (default suggested)
- **skip**: noop, emit info warning
- **per-category rules** (opcional para 14F): policies `lossy_projection` default skip + warning; presence always skip + warning

**Mutaciones en DB** (alcance):
- Top-level scalar mutations: propertyType, primaryAccessMethod, bedroomsCount, bathroomsCount, personCapacity
- policiesJson sub-updates (merge-mode: incoming + current unresolved stay)
- Amenity list mutations: create/delete Amenities (shell instances via import, future: Space-scoped via future UI)
- No Spaces creation (requires entity identity, out of scope per 14D invariant)
- No scheduled tasks / automations (separate concern)

**Auditoría**:
- `AuditLog` entry per apply: `{ propertyId, actor (userId from session), action: "import_apply", resourceType: "property", resourceId, payload: {platformType, payloadHash, strategyDecisions, appliedCount}, timestamp, result: "success"|"partial"|"failed" }`
- Hash of incoming payload (SHA-256 12-char fingerprint) for idempotence check
- Log searchable by propertyId + action + timestamp
- Rollback audit: if transaction fails, log entry with result="failed" + errorMessage

**Dependencias / Riesgos**:
- ⚠ **Requiere Fase 16A (sessions)**: apply endpoint needs `userId` from `requireOperator()` guard. If 16A not merged, apply endpoint returns 401 until 16B gates are in place. Plan: merge 16A minimally (sessions only, no full ownership checks) before 14F, or use stub `userId="system"` in dev/test.
- ⚠ **Property versioning**: imports can conflict with concurrent wizard/API edits. Mitigated by: (a) transaction isolation (Postgres READ_COMMITTED default), (b) optimistic lock via version field if added later, (c) clear user feedback that import is an offline batch operation.
- ⚠ **Audit log performance**: AuditLog inserts should not block apply. Plan: use async `emailProvider` pattern if audit events trigger notifications.

**No-alcance de 14F**:
- No async background jobs (apply is synchronous, immediate feedback)
- No scheduler/cron sync (external fetch of platform listings)
- No "sync previous imports" history / "undo apply" (versioning feature, future scope)
- No SmartDiff recommendations (AI-assisted conflict resolution, future)

**Preparación**:
- **Contexto a leer**:
  - 14D + 14E preview pipelines (diff shape)
  - `docs/SECURITY_AND_AUDIT.md` (audit log contract, AuditLog schema)
  - `docs/FEATURES/PLATFORM_INTEGRATIONS.md` § reconciliation semantics
  - Prisma transaction patterns in codebase (e.g., `completeWizardAction`)
  - Session pattern from 16A (minimal: `userId` in request context)
- **Docs a actualizar al terminar**: PLATFORM_INTEGRATIONS.md § 9 "Apply & audit", SECURITY_AND_AUDIT.md audit log section, ROADMAP.md
- **Skills/tools específicos**: 
  - **Agent code-architect** para estrategias de resolución y patrón de transaction (múltiples opciones si aplica)
  - **Agent code-explorer** para tracing de audit log usage en codebase

---

## FASE 15 — Liora Design Replatform

**Estado**: bloqueada por entrega del paquete de diseño Liora. Las ramas están definidas a nivel de alcance y dependencia, pero **sin archivos concretos** hasta que el paquete llegue.

**Prerrequisito duro**: entrega del paquete de diseño Liora (tokens, primitivos, superficies). Sin paquete, ninguna rama 15A-G arranca.

**No bloquea** el flujo funcional en vuelo: 10G/H/I, Fase 11, Fase 12, Fase 13, Fase 14 avanzan con independencia. Fase 15 se intercala cuando la entrega ocurra.

**Artefactos que se crean al arrancar Rama 15A** (no antes):
- `docs/LIORA_DESIGN_ADOPTION_PLAN.md` — mapa tokens Liora ↔ `src/config/design-tokens.ts` + orden de rollout por superficie.
- `docs/LIORA_MIGRATION_RULES.md` — extensión operativa de las reglas anti-legacy (ver `docs/ARCHITECTURE_OVERVIEW.md` §14) con criterios específicos del paquete.
- `docs/LIORA_COMPONENT_MAPPING_TEMPLATE.md` — plantilla de tabla `componente → reused | reskinned | rewritten | deleted` que cada PR 15B-F rellena.
- `docs/LIORA_SURFACE_ROLLOUT_PLAN.md` — orden de migración por superficie con dependencias entre primitivos y shells.
- Skills/prompts específicos en `.claude/commands/` si se necesitan (ej: `/liora-component-map`). No se anticipan hoy.

**Reglas duras aplicables desde ya** (sin esperar al paquete): ver `docs/ARCHITECTURE_OVERVIEW.md` §14 "Legacy management & migration discipline" y el bloque homólogo en `CLAUDE.md`. En particular: no introducir duplicados `V2`/`New*`/`Better*`/`Next*`, no consolidar polish visual final en ramas funcionales en vuelo, no abrir convivencias legacy sin plan de retirada documentado.

---

### Rama 15A — `refactor/liora-token-foundation`

**Propósito**: alinear `src/config/design-tokens.ts` al esquema del paquete Liora (colores, tipografía, spacing, radii, sombras, motion). Cero cambios visuales nuevos en superficies — solo cambio de fuente de tokens.

**Archivos a modificar** (referencia, exhaustividad tras entrega):
- `src/config/design-tokens.ts` — única fuente de declaración de variables CSS.
- CSS global / `tailwind.config.ts` — re-mapeo si el paquete introduce tokens semánticos no cubiertos.

**Archivos a crear**: `docs/LIORA_DESIGN_ADOPTION_PLAN.md` (ver bloque de apertura de la fase).

**Tests**:
- `src/test/design-tokens-mapping.test.ts` (nuevo) — cobertura Liora → tokens internos.
- Snapshot de guía pública idéntico al baseline pre-rama (validación de no-regresión visual + a11y).

**Criterio de done**: axe-core + snapshot guest idénticos al baseline pre-rama; tokens Liora declarados en una sola fuente; brand theming de 10E sigue funcionando sin cambios.

**Preparación**:
- **Contexto a leer**: paquete Liora (cuando exista), `src/config/design-tokens.ts`, `docs/CONFIG_DRIVEN_SYSTEM.md` §UI rule, research `L162-210` de `GUEST_GUIDE_SPEC.md` para el diff de tokens MVP vs Liora.
- **Docs a actualizar al terminar**: `docs/LIORA_DESIGN_ADOPTION_PLAN.md` (creado en esta rama).
- **Skills/tools específicos**: pendientes hasta entrega del paquete de diseño.

---

### Rama 15B — `refactor/liora-core-components`

**Propósito**: re-skin (no reescritura) de primitivos compartidos consumiendo los tokens de 15A. Cada componente tocado se clasifica en la PR como `reused` / `reskinned` / `rewritten` / `deleted`.

**Archivos a modificar** (lista preliminar — se cierra con entrega):
- Primitivos actuales en `src/components/ui/` (kebab-case): `badge.tsx`, `banner.tsx`, `checkbox-card-group.tsx`, `collapsible-section.tsx`, `delete-confirmation-button.tsx`, `info-tooltip.tsx`, `inline-save-status.tsx`, `location-map.tsx`, `number-stepper.tsx`, `primary-cta.tsx`, `radio-card-group.tsx`, `tooltip.tsx`.
- Cards específicas de la guía guest (`HeroCard`, `EssentialCard`, `StandardCard`, `WarningCard`) hoy **no existen como archivos** — son nombres de la spec `docs/FEATURES/GUEST_GUIDE_UX.md` que se materializan en 15A/B con el mapping definitivo (reused/reskinned/rewritten). El mapping lo documenta `docs/LIORA_COMPONENT_MAPPING_TEMPLATE.md` al cerrar 15A.

**Prohibido**: crear archivos `*V2.tsx`, `New*`, `Better*`, `Next*`. Si un primitivo exige reescritura de API, va como `rewritten` en la clasificación y la legacy se borra en la misma rama (no coexistencia).

**Tests**:
- Cobertura existente de cada componente se mantiene verde.
- Axe-core sobre página de preview interna (si existe) o sobre guest guide.

**Criterio de done**: tabla de clasificación completa en la PR description; 0 duplicados con sufijos prohibidos; axe-core `serious|critical = 0`; targets interactivos ≥44×44 preservados.

**Preparación**:
- **Contexto a leer**: `docs/LIORA_DESIGN_ADOPTION_PLAN.md` (creado en 15A), paquete Liora, `docs/FEATURES/GUEST_GUIDE_UX.md` (cards + a11y).
- **Docs a actualizar al terminar**: `docs/LIORA_COMPONENT_MAPPING_TEMPLATE.md` (creado aquí) actualizado con los primitivos cubiertos.
- **Skills/tools específicos**: pendientes hasta entrega del paquete de diseño.

---

### Rama 15C — `feat/liora-guest-guide-redesign`

**Propósito**: superficie `/g/:slug` (shell, secciones, hero, footer) adopta los primitivos re-skineados. Cero cambios en `normalizeGuideForPresentation`, presenter registry, resolvers o taxonomías.

**Archivos a modificar**: `src/app/g/[slug]/page.tsx`, `src/components/public-guide/*` (renderers React de 10E: `guide-renderer.tsx`, `section-card.tsx`, `guide-item.tsx`, `guide-brand-header.tsx`, `guide-emergency-section.tsx`, `guide-empty-state.tsx`, `guide-media-gallery.tsx`, `guide-toc.tsx`, `public-guide-section-registry.ts`, `guide.css`).

**Tests**:
- Harness E2E de 10J verde (smoke + anti-leak + axe) sobre las 3 fixtures × 4 viewports.
- Lighthouse p95 ≤10% peor que baseline pre-rama en `/g/:slug`.
- `src/test/guide-rendering-proxy-urls.test.ts` verde (media proxy inalterado).

**Criterio de done**: harness 10J verde idéntico; 0 cambios en el pipeline de presentación; regresión de performance ≤10%.

**Preparación**:
- **Contexto a leer**: 15A + 15B, `docs/FEATURES/GUEST_GUIDE_UX.md`, research `L104-160` (UX patterns) y `L236-262` (métricas).
- **Docs a actualizar al terminar**: `docs/LIORA_SURFACE_ROLLOUT_PLAN.md` (creado aquí o en 15A según orden de exploración) marcando guest como superficie migrada.
- **Skills/tools específicos**: pendientes hasta entrega del paquete de diseño.

---

### Rama 15D — `feat/liora-operator-shell-redesign`

**Propósito**: shell del operador — sidebar, topbar, layout de `/properties/[propertyId]`. Sin tocar wizards ni section editors (quedan para 15E).

**Archivos a modificar**: `src/components/layout/*`, `src/app/properties/layout.tsx` (o equivalente).

**Tests**: suite existente verde + axe-core sobre shell vacío y con contenido.

**Criterio de done**: navegación funcional inalterada; tabla de clasificación cubre todos los componentes del shell; axe-core `serious|critical = 0`.

**Preparación**:
- **Contexto a leer**: 15A + 15B, `docs/ARCHITECTURE_OVERVIEW.md` §4 (Canonical UX model).
- **Docs a actualizar al terminar**: `docs/LIORA_SURFACE_ROLLOUT_PLAN.md` (shell operador).
- **Skills/tools específicos**: pendientes.

---

### Rama 15E — `feat/liora-operator-module-rollout`

**Propósito**: superficies de módulos del operador — wizard (4 pasos + review) + section editors (spaces, access, amenities, systems, policies, contacts, emergency, local, knowledge). Puede dividirse en sub-PRs internos, siempre bajo la misma rama Git.

**Archivos a modificar**: `src/components/wizard/*`, `src/app/properties/[propertyId]/**/page.tsx`, formularios por sección.

**Tests**: suites existentes de cada módulo + regresión completa de completeness scoring + field-type renderers.

**Criterio de done**: cada módulo con su propia subsección en la PR description + tabla de clasificación; `config-driven.test.ts` verde; `field-type-coverage.test.ts` verde.

**Preparación**:
- **Contexto a leer**: 15A + 15B + 15D, `docs/CONFIG_DRIVEN_SYSTEM.md` (UI rule), `docs/DATA_MODEL.md` por módulo.
- **Docs a actualizar al terminar**: `docs/LIORA_SURFACE_ROLLOUT_PLAN.md` por módulo.
- **Skills/tools específicos**: pendientes.

---

### Rama 15F — `feat/liora-messaging-assistant-redesign`

**Propósito**: superficies de messaging + assistant console. **Requiere** Fase 11 y/o 12 ya mergeadas — si no existen aún, esta rama queda dormida.

**Criterio de done**: paridad funcional con el estado pre-rama + axe-core `serious|critical = 0`.

**Preparación**:
- **Contexto a leer**: 15A + 15B + 15D + Fase 11/12 según aplique.
- **Docs a actualizar al terminar**: `docs/LIORA_SURFACE_ROLLOUT_PLAN.md`.
- **Skills/tools específicos**: pendientes.

---

### Rama 15G — `chore/remove-legacy-ui`

**Propósito**: barrido final. Elimina tokens, clases CSS, variables, helpers y componentes que 15A-F marcaron como `deleted` en su clasificación. Ningún `legacy-*` ni `*-old` sobrevive en el bundle.

**Gate CI**: grep guardado — si aparece cualquier identificador legacy clasificado como `deleted`, la PR falla.

**Criterio de done**: bundle size igual o menor; suite completa verde; tablas de clasificación de 15A-F vaciadas de `deleted` pendientes.

**Preparación**:
- **Contexto a leer**: tablas de clasificación acumuladas de 15A-F.
- **Docs a actualizar al terminar**: `docs/LIORA_SURFACE_ROLLOUT_PLAN.md` marca Fase 15 como completada.
- **Skills/tools específicos**: pendientes.

---

## FASE 16 — Auth & access control foundation

**Estado**: **no iniciada**. Iniciativa transversal que falta hoy en el repo. Surgió como hallazgo duro durante la review de Rama 14B: el reviewer pidió un guard de auth/ownership en `GET /api/properties/[propertyId]/export/airbnb` y la auditoría confirmó que **el patrón pedido no existe**. Todas las rutas `/api/properties/[propertyId]/...` actuales (`/derived`, `/guide`, `/assistant/ask`, `/places-search`, `/export/airbnb`) usan un único check: `prisma.property.findUnique → 404 si no existe`. No hay sesiones, no hay membership check, no hay identidad del actor.

**Prerrequisito duro de qué**: de **cualquier** feature operator-facing que toque datos privados — exports (14B+), incident panel del host (parte de 13D ya mergeada sin guard), messaging review (12B), settings/wizard, assistant console, media. La ausencia de guards no se mitiga por feature; se mitiga una sola vez a nivel de plataforma.

**Principio rector**: esta fase **separa** dos problemas que hoy en el código se mezclan:

1. **Auth del operador/host** — sesiones tradicionales, identidad del usuario, workspace ownership, guards server-side en rutas autenticadas. Modelo mental: "¿este `userId` tiene derecho a ver/modificar esta `Property`?".
2. **Capacidades de la guía pública** — la guía (`/g/:slug`) y sus flujos guest-originated **no** usan login tradicional. Ya hay un precedente: la cookie HMAC de `incident-cookie.service.ts` (rama 13D) firma `{slug, ids[], iat}` con `GUEST_INCIDENT_COOKIE_SECRET`. Ese patrón necesita generalizarse a un modelo de capacidades firmadas para todo guest write/read flow.

Mezclar los dos modelos bajo el mismo "auth" es lo que bloqueó el análisis de 14B. **Separar** es requisito — cada rama aquí se etiqueta claramente como operador o público.

**Qué falta hoy, exhaustivo**:

- Login / registro / recuperación de contraseña del host.
- Sesiones server-side (cookie + DB-backed o JWT firmado — decisión pendiente).
- Middleware Next.js que pueble un contexto de request con `{userId, workspaceId, role}`.
- Guards reutilizables para Server Actions y route handlers: `requireOperator()`, `requireOwnership(propertyId)`, `requireWorkspaceRole(role)`.
- Authorization por `WorkspaceMembership` — los modelos Prisma existen (`Workspace`, `WorkspaceMembership`, `User`) pero ningún caller los consulta.
- Audit log de quién hace qué (hoy `AuditLog` existe en schema `docs/SECURITY_AND_AUDIT.md` §4 pero no hay escritores reales).
- Capability tokens para guest flows que no sean simple read (lectura ya resuelta por `publicSlug` + `published GuideVersion`, ver 10D).
- Revocación / expiración / scope de capabilities del huésped.
- Test harness de auth — fixture de `userA vs userB trying to access propertyOfA` debe vivir al mismo nivel que las 5 invariantes anti-leak de 10F.

**No bloquea ramas funcionales en vuelo**: Fases 11-15 avanzan con el patrón actual (`findUnique → 404`). Esta fase se intercala cuando producto/seguridad decidan priorizar — o cuando un incidente fuerce la decisión. Mientras tanto **ninguna PR puede presentar su endpoint como "seguro" ni "protegido"**; la documentación de feature (p. ej. `docs/FEATURES/PLATFORM_INTEGRATIONS.md`) debe explicitar que sigue el status quo del repo.

**Orden de las ramas** (dependencias secuenciales — 16A es prerrequisito de 16B, etc.):

### Rama 16A — `feat/operator-auth-foundation`

**Propósito**: levantar la infraestructura de sesiones del host. Sin esto, 16B no tiene a quién preguntar "¿eres miembro del workspace?".

**Decisiones pendientes antes de arrancar (Fase -1)**:
- Librería: NextAuth/Auth.js v5 vs Lucia vs Better-Auth vs custom. Criterios: compat con Next 15 App Router + cookie SSR + mantenimiento activo + footprint minimal.
- Session storage: DB-backed (tabla `Session` en Prisma) vs JWT firmado. DB-backed permite revocación real; JWT es más barato. La política de "nunca tokens/secretos en KnowledgeItem" (SECURITY_AND_AUDIT §3) sesga hacia DB-backed.
- Password hash: argon2id (default moderno) vs bcrypt. Si se elige argon2, documentar parámetros (t=3, m=64MB típico).
- Flows incluidos: password login + email verification + password reset. Magic link y OAuth (Google/Apple) diferidos salvo decisión estratégica contraria.

**Archivos a crear** (exhaustivo tras Fase -1):
- `src/lib/auth/` (servicio, tipos, config del provider elegido).
- `src/middleware.ts` o equivalente — resuelve sesión → `request context`.
- `src/app/(auth)/login`, `/(auth)/register`, `/(auth)/verify`, `/(auth)/reset` — superficies mínimas en texto (no polish visual; Liora lo retoca después).
- Server Actions para cada flow en `src/lib/actions/auth.actions.ts`.
- Migración Prisma si hace falta: añadir `password_hash`, `email_verified_at`, `Session`, `PasswordResetToken` a User.

**Tests**:
- `src/test/auth-foundation.test.ts` — register → verify → login → logout end-to-end sobre fixture DB.
- `src/test/auth-session.test.ts` — expired session → 401; tampered cookie → 401; revoked session → 401.

**Criterio de done**: un usuario puede registrarse, verificar email, iniciar sesión y cerrar sesión. **Ningún endpoint protegido todavía** — eso lo hace 16B. El deliverable es la infra limpia.

**Preparación**:
- **Contexto a leer**: `prisma/schema.prisma` (modelos `User`, `Workspace`, `WorkspaceMembership` ya existentes), `docs/SECURITY_AND_AUDIT.md` §3 (secret policy), `docs/ARCHITECTURE_OVERVIEW.md`.
- **Docs a actualizar al terminar**: `docs/SECURITY_AND_AUDIT.md` (nueva sección "Auth de la app"), `docs/ARCHITECTURE_OVERVIEW.md` (si la middleware introduce una nueva capa), `docs/DATA_MODEL.md` (si hay migración).
- **Skills/tools específicos**: `/feature-dev` para la superficie, `/pre-commit-review` y `/simplify` obligatorios.

---

### Rama 16B — `feat/route-guards-and-ownership`

**Propósito**: aplicar guards de auth + workspace ownership a **todas** las rutas operator-facing existentes. 16A entrega identidad; 16B la consume.

**Pre-auditoría obligatoria (Fase -1)**: enumerar exhaustivamente qué endpoints y Server Actions son operator-facing. Catálogo inicial (no exhaustivo, debe completarse en Fase -1):
- Todas las rutas bajo `src/app/api/properties/[propertyId]/...` (hoy 7: `derived`, `guide`, `export/airbnb`, `assistant/{ask, debug/retrieve, conversations}`, `places-search`).
- Server Actions en `src/lib/actions/{editor, wizard, guide, incident, messaging, ops, knowledge}.actions.ts`.
- Panel del host bajo `src/app/properties/[propertyId]/*`.

**Archivos a crear**:
- `src/lib/auth/guards.ts` — helpers `requireOperator()`, `requireOwnership(propertyId)`, `requireWorkspaceRole(role)`. Cada uno retorna `{userId, workspaceId}` o lanza 401/403.
- `src/test/auth-guards.test.ts` — para cada guard: happy path, no session, wrong workspace, wrong role.
- `src/test/auth-route-coverage.test.ts` — gate automático: cualquier route handler bajo `src/app/api/properties/[propertyId]/...` que **no** invoque un guard falla el test. Evita regresión silenciosa cuando se añaden nuevas rutas.

**Archivos a modificar** (exhaustivo tras auditoría):
- Cada route handler del catálogo — añadir guard como primera operación.
- Cada Server Action del catálogo — guard antes de parsear FormData.

**Distinción crítica**: 404 vs 403. 404 cuando el recurso **no existe o no es visible al actor** (default seguro — no revela existencia cross-workspace); 403 cuando existe, es visible pero el actor no tiene el rol requerido. El helper lo resuelve — los callers no discriminan a mano.

**Tests**:
- Matriz user-property: `userA ∈ workspaceA`, `userB ∈ workspaceB`; cada endpoint exponga `propertyOfA` a A con 2xx y a B con 404.
- Session-less request → 401 en todos los operator endpoints.

**Criterio de done**: 100% de los endpoints operator-facing tienen guard. Gate automático verde. PR description incluye tabla `endpoint → guard invocado`.

**Preparación**:
- **Contexto a leer**: 16A, catálogo de la Fase -1, `prisma/schema.prisma` (relaciones `Property.workspaceId`).
- **Docs a actualizar al terminar**: `docs/API_ROUTES.md` (marcar guards por endpoint), `docs/SECURITY_AND_AUDIT.md` (sección "Guards server-side"), `docs/FEATURES/PLATFORM_INTEGRATIONS.md` (actualizar nota de status quo — 14B queda protegida a partir de aquí).
- **Skills/tools específicos**: **Agent code-explorer** para auditar exhaustivamente qué rutas son operator-facing (evita que una quede sin guard).

---

### Rama 16C — `feat/public-guide-capabilities`

**Propósito**: modelo unificado de capabilities firmadas para `/g/:slug` — lo que hoy resuelve ad-hoc la cookie HMAC de `incident-cookie.service.ts` (rama 13D) generalizado a todo guest write/read scope que exceda la lectura trivial de la guía publicada.

**No es login tradicional**. La guía pública no tiene cuenta de huésped; el huésped se identifica por:
- `publicSlug` en la URL (access control de lectura — ya existe).
- Cookie HMAC firmada que carga capacidades (actualmente solo `incident_ids`; generalizar a un modelo `{slug, capabilities[], expiresAt}`).

**Decisiones Fase -1**:
- ¿JWT estándar (ES256/HS256) vs HMAC ad-hoc como 13D? JWT tiene ecosystema (`jose`) y revocation list conocida; ad-hoc es lo que ya hay. Voto sesgado: generalizar el ad-hoc a un helper común (`capability-token.service.ts`) porque ya está probado y evita peso del ecosystema JWT para nuestro caso scope-limited.
- Alcance inicial de capacidades: `incident_report`, `incident_read`, ¿`guide_feedback`? ¿`booking_extension_request`? Cerrar catálogo antes de implementar.
- Revocación: on-demand por slug (invalida cookies de ese slug) y por expiración (default 7d, mismo que 13D).

**Archivos a crear**:
- `src/lib/auth/guest-capability.service.ts` — `signCapability({slug, capabilities, ttlMs})`, `verifyCapability(cookie)`. Refactor del HMAC de 13D como caso particular.
- `src/lib/auth/guest-capability-registry.ts` — catálogo tipado `GuestCapability` (string union) + contract de verificación por cada tipo.
- Migración: cookie name convention (`guide-capabilities-<slug>` reemplaza `guide-incidents-<slug>` de 13D con retrocompat por un release).

**Archivos a modificar**:
- `src/lib/services/incident-cookie.service.ts` — delegar a `guest-capability.service.ts`.
- `src/app/api/g/:slug/incidents/route.ts` — usar el verifier común.

**Tests**:
- `src/test/guest-capability-service.test.ts` — sign/verify round-trip, tampered payload, expired TTL, clock-skew guard (±5min como 13D), `timingSafeEqual`.
- `src/test/guest-capability-isolation.test.ts` — cookie de `slugA` nunca autoriza en `slugB`; cookie con `capability:incident_read` nunca autoriza `capability:incident_write`.

**Criterio de done**: 13D funciona idéntico sobre el nuevo servicio común. Al menos un segundo caso de uso (p. ej. `guide_feedback`) adoptado o documentado como próximo. Cookie retrocompat durante ≥1 release.

**Preparación**:
- **Contexto a leer**: `src/lib/services/incident-cookie.service.ts`, `docs/SECURITY_AND_AUDIT.md` §3.1 (guest-originated writes), rama 13D commit history.
- **Docs a actualizar al terminar**: `docs/SECURITY_AND_AUDIT.md` §3.1 expandida, `docs/FEATURES/GUEST_GUIDE_UX.md` si aplica.
- **Skills/tools específicos**: `/pre-commit-review`.

---

### Rama 16D — `chore/auth-hardening-and-audit`

**Propósito**: cerrar el loop con (a) AuditLog escritor real integrado en los guards de 16B, (b) test harness cross-workspace / cross-user / cross-slug que vive al nivel de invariante bloqueante, (c) rate-limiting por actor en endpoints operator-facing (hoy solo existe por slug/IP en endpoints públicos).

**Archivos a crear**:
- `src/lib/audit/audit-log.service.ts` — writer que los guards invocan para mutaciones relevantes. Diff seguro (nunca serializa `password_hash`, tokens, secretos).
- `src/test/auth-invariants.test.ts` — gate bloqueante en CI (`.github/workflows/ci.yml`). Matriz cross-workspace × cross-slug × cross-capability; si algún endpoint permite una combinación prohibida, CI rojo.
- `src/lib/auth/rate-limit-per-actor.ts` — reusa `sliding-window-rate-limit.ts` (ya existe de 13A/13D) con key `actorId`.

**Archivos a modificar**:
- Guards de 16B — emit `AuditLog` en mutaciones.
- Endpoints sensibles (export, incident status change, messaging send) — rate-limit por actor.

**Tests**:
- `AuditLog` escribe con `actor`, `entidad`, `acción`, `diff seguro` (el shape declarado en `docs/SECURITY_AND_AUDIT.md` §4).
- Rate-limit dispara 429 con `Retry-After`.

**Criterio de done**: invariantes anti-cross-workspace bloqueantes en CI; AuditLog poblado por cada mutación relevante; panel minimal de audit (read-only) para inspección en desarrollo.

**Preparación**:
- **Contexto a leer**: 16A + 16B + 16C, `docs/SECURITY_AND_AUDIT.md` §4, `src/lib/services/sliding-window-rate-limit.ts`.
- **Docs a actualizar al terminar**: `docs/SECURITY_AND_AUDIT.md` completar, `docs/QA_AND_RELEASE.md` (nueva suite de invariantes).
- **Skills/tools específicos**: **Agent code-reviewer** como pase independiente antes de merge — esta rama es la más cercana a producción-crítica del plan.

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
                                        10F Guest presentation layer (normalizer + presenter registry + anti-leak invariants)
                                                    ▼
                                        10G Hero + quick-actions (consume heroEligible/quickActionEligible + displayValue)
                                                    ▼
                                        10H Client search (Fuse.js sobre displayValue, <20ms p95)
                                                    ▼
                                        10I PWA (manual SW + 3-tier offline cache del tree ya normalizado)

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
  11F Semantic search en guía pública (capa 2 de Fuse 10H)

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

Fase 15 (requiere entrega del paquete de diseño Liora; NO bloquea 10G/H/I ni 11/12/13/14)
  15A tokens → 15B primitivos → 15C guest → 15D shell operador → 15E módulos operador
                                                               → 15F messaging/assistant (requiere Fase 11 y/o 12)
                                                               → 15G cleanup legacy (último, siempre)

Fase 16 (iniciativa transversal; NO bloquea ramas funcionales en vuelo; se intercala según prioridad de producto/seguridad)
  16A operator auth foundation (sessions/login, sin guards aún)
        ▼
  16B route guards + workspace ownership (aplica guards a TODO el catálogo operator-facing)
        ▼
  16C public-guide capabilities (generaliza HMAC de 13D; ortogonal a 16A/B)
        ▼
  16D hardening: AuditLog writer + cross-workspace invariants en CI + rate-limit por actor
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
| **Endpoints operator-facing sin auth real** (hallazgo de review 14B) | Fase 16 transversal — ninguna PR puede declarar su endpoint "seguro" hasta 16B; documentación de feature explicita el status quo |
| Cookie HMAC de guest flows (13D) escalará a múltiples capabilities | Fase 16C generaliza el patrón a un servicio común con registro de capacidades + retrocompat ≥1 release |

---

## 7. Timeline estimado (sin comprometer fechas)

- Fase 8 ✅: 3 PRs → completada
- Fase 9 ✅: 4 PRs → completada
- Fase 10: 9 PRs. 10A/B/C/D/E ✅ (merged). 10F (nueva, `fix/guest-presentation-layer`) → 10G → 10H → 10I secuencial. Resto de la fase: 2-3 semanas (10F ~1 semana, 10G–10I 2 semanas). **10F es prerrequisito duro** de 10G/H/I: sin capa de presentación, el hero exhibiría copy editorial del host y la search indexaría enums/JSON.
- Fase 11: 6 PRs secuenciales (11A→11B→11C→{11D,11E}→11F) → 4-5 semanas. 11C es la rama más costosa (providers, tuning, evals iniciales)
- Fase 12: 12A independiente, 12B→12C secuencial → 1-2 semanas
- Fase 13: 4 PRs; 13A/B/C paralelizables, 13D depende de 10E → 2 semanas
- Fase 14: depende de decisión estratégica; 4 PRs secuenciales → 6-8 semanas
- Fase 15: 7 PRs, bloqueadas por entrega del paquete Liora. Duración no estimable hoy (depende del alcance del paquete). Se intercala en el calendario cuando la entrega ocurra; no desplaza las fases funcionales en vuelo.
- Fase 16: 4 PRs secuenciales (16A → 16B → 16C → 16D) → 3-4 semanas. 16B es la más costosa (audita y protege todo el catálogo operator-facing actual + gate automático). Priorización fuera del timeline funcional — se intercala cuando producto/seguridad decidan o cuando un incidente fuerce la decisión.

**Total plan**: 45 ramas (14 ✅ completadas, 31 pendientes de las cuales 7 son Fase 15 con prerrequisito externo y 4 son Fase 16 con prerrequisito de priorización). Orden óptimo funcional: 10G/H/I en secuencia, 11 en dedicated sprint, 12+13 en paralelo, 14 según demanda estratégica. Fase 15 se activa con entrega de diseño. Fase 16 se activa cuando producto/seguridad lo prioricen — no bloquea 10–15.

---

## 8. Decisiones abiertas (confirmar antes de empezar cada fase)

1. ~~**Provider de storage para media (Fase 10)**~~: ✅ Cloudflare R2 (decidido en 10A).
2. ~~**Presenter registry layout (Fase 10F)**~~: ✅ `Map<taxonomyKey | presentationType, Presenter>` con fallback `generic-text` + cobertura obligatoria sobre `policy_taxonomy` + `contact_roles` + `amenity_taxonomy` (decidido en Fase -1 de 10F, rev. 4 plan-update).
3. ~~**Superficie de tipo presentation en `GuideItem` (Fase 10F)**~~: ✅ cuatro campos opcionales (`presentationType?`, `displayValue?`, `displayFields?`, `presentationWarnings?`); los flags editoriales (`heroEligible`, `quickActionEligible`, `guestCriticality`, `hideWhenEmptyForGuest`) viven en las **taxonomías**, no en el tipo (rev. 4 plan-update).
4. **Service Worker strategy (Fase 10I)**: SW manual propio (decidido en Fase -1 de 10I) vs `next-pwa`. Confirmar versionado del SW (single bumped version vs per-asset hash) antes de 10I.
5. **Reranker provider (Fase 11C)**: Cohere Rerank 3 `rerank-multilingual-v3.0` (default Fase -1) vs Voyage Rerank. Confirmar antes de 11C según pricing actual + latencia p95.
6. **Embeddings provider (Fase 11C)**: Voyage `voyage-3-lite` (default) vs OpenAI `text-embedding-3-small`. Decidir antes de 11C.
7. **i18n fallback policy (Fase 11B)**: locale missing → mostrar en `defaultLocale` con nota visible (default) vs auto-translate con LLM (diferido a FUTURE). Confirmar.
8. **Scheduler para messaging automations (Fase 12B)**: cron simple (Vercel cron) vs queue (BullMQ). Depende de volumen esperado.
9. **Email provider para issue-reporting (Fase 13D)**: reusar lo de 12B si existe vs Resend vs Postmark. Decidir antes de 13D.
10. **Events provider (Fase 13B)**: Eventbrite vs Ticketmaster vs scraping. Decidir antes de 13B.
11. **Platform integrations (Fase 14)**: ¿arrancar con Airbnb, Booking, o ambos? Decisión estratégica previa.
12. **Liora Design Replatform (Fase 15)**: entrega del paquete de diseño (tokens + primitivos + superficies) + confirmación del scope inicial (superficies a migrar primero). Sin entrega, Fase 15 no arranca. Mientras tanto aplican las reglas anti-legacy de `docs/ARCHITECTURE_OVERVIEW.md` §14 a **todas** las ramas en vuelo.
13. **Auth foundation library (Fase 16A)**: NextAuth/Auth.js v5 vs Lucia vs Better-Auth vs custom. Decidir antes de arrancar 16A (Fase -1 de esa rama).
14. **Session storage (Fase 16A)**: DB-backed (tabla `Session` en Prisma, permite revocación real) vs JWT firmado (más barato). Sesgado hacia DB-backed por política de secret management (SECURITY_AND_AUDIT §3).
15. **Guest capability token format (Fase 16C)**: generalizar HMAC ad-hoc de 13D (`GUEST_INCIDENT_COOKIE_SECRET`) vs adoptar JWT estándar (`jose`). Decidir antes de 16C.
16. **Prioridad transversal de Fase 16**: ¿arrancar tras 14B, tras 14 completa, o esperar a incidente? Decisión de producto/seguridad — no está en el camino crítico de ningún entregable funcional.

---

## 9. Futuro — fuera del alcance de este plan

Ver [FUTURE.md](FUTURE.md):

- Admin UI para editar taxonomías (4 niveles)
- Calibración de completeness (post-uso real, medición)

Los triggers para activarlos están documentados allí.
