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
| 10 | Media + Guide Renderer + PWA | 8 | Medio | 10A/B ✅; resto 2-3 sem |
| 11 | Knowledge + Assistant + i18n | 6 | Alto | 4-5 sem |
| 12 | Messaging con variables | 3 | Medio | 1-2 sem |
| 13 | Guía local + issue reporting | 4 | Bajo | 2 sem |
| 14 | Platform integrations (Airbnb/Booking) | 4 | Alto | multi-mes |

**Total plan V2**: 32 ramas (10 ✅ completadas, 22 pendientes). Siguiente: **Rama 10E `feat/guide-react-renderer`**.

**Orden sugerido (actualizado)**:
- Ahora: **Fase 10** — continuar por **10E `feat/guide-react-renderer`** (React renderer con journey IA, brand theming, WCAG 2.2 AA, lightbox — consume `GuideTree.media` ya poblado por 10C)
- Después: **Fase 11** — Knowledge + Assistant + i18n
- Luego: **Fase 12** — Messaging con variables
- Después: **Fase 13** — Guía local + issue reporting
- Finalmente: **Fase 14** — Platform integrations (Airbnb/Booking)

### Progreso Fase 8

- ✅ **8A** `refactor/completeness-to-json` — reglas a `taxonomies/completeness_rules.json` + Zod + helpers (`getCompletenessRule`, `getSpaceTypesWithExpectedBeds`, `amenityRequiresPlacement`)
- ✅ **8B** `refactor/field-type-registry` — `FIELD_TYPES` + renderers unificados para amenity/system subtypes; `getFieldType` lanza loud para tipos desconocidos; tipos estrechados de `string` a `SubtypeFieldType`
- ✅ **8C** `chore/docs-and-memory-sync` — sync de auto-memory al estado post-8A/8B (archivos fuera del repo, en `.claude/`): borra planes ejecutados, deja pointers a ROADMAP/FUTURE y crea una nueva memoria de progreso

### Progreso Fase 9

- ✅ **9A** `feat/guide-rendering-engine` — `composeGuide(propertyId, audience)` + `GuideTree` tipado + `taxonomies/guide_sections.json` + resolvers por sección + `renderMarkdown` stub + snapshot tests. PR #48 merged (9c34a23).
- ✅ **9B** `feat/guide-markdown-output` — Markdown + HTML + PDF renderers + GET /api/.../guide endpoint. PR #50 merged (240f0d1).
- ✅ **9C** `feat/guide-publish-workflow` — Snapshot versionado (`GuideVersion.treeJson`), publish/unpublish/rollback, diff visual (multiset field diff), depreca `GuideSection`/`GuideSectionItem`. PR #51 merged.
- ✅ **9D** `feat/guide-shareable-link` — URL pública shareable + QR + slug service + ruta `/g/:slug` guest-only. PR #52 merged.

### Progreso Fase 10 (2026-04-17 revisada: 3→8 ramas)

- ✅ **10A** `feat/media-storage` — Cloudflare R2 storage service + presigned uploads + blurhash + server actions (request/confirm/delete/download). PR #53 merged.
- ✅ **10B** `feat/media-per-entity` — EntityGallery reutilizable + UploadDropzone (drag&drop multi-archivo, presigned → R2) + reorder + cover photo + integrado en spaces/access/amenities + Mediateca refactorizada. PR #54 merged.
- ✅ `refactor/shared-action-result` — ActionResult<T> extraído a `src/lib/types/action-result.ts`, 8 definiciones duplicadas eliminadas, 33 consumidores migrados. PR #55 merged.
- ✅ **10C** `feat/media-in-guide` — `GuideItem.media[]` poblado desde `MediaAssignment` + `MediaAsset` (cover, spaces, amenity instances, primary access). Single batched `mediaAssignment.findMany` por compose (OR por `entityType`, filtro `image/*`), audiencia filtrada. `GuideMedia` con variantes `{thumb, md, full}` + alt derivado (caption → `role — entityLabel`). Markdown inline `![alt](md) *caption*`, HTML `<figure><img/><figcaption/></figure>`, cap 3 por item. `includesMedia` por sección en taxonomy. PR #58 merged.
- ✅ **10D** `feat/guide-media-proxy` — `/g/:slug/media/:assetId-:hashPrefix/:variant` con cache immutable + ETag escopado a variant + 304/206 + auth por `publicSlug` + ≥1 `GuideVersion.published`. Passthrough MVP (Sharp/CF Image Resizing diferido). Backfill de `contentHash` vía ETag de R2. PR #57.
- ⏳ **10E** `feat/guide-react-renderer` — renderer React con journey IA (Essentials/Howto/Checkout/Emergency fused) + brand theming + WCAG 2.2 AA + lightbox + maps stub + TOC sticky.
- ⏳ **10F** `feat/guide-hero-quick-actions` — hero con countdown + quick-actions (copy-wifi, call, whatsapp, maps) + tracking endpoint.
- ⏳ **10G** `feat/guide-client-search` — Fuse.js instant search (<20ms p95) sobre `GuideTree` serializado.
- ⏳ **10H** `feat/guide-pwa-offline` — manual Service Worker + 3-tier offline cache (shell + predictive images + lazy noncritical) + A2HS nudge.

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
