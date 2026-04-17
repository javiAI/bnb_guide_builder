# ROADMAP

Estado actual y próximos pasos. Este documento es el punto de entrada rápido; el detalle ejecutable vive en `MASTER_PLAN_V2.md`.

## Donde estamos (2026-04-17)

### Completado — MASTER_PLAN v1 (fases 1A-7B, 20 PRs)

Ver `archive/v1-master-plan-executed.md` para el detalle. Highlights:

- Motor condicional unificado (`src/lib/conditional-engine/`)
- Modelo amenities v2 (`PropertyAmenityInstance` + `Placement`), legacy eliminado
- Subtypes + derivations + cross-validations
- `PropertyDerived` cache + completeness scoring
- Overview con gaps/blockers/next-action
- Spaces: overlays por propertyType + archive + wizard seed tracking
- Troubleshooting linking + Incident model
- `VisibilityLevel` enum
- 8 amenity additions (Rama 7B)

### Pendiente del plan v1

Solo `7C — completeness calibration`, measurement-dependent. Ver `FUTURE.md`.

---

## Siguiente — MASTER_PLAN v2 (fases 8-14)

Fuente de verdad ejecutable: [MASTER_PLAN_V2.md](MASTER_PLAN_V2.md) · Quickref sesión: [HANDOFF.md](HANDOFF.md).

| Fase | Título | Ramas | Riesgo | Esfuerzo |
|---|---|---:|---|---|
| 8 ✅ | Deuda técnica pre-output | 3 | Bajo | completada |
| 9 ✅ | Guest Guide v2 (output principal) | 4 | Medio | completada |
| 10 | Media + Guide Renderer + Presentation layer + PWA | 9 | Medio | 10A/B/C/D/E ✅; 10F (presentation boundary) + 10G/H/I 2-3 sem |
| 11 | Knowledge + Assistant + i18n | 6 | Alto | 4-5 sem |
| 12 | Messaging con variables | 3 | Medio | 1-2 sem |
| 13 | Guía local + issue reporting | 4 | Bajo | 2 sem |
| 14 | Platform integrations (Airbnb/Booking) | 4 | Alto | multi-mes |

**Total plan V2**: 33 ramas (12 ✅ completadas, 21 pendientes). Siguiente: **Rama 10F `fix/guest-presentation-layer`** (ver *Estado y problema actual*).

### Estado y problema actual (post-auditoría 2026-04-17)

La infraestructura del pipeline guest está construida: `composeGuide → filterByAudience → render` con tipos sólidos, media proxy estable (10D) y renderer React (10E). **Lo que no está construido es la frontera de presentación**: hoy, un JSON crudo en `policiesJson`, un enum `rm.smoking_outdoor_only`, una `emptyCopy` editorial ("Añade normas…") o un label interno ("Slot") pueden cruzar la frontera `audience=guest` sin que nada los detenga.

**Problema principal (bloqueante)**: no hay paso de normalización terminal. `filterByAudience` filtra por visibilidad, pero el huésped puede recibir estructura interna legible (enums, JSON, copy del host). Sin resolver esto, el hero, la search y la PWA heredan todos los leaks.

**Qué está bien**:

- Composición y filtrado (9A, [src/test/guide-rendering.test.ts](../src/test/guide-rendering.test.ts)).
- Media proxy content-addressable con ETag escopado a variante (10D).
- `includesMedia` per sección evita queries vacías.
- Schema version en el tree + fallback runtime (bump a 3 en 10F).

**Qué está mal (o suele leakear)**:

- `GuideItemField.value` emitido raw sin humanización (enums, JSON, números sin unidades/locale).
- `GuideSection.emptyCopy` es copy editorial del host servida al huésped si la sección está vacía.
- Labels internos (`"Slot"`, `"Propiedad"`, `"Config JSON"`) se cuelan en los 9 slots si el resolver no los traduce.
- Taxonomías no declaran `guestLabel` / `guestDescription` / `icon` / `heroEligible` / `quickActionEligible` / `guestCriticality`, que las ramas de UX (10G/H/I) necesitan para tomar decisiones editoriales sin hardcode.
- No hay tests de invariantes anti-leak; un resolver nuevo puede regresar a raw sin red.

**Prioridades reales (orden óptimo)**:

