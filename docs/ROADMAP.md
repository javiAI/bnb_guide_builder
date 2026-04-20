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
| 10 | Media + Guide Renderer + Presentation layer + PWA + E2E harness | 10 | Medio | 10A–G/J ✅; 10H/I 1-2 sem |
| 11 | Knowledge + Assistant + i18n | 6 | Alto | 4-5 sem |
| 12 | Messaging con variables | 3 | Medio | 1-2 sem |
| 13 | Guía local + issue reporting | 4 | Bajo | 2 sem |
| 14 | Platform integrations (Airbnb/Booking) | 4 | Alto | multi-mes |
| 15 | Liora Design Replatform | 7 | Bloqueada | depende de entrega del paquete de diseño |

**Total plan V2**: 16 ramas ✅ completadas + 11A + 11B + 11C + 11D + 11E + 11F. Siguiente funcional: **Fase 12** — Messaging con variables (rama 12A).

**Fase 15 (Liora Design Replatform)** existe en el plan como prep condicional: está bloqueada por la entrega del paquete de diseño y **no bloquea** a 10H/I ni a las Fases 11-14. Las reglas anti-legacy de `docs/ARCHITECTURE_OVERVIEW.md` §14 aplican desde ya a toda rama en vuelo. Ver `docs/MASTER_PLAN_V2.md` § FASE 15 para scope y ramas 15A-G.

### Estado y problema actual (post-10I 2026-04-19)

La infraestructura del pipeline guest está completa: `composeGuide → filterByAudience → normalizeGuideForPresentation → render` con tipos sólidos, media proxy estable (10D), renderer React (10E), **capa de presentación terminal (10F)** que sella la frontera entre modelo interno y salida guest, **harness E2E + axe-core compartido (10J)** que ejecuta smoke + anti-leak + a11y sobre `/g/:slug` en 4 viewports × 3 fixtures como gate bloqueante en CI, **hero operativo con 5 quick actions universales (10G)** con degradación grácil, **client search instant con Fuse.js (10H)** sobre el surface de presentación, y **PWA instalable + offline 3-tier (10I)** con SW per-slug versionado por `buildVersion` de 10H.

**Qué queda pendiente del pliegue guest**: nada — Fase 10 completada. Siguiente: Fase 11 (Knowledge + Assistant + i18n).

**Qué está bien**:

- Composición y filtrado (9A) + presentation layer (10F) con presenter registry + 5 invariantes anti-leak blindadas.
- Media proxy content-addressable con ETag escopado a variante (10D).
- `includesMedia` per sección evita queries vacías.
- `GUIDE_TREE_SCHEMA_VERSION = 3` con pre-v3 normalization al servir (`snapshotPreV3`).

**Prioridades reales (orden óptimo)**:

1. **10H client search** — 0.5 semana. Indexa sobre `displayValue` / `displayFields.value`.
2. **10I PWA offline** — 1 semana. Cachea el tree ya normalizado.
3. **Fase 11** — Knowledge + Assistant + i18n.
4. **Fase 12/13/14** — Messaging, Guía local + issue reporting, Platform integrations.

**Orden sugerido (actualizado)**:

- Ahora: **10H search** (Fuse.js instant, consume `displayValue`/`displayFields` del pipeline 10F).
- Después: 10I PWA.
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

### Progreso Fase 10 (2026-04-18 revisada: 3→10 ramas, +10J harness E2E)

