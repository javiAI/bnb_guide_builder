# Plan maestro V2 — Outputs, Intelligence & Integrations

Versión: 2026-04-15
Continuación de: [archive/v1-master-plan-executed.md](archive/v1-master-plan-executed.md) (fases 1A–7B completadas)
Alcance: 7 fases, 24 ramas, ~24 PRs independientes y revisables

---

## Principios de ejecución

Heredados del v1 y reconfirmados:

1. **Una rama = una PR = un cambio lógico**. Nada de super-PRs.
2. **Config-driven**: si una regla vive en React, es un bug.
3. **Tests nuevos en cada PR**. Sin tests, no merge.
4. **Validación TS + Prisma antes de commit** (`/pre-commit-review`).
5. **Revisión Copilot en cada PR** (`/review-pr-comments`).
6. **No backward-compat silencioso**. Tras una migración validada, el código legacy se borra en la misma rama o en la siguiente.
7. **Visibility first**: cualquier feature que toque output (guide/messaging/assistant) pasa por el filtro de visibility antes de considerarse feature-complete.

---

## Resumen de fases

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

---

### Rama 8C — `chore/docs-and-memory-sync`

**Propósito**: sincronizar memoria auto (`MEMORY.md` + archivos) con el estado post-consolidación de docs. Retirar referencias obsoletas (`project_roadmap.md` apunta a secciones ya hechas, etc.).

**Archivos a modificar**:
- `.claude/projects/.../memory/MEMORY.md` — quitar entradas rotas o duplicadas
- `.claude/projects/.../memory/project_roadmap.md` — reemplazar con puntero a `docs/ROADMAP.md`
- `.claude/projects/.../memory/project_implementation_plan.md` — archivar (plan v1 cerrado)

**Criterio de done**: memoria refleja realidad actual; docs operativos son la fuente de verdad.

---

## FASE 9 — Guest Guide v2

**Objetivo**: convertir la página `/guest-guide` en un renderer real. Hoy es un shell de 114 LOC; debe componer una guía publicable desde Property + Spaces + Amenities + Access + Contacts + Rules + Systems.

### Rama 9A — `feat/guide-rendering-engine`

**Propósito**: servicio `GuideRenderingService.compose(propertyId, audience)` que produce un árbol tipado `GuideTree` desde entidades canónicas, aplicando filtros de visibility por audiencia.

**Archivos a crear**:
- `src/lib/services/guide-rendering.service.ts`:
  - `composeGuide(propertyId, audience): GuideTree`
  - `resolveSection(sectionKey, propertyId, audience)` — uno por sección (arrival, spaces, amenities, rules, contacts, local, emergency)
- `src/lib/types/guide-tree.ts` — tipos `GuideTree`, `GuideSection`, `GuideItem`, `GuideMedia`
- `taxonomies/guide_sections.json` — declaración de secciones, orden, visibility máxima por sección, CTA deep-link

**Archivos a modificar**:
- `src/lib/taxonomy-loader.ts` — helper `getGuideSectionConfig()`

**Tests**:
- `src/test/guide-rendering.test.ts`:
  - `composeGuide` filtra `sensitive` en audience=`guest`
  - incluye `ai`-level en audience=`ai`
  - orden de secciones respeta `guide_sections.json`
  - propiedad sin space.bedroom omite la sección Spaces (no error)
- `src/test/guide-tree-schema.test.ts` — tipos estrictos, no unknown accidentales

**Criterio de done**: servicio puro, 100% cubierto. No UI todavía.

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

**⚠ Nota infra**: definir bucket + IAM policy antes de merge. Documentar en `docs/FEATURES/MEDIA_ASSETS.md`.

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

---

### Rama 11B — `feat/assistant-retrieval-pipeline`

**Propósito**: RAG con filtros de visibility. Intent → retrieve → filter → synthesize con citas.

**Archivos a crear**:
- `src/lib/services/assistant/intent-resolver.ts` — normaliza pregunta → intent + entities
- `src/lib/services/assistant/retriever.ts` — vector search (pgvector o similar) + filtro visibility + idioma
- `src/lib/services/assistant/synthesizer.ts` — llama a LLM con contexto + instrucciones de cita
- `src/lib/services/assistant/pipeline.ts` — orquestador
- `src/app/api/properties/[propertyId]/ask/route.ts` — endpoint POST con audience

**Archivos a modificar**:
- `prisma/schema.prisma` — `KnowledgeItem.embedding Vector?` (si pgvector), índice vectorial
- `src/app/properties/[propertyId]/ai/page.tsx` — chat UI real

**Tests**:
- `src/test/assistant-retrieval.test.ts` — 20 preguntas fixture → respuestas con citas correctas
- `src/test/assistant-visibility-leak.test.ts` — pregunta que intenta sonsacar secreto → responder denegando, no filtrarlo