1. **10F `fix/guest-presentation-layer`** — 1 semana · **MAX PRIORIDAD**. Sella la frontera, humaniza, prepara campos de UX. Sin esto, 10G/10H heredan el bug.
2. **10G hero + quick actions** — 1 semana. Consume `heroEligible` + `displayValue` ya listos.
3. **10H client search** — 0.5 semana. Indexa sobre `displayValue`.
4. **10I PWA offline** — 1 semana. Cachea el tree ya normalizado.
5. **Fase 11** — Knowledge + Assistant + i18n.
6. **Fase 12/13/14** — Messaging, Guía local + issue reporting, Platform integrations.

**Orden sugerido (actualizado)**:

- Ahora: **Fase 10** — abrir **10F `fix/guest-presentation-layer`** (normalizador + presenter registry + invariantes; prerrequisito duro de toda UX premium).
- Después: 10G hero → 10H search → 10I PWA.
- Siguiente: **Fase 11** — Knowledge + Assistant + i18n.
- Luego: **Fase 12** → **Fase 13** → **Fase 14** según demanda estratégica.

### Progreso Fase 8

- ✅ **8A** `refactor/completeness-to-json` — reglas a `taxonomies/completeness_rules.json` + Zod + helpers (`getCompletenessRule`, `getSpaceTypesWithExpectedBeds`, `amenityRequiresPlacement`)
- ✅ **8B** `refactor/field-type-registry` — `FIELD_TYPES` + renderers unificados para amenity/system subtypes; `getFieldType` lanza loud para tipos desconocidos; tipos estrechados de `string` a `SubtypeFieldType`
- ✅ **8C** `chore/docs-and-memory-sync` — sync de auto-memory al estado post-8A/8B (archivos fuera del repo, en `.claude/`): borra planes ejecutados, deja pointers a ROADMAP/FUTURE y crea una nueva memoria de progreso

### Progreso Fase 9

- ✅ **9A** `feat/guide-rendering-engine` — `composeGuide(propertyId, audience)` + `GuideTree` tipado + `taxonomies/guide_sections.json` + resolvers por sección + `renderMarkdown` stub + snapshot tests. PR #48 merged (9c34a23).
- ✅ **9B** `feat/guide-markdown-output` — Markdown + HTML + PDF renderers + GET /api/.../guide endpoint. PR #50 merged (240f0d1).
- ✅ **9C** `feat/guide-publish-workflow` — Snapshot versionado (`GuideVersion.treeJson`), publish/unpublish/rollback, diff visual (multiset field diff), depreca `GuideSection`/`GuideSectionItem`. PR #51 merged.
- ✅ **9D** `feat/guide-shareable-link` — URL pública shareable + QR + slug service + ruta `/g/:slug` guest-only. PR #52 merged.

### Progreso Fase 10 (2026-04-17 revisada: 3→9 ramas, +10F `fix/guest-presentation-layer`)