- ✅ **10A** `feat/media-storage` — Cloudflare R2 storage service + presigned uploads + blurhash + server actions (request/confirm/delete/download). PR #53 merged.
- ✅ **10B** `feat/media-per-entity` — EntityGallery reutilizable + UploadDropzone (drag&drop multi-archivo, presigned → R2) + reorder + cover photo + integrado en spaces/access/amenities + Mediateca refactorizada. PR #54 merged.
- ✅ `refactor/shared-action-result` — ActionResult<T> extraído a `src/lib/types/action-result.ts`, 8 definiciones duplicadas eliminadas, 33 consumidores migrados. PR #55 merged.
- ✅ **10C** `feat/media-in-guide` — `GuideItem.media[]` poblado desde `MediaAssignment` + `MediaAsset` (cover, spaces, amenity instances, primary access). Single batched `mediaAssignment.findMany` por compose (OR por `entityType`, filtro `image/*`), audiencia filtrada. `GuideMedia` con variantes `{thumb, md, full}` + alt derivado (caption → `role — entityLabel`). Markdown inline `![alt](md) *caption*`, HTML `<figure><img/><figcaption/></figure>`, cap 3 por item. `includesMedia` por sección en taxonomy. PR #58 merged.
- ✅ **10D** `feat/guide-media-proxy` — `/g/:slug/media/:assetId-:hashPrefix/:variant` con cache immutable + ETag escopado a variant + 304/206 + auth por `publicSlug` + ≥1 `GuideVersion.published`. Passthrough MVP (Sharp/CF Image Resizing diferido). Backfill de `contentHash` vía ETag de R2. PR #57.
- ✅ **10E** `feat/guide-react-renderer` — renderer React con journey IA (Essentials/Howto/Checkout/Emergency fused) + brand theming + WCAG 2.2 AA + lightbox + maps stub + TOC sticky. PR #59 merged.
- ✅ **10F** `fix/guest-presentation-layer` — paso terminal `normalizeGuideForPresentation(tree, audience)` + presenter registry con cascada de 5 pasos (null → exact → longest-prefix → `FALLBACK_ALLOWED_PREFIXES` (`sp.`/`am.`/`lp.`) → `rawSentinelPresenter`) + campos `presentationType?` / `displayValue?` / `displayFields?` / `presentationWarnings?` en `GuideItem` + `GUIDE_TREE_SCHEMA_VERSION = 3` (pre-v3 normalization al servir) + extensión de `policy_taxonomy` / `contact_roles` / `amenity_taxonomy` con `guestLabel` / `heroEligible` / `quickActionEligible` / `guestCriticality` + `emptyCopyGuest` / `hideWhenEmptyForGuest` en `guide_sections.json` + **5 invariantes anti-leak** blindadas unitariamente (no raw JSON, no enum leaks, no copy editorial de host, no labels internos, no `presentationType: "raw"` visible) sobre fixture adversarial + hide-silent para secciones huérfanas (log `guest-section-missing-empty-copy`) + observabilidad agregada (un solo `console.warn` por normalize con `{ byTaxonomyKey, byCategory }`) + `filterRenderableItems` recursivo (deep-filter de raw children). **Iter 2 (PR #61)** live-wire el sentinel, propaga warnings en `expandObject`, dedupe per-call en el log, y añade tests del leak raw-children anidado. 901 tests / lint + typecheck green. Playwright+axe **diferidos a 10J**.
- ✅ **10G** `feat/guide-hero-quick-actions` — hero operativo en `gs.essentials` con `GuideHero` + 5 quick actions universales (wifi_copy, call_host, whatsapp_host, maps_open, access_how) resueltas por registry Zod-validado, Radix toast para feedback de copy, targets ≥44×44, `composeGuide` threading `quickActionKeys`, emisión de `arrival.location` desde `Property.streetAddress`, curación intencional del hero (acceso → Wi-Fi → ubicación → operacional) sin flags per-item, Playwright+axe en 4 viewports. PR #64 merged (6a6c990).
- ✅ **10H** `feat/guide-client-search` — Fuse.js instant search (p95 <20ms / 200 entries) sobre `GuideTree` serializado en RSC. Server builder `buildGuideSearchIndex(tree)` tras `normalizeGuideForPresentation("guest")` lee solo `displayValue` / `displayFields[].displayValue`; dedup aggregator (anchor canónico) + children flatten con anchors `item-<parent>--child-<idx>`; `buildVersion` SHA-1 12-char para PWA cache invalidation en 10I. Client island Radix Dialog + Fuse v7 (threshold 0.35, ignoreDiacritics, keys `label ×2 / snippet ×1.5 / keywords ×1`), `/` abre, `Escape` cierra, `Enter` navega, `ArrowUp/Down` selección, `useDeferredValue` desacopla redraw del tipeo. `searchableKeywords[]` por sección en `guide_sections.json` (sinónimos ES). Zero-result hint + `console.info search-miss` via `src/lib/client/guide-analytics.ts` (debounce 600ms). Tokens rebind sobre `.guide-search__dialog` (Radix portaliza fuera de `.guide-root`). 947/947 unit + 139/139 E2E verdes, axe `serious|critical = 0` en 4 viewports.
- ✅ **10I** `feat/guide-pwa-offline` — Service Worker manual servido por route handler `/g/[slug]/sw.js` con scope estricto per-slug (`guide-<slug>-tier{1,2,3}-<version>`), versionado por `GuideSearchIndex.buildVersion` (rama 10H) — content change → hash flip → `update`. Tres tiers declarados en `taxonomies/guide_sections.json` vía `offlineCacheTier`: tier 1 (essentials/arrival/checkout/emergency) precached al install + SWR para HTML; tier 2 (thumbs) SWR con cap 12 (LRU); tier 3 (md/full) network-first con timeout 2s. Manifest dinámico (`/g/[slug]/manifest.webmanifest`) con `theme_color` derivado de `getBrandPair(brandPaletteKey).light` y `short_name` truncado a 12 chars. InstallNudge (`localStorage` per-slug, `visits >= 2 OR cumulativeMs >= 90s`) con dos paths: Chromium captura `beforeinstallprompt` y dispara `prompt()`; iOS Safari abre panel manual del share sheet. Offline shell estático precached. Sober/neutro para Liora replatform sin tocar trigger logic. 5 invariantes vitest (manifest shape, SW template substitution, precache asset existence, sección coverage de tier, install nudge threshold/persistence) + 1 spec E2E fuerte (manifest+sw+offline HTTP + DOM nudge + axe). 961/961 unit + 159/159 E2E verdes.
- ✅ **10J** `chore/e2e-harness-public-guide` — harness Playwright + `@axe-core/playwright` compartido: fixtures `empty` / `rich` / `adversarial` (reusa `src/test/fixtures/adversarial-property.ts` de 10F), 4 projects (chromium 375/768/1280 + webkit-mobile 375), ruta dev-only `/g/e2e/[fixture]` gateada por `E2E=1` que replica el pipeline real (`filterByAudience → normalizeGuideForPresentation → GuideRenderer`), 3 specs compartidas: smoke (200 + shell), anti-leak (invariantes 1–4 sobre `main.innerText`, la 5 sigue cubierta unitariamente porque el renderer colapsa `raw` a `null`), axe-core (tags WCAG 2.1 AA, blocking `serious|critical = 0`). `npm run test:e2e` (build + start, canónico/CI) + `npm run test:e2e:dev` (next dev). CI `.github/workflows/ci.yml` con jobs `unit` + `e2e` paralelos, artifacts `playwright-report/` siempre y `test-results/` en fallo. 96/96 E2E + 901/901 unit verdes. Prerrequisito operativo de 10G/H/I desbloqueado.

### Progreso Fase 11 (2026-04-17 revisada: 4→6 ramas)

- ✅ **11A** `feat/knowledge-autoextract` — schema AI completo (chunkType, journeyStage, contextPrefix, bm25Text, sourceFields, embedding col) + extractors para 7 fuentes + invalidación wired en editor.actions + UI Regenerar + 62 tests.
- ✅ **11B** `feat/knowledge-i18n` — locale como filtro duro del retriever + identidad cross-locale por `templateKey` estable (`(propertyId, entityType, entityId, templateKey)`, no `id+locale`); 4 inline extractors (contacts/amenities/spaces/systems) con `topic`+`bodyMd` localizados; `isSupportedLocale` centralizado en `regenerateLocaleAction` + `page.tsx`; items manuales (`templateKey=null`) excluidos del pairing; locale-scoped delete preserva los del otro locale; UI `LocaleSwitcherClient` + banner de missing translations.
- ✅ **11C** `feat/assistant-retrieval-pipeline` — pipeline RAG completo: pgvector(512) + `bm25_tsv` GIN + Voyage `voyage-3-lite` embeddings (docs/query, L2-norm) + Postgres FTS BM25 + Reciprocal Rank Fusion (k=60) + Cohere `rerank-multilingual-v3.0` con floor 0.3 + Claude Sonnet 4.6 synthesizer (ASSISTANT_LLM_MODEL) con mandatory-citation rule + ESCALATE sentinel + `<source id=N>` injection hardening + Haiku 4.5 intent resolver (pinned) con threshold 0.7 + heuristic fallback + invalidación incremental (`upsertChunksIncremental` por `entityType|entityId|templateKey`, preserva embeddings cuando `contentHash` no cambia) + backfill idempotente (`src/lib/jobs/knowledge-embed-backfill.ts`) + endpoints `POST /assistant/ask` y `POST /assistant/debug/retrieve` + persistence `AssistantConversation + AssistantMessage($transaction)`. Sin ANN index (scope pequeño por property+locale+vis). Dev/test degrade silencioso, prod fail-fast sin keys. Visibility invariant enforced (`sensitive` NEVER in allowed list).
- ✅ **11D** `feat/assistant-escalation` — el pipeline solo resuelve contacto cuando `synthesized.escalated === true` (nunca threshold-based). Heurística pura `resolveEscalationIntent` (ES/EN, accent-strip NFD, longest-match, emergency precedence) + precision gate ≥0.95 + 100% recall por intent crítico sobre corpus de 53 rows → classifier LLM diferido a 11E. `resolveEscalation` con cascada 3-tier (`intent`/`intent_with_host`/`fallback`), visibility defense-in-depth y channel projection (tel/wa.me/mailto). Propagación end-to-end: pipeline → `AssistantMessage.citationsJson` envelope (sin migración) → `askResponseSchema` (nullable required, Zod) → `<EscalationHandoff>` inline en `AssistantChat` (operator-only; widget huésped en 11F). `taxonomies/escalation_rules.json` como source of truth (loader Zod en boot).
- ✅ **11E** `feat/assistant-evals` — banco 60 fixtures (ES 35 + EN 25) + release gate accuracy ≥0.85 (actual 0.95) + recall@5 ≥0.9 (actual 0.95) + `SemanticBowEmbeddingProvider` determinístico + identity reranker + stub synthesizer + CI job `evals` bloqueante (pgvector/pgvector:pg16, artifacts 14d). PR #72 merged (f5d17b3).
- ✅ **11F** `feat/guide-semantic-search` — PR #73 merged (d92c8e0). Capa 2 complementaria a Fuse (10H): endpoint público `GET /api/g/:slug/search?q=` que delega al hybrid retriever (BM25+vec+RRF k=60) con `audience='guest'` forzado y locale desde `Property.defaultLocale` (invariante duro — nunca desde request). Sin reranker/synthesizer/LLM en el path público; la decisión de no surfacing `sensitive` se apoya en `allowedVisibilitiesFor('guest')` de 11C. Mapping `entityType → sectionId` config-driven (`entityTypes[]` por sección en `taxonomies/guide_sections.json`, chequeo de exhaustividad al boot) + override `journeyStage==='checkout'` → `gs.checkout`. UI minimal: CTA `Búsqueda inteligente` aparece cuando query >4 palabras o Fuse retorna <3 hits (debounce 300ms), Enter sobre 0-hits dispara semantic, lista separada con `Resultados inteligentes` + pista `degraded`. Rate-limit in-memory 10 req/min por slug (bucket pruning + cap 256 slugs); 429 con `Retry-After`. Cache-Control `no-store`. 30 nuevos tests (mapping exhaustivo, visibility invariant, rate-limit, happy path + snippet). PR #73.

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