**Criterio de done**: huésped puede preguntar "¿cómo abro la puerta?" y recibe respuesta con cita al `KnowledgeItem` de access-method.

**⚠ Decisión previa requerida**: modelo LLM (Claude Sonnet 4.6 por defecto), proveedor de embeddings, storage vectorial. Documentar en spec antes de PR.

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

---

### Rama 11D — `feat/assistant-evals`

**Propósito**: banco de evals + release gate. Sin esto, el assistant no es production-ready.

**Archivos a crear**:
- `src/test/assistant-evals/fixtures.json` — ≥50 pares (pregunta, intent esperado, respuesta mínima aceptable)
- `src/test/assistant-evals/runner.ts` — corre fixtures contra pipeline real
- `src/test/assistant-evals/release-gate.test.ts` — falla si accuracy < umbral

**Criterio de done**: CI falla si una PR del assistant baja la accuracy. Dashboard de metrics por intent.

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

---

### Rama 14C — `feat/booking-export`

**Propósito**: idem para Booking.com.

**Archivos a crear**:
- `src/lib/exports/booking.ts`
- `src/lib/schemas/booking-listing.ts`
- `src/app/api/properties/[propertyId]/export/booking/route.ts`

**Tests**: idem 14B.

**Criterio de done**: idem 14B.

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

---

## Checklist de ejecución por PR

Idéntico al v1:

1. [ ] Branch creada desde `main` actualizada
2. [ ] Cambios implementados
3. [ ] Tests nuevos pasan (`npx vitest run`)
4. [ ] `npx prisma generate && npx tsc --noEmit` sin errores
5. [ ] `/pre-commit-review` sin issues críticos
6. [ ] Commit con mensaje descriptivo
7. [ ] Push + PR con description + test plan
8. [ ] `/review-pr-comments` para aplicar feedback Copilot
9. [ ] Merge squash + delete branch
10. [ ] `git pull origin main --ff-only`

---

## Dependencias entre fases

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

Fase 13 (independiente post-10)
  13A POIs ──► 13B Events ──► 13C Maps

Fase 14 (requiere estabilidad de 9-11)
  14A Mappings audit ──► 14B Airbnb export
                     ──► 14C Booking export
                              ▼
                         14D Import
```

---

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Render de guía lento con muchos spaces/amenities | Medir p95; cachear `GuideTree` en `PropertyDerived` si >300ms |
| S3 costs escalan con usuarios | Lifecycle rules (thumbnails a Glacier tras N días) |
| LLM costs del assistant sin tope | Rate limiting + budget alerts + cache de respuestas frecuentes |
| Evals del assistant degradadas por cambio de modelo | CI gate en 11D bloquea regresiones |
| Platform APIs cambian schema | Contract tests en 14B/14C; fallback a snapshot validation |
| Import sobrescribe datos del host | Diff visible + confirmación explícita; audit log de cambios |

---

## Timeline estimado (sin comprometer fechas)

- Fase 8: 3 PRs paralelizables → 2-3 días
- Fase 9: secuencial (9A→9B→9C→9D) → 2-3 semanas
- Fase 10: 10A→10B→10C, paralelizable parcial con 9B+
- Fase 11: 11A→11B→11C→11D secuencial → 3-4 semanas
- Fase 12: paralelizable 12A independiente, 12B→12C secuencial → 1-2 semanas
- Fase 13: 3 PRs paralelizables → 1-2 semanas
- Fase 14: depende de decisión estratégica; 4 PRs secuenciales → 6-8 semanas

**Total**: ~24 PRs. Orden óptimo: 8 primero (desbloquea todo), luego 9+10 en paralelo, 11 en dedicated sprint, 12+13 en paralelo, 14 según demanda.

---

## Decisiones abiertas (confirmar antes de empezar cada fase)

1. **Provider de storage para media (Fase 10)**: S3 vs Cloudflare R2 vs Supabase storage. Decidir antes de 10A.
2. **Provider LLM + embeddings (Fase 11B)**: default Claude Sonnet 4.6 + Voyage embeddings, salvo preferencia distinta.
3. **Scheduler para messaging automations (Fase 12B)**: cron simple (vercel cron) vs queue (BullMQ). Depende de volumen esperado.
4. **Events provider (Fase 13B)**: Eventbrite vs Ticketmaster vs scraping. Decidir antes de 13B.
5. **Platform integrations (Fase 14)**: ¿arrancar con Airbnb, Booking, o ambos? Decisión estratégica previa.

---

## Futuro — fuera del alcance de este plan

Ver [FUTURE.md](FUTURE.md):

- Admin UI para editar taxonomías (4 niveles)
- Calibración de completeness (post-uso real, medición)

Los triggers para activarlos están documentados allí.