- ✅ **10A** `feat/media-storage` — Cloudflare R2 storage service + presigned uploads + blurhash + server actions (request/confirm/delete/download). PR #53 merged.
- ✅ **10B** `feat/media-per-entity` — EntityGallery reutilizable + UploadDropzone (drag&drop multi-archivo, presigned → R2) + reorder + cover photo + integrado en spaces/access/amenities + Mediateca refactorizada. PR #54 merged.
- ✅ `refactor/shared-action-result` — ActionResult<T> extraído a `src/lib/types/action-result.ts`, 8 definiciones duplicadas eliminadas, 33 consumidores migrados. PR #55 merged.
- ✅ **10C** `feat/media-in-guide` — `GuideItem.media[]` poblado desde `MediaAssignment` + `MediaAsset` (cover, spaces, amenity instances, primary access). Single batched `mediaAssignment.findMany` por compose (OR por `entityType`, filtro `image/*`), audiencia filtrada. `GuideMedia` con variantes `{thumb, md, full}` + alt derivado (caption → `role — entityLabel`). Markdown inline `![alt](md) *caption*`, HTML `<figure><img/><figcaption/></figure>`, cap 3 por item. `includesMedia` por sección en taxonomy. PR #58 merged.
- ✅ **10D** `feat/guide-media-proxy` — `/g/:slug/media/:assetId-:hashPrefix/:variant` con cache immutable + ETag escopado a variant + 304/206 + auth por `publicSlug` + ≥1 `GuideVersion.published`. Passthrough MVP (Sharp/CF Image Resizing diferido). Backfill de `contentHash` vía ETag de R2. PR #57.
- ✅ **10E** `feat/guide-react-renderer` — renderer React con journey IA (Essentials/Howto/Checkout/Emergency fused) + brand theming + WCAG 2.2 AA + lightbox + maps stub + TOC sticky. PR #59 merged.
- ⏳ **10F** `fix/guest-presentation-layer` — **NUEVA** (rev. 4, post-auditoría). Paso terminal `normalizeGuideForPresentation(tree, audience)` + presenter registry (taxonomyKey → formatter humanizado) + campos `presentationType?` / `displayValue?` / `displayFields?` / `presentationWarnings?` en `GuideItem` + `GUIDE_TREE_SCHEMA_VERSION = 3` + extensión de `policy_taxonomy` / `contact_roles` / `amenity_taxonomy` con `guestLabel` / `heroEligible` / `quickActionEligible` / `guestCriticality` + `emptyCopyGuest` / `hideWhenEmptyForGuest` en `guide_sections.json` + invariantes anti-leak (no raw JSON, no enum leaks, no copy editorial de host, no labels internos). **Prerrequisito duro** de 10G/H/I. Ver [HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md](research/HANDOFF_GUEST_GUIDE_AUDIT_AND_REPLAN.md).
- ⏳ **10G** `feat/guide-hero-quick-actions` — hero con countdown + quick-actions (copy-wifi, call, whatsapp, maps) + tracking endpoint. Consume `heroEligible` + `quickActionEligible` + `displayValue` de 10F (no hay curación hardcoded).
- ⏳ **10H** `feat/guide-client-search` — Fuse.js instant search (<20ms p95) sobre `GuideTree` serializado. Index construido desde `displayValue` / `displayFields.value` (nunca desde `value` raw).
- ⏳ **10I** `feat/guide-pwa-offline` — manual Service Worker + 3-tier offline cache (shell + predictive images + lazy noncritical) + A2HS nudge. Cache del tree ya normalizado — offline nunca expone más modelo interno que online.

### Progreso Fase 11 (2026-04-17 revisada: 4→6 ramas)

- ⏳ **11A** `feat/knowledge-autoextract` — schema AI completo (chunkType, journeyStage, contextPrefix, bm25Text, sourceFields, embedding col) + extractors para 7 fuentes.
- ⏳ **11B** `feat/knowledge-i18n` — locale como filtro duro del retriever; templates i18n + UI de missing translations.
- ⏳ **11C** `feat/assistant-retrieval-pipeline` — hybrid BM25+vector (RRF) + Cohere Rerank 3 + Voyage embeddings + pgvector ivfflat.
- ⏳ **11D** `feat/assistant-escalation` — escala a contacto estructurado cuando confidence/citations bajas.
- ⏳ **11E** `feat/assistant-evals` — banco ≥50 fixtures + release gate accuracy ≥85% + recall@5 ≥0.9.
- ⏳ **11F** `feat/guide-semantic-search` — búsqueda semántica en guía pública (capa 2 de Fuse).

### Progreso Fase 13 (2026-04-17 revisada: 3→4 ramas)

- ⏳ **13A** `feat/local-pois-autosuggest` · **13B** `feat/local-events-sync` · **13C** `feat/guide-maps-embedded` · **13D** `feat/guide-issue-reporting` (nueva — reporte de problemas desde `/g/:slug` con foto, notificación al host y track-URL).

### Orden sugerido

1. **Ahora**: Fase 8 (desbloquea todo lo demás barato)
2. **Sprint siguiente**: 9 + 10 en paralelo (output + media se necesitan juntos)
3. **Mes 2**: 11 (Knowledge + Assistant — diferenciador del producto)
4. **Mes 3**: 12 + 13 en paralelo
5. **Q siguiente**: 14 si hay decisión estratégica de plataformas

---

## Futuro diferido

Trabajo con trigger condicional — ver [FUTURE.md](FUTURE.md):

- Admin UI para taxonomías (4 niveles)
- Calibración de completeness (post-uso real)
- Image resize/optimization on upload (Sharp o Cloudflare Image Resizing)
- Revelado condicional de contenido sensible (timeline-based visibility)
- Journey-stage aware UI (renderer reordena según stage detectado)
- Upsells contextuales en la guía
- Brand theming avanzado (tipografía, dark mode, patrones)
- Analytics dashboard de la guía pública
- Video optimization pipeline (HLS adaptive bitrate)
- Auto-translate de KnowledgeItems con LLM
