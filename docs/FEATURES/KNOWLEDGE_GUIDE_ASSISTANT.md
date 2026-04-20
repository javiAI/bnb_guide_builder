# KNOWLEDGE_GUIDE_ASSISTANT_SPEC

## 1. Knowledge model

`KnowledgeItem` es la capa factual reutilizable.

Debe soportar:

- canonical question
- short answer
- detailed answer
- step-by-step guidance
- intent, section, room, device
- visibility
- journey stage
- language
- confidence
- freshness
- citations

### Knowledge extraction (Rama 11A)

`knowledge-extract.service.ts` extrae chunks determinísticos de todas las entidades de la propiedad. Patrón idéntico a `PropertyDerived`: recomputable, fire-and-forget.

**7 extractores**:

- `extractFromProperty` — checkin/checkout times, capacity, overview. Todos `visibility=guest`.
- `extractFromAccess` — unit access, building access (si `hasBuildingAccess=true`), checkin logistics. Usa `buildSafeAccessDescription` que excluye `customDesc` (puede contener PINs); solo labels de taxonomía + `customLabel`. **Limitación conocida de 11A**: `customLabel` es texto libre introducido por el host; si contiene un código de acceso en lugar de un nombre descriptivo, ese código aparecerá en el chunk. La eliminación garantizada de secretos en texto libre requiere una capa de referencias estructuradas (planificada en fases posteriores).
- `extractFromPolicies` — smoking, pets, children, quiet hours. Desde `policiesJson`.
- `extractFromContacts` — un chunk por contacto; hereda `visibility` del contacto fuente.
- `extractFromAmenities` — chunk de existencia (`fact`) + chunk de uso (`procedure`) cuando `guestInstructions` presente. Hereda `visibility` del instance.
- `extractFromSpaces` — un chunk por espacio incluyendo resumen de camas. Hereda `visibility` del space.
- `extractFromSystems` — chunk de descripción (`fact`) + chunk de troubleshooting cuando `opsJson` presente. Hereda `visibility` del system.

**Campos AI pipeline por chunk** (ver `docs/DATA_MODEL.md` § KnowledgeItem):
`chunkType`, `entityType`, `entityId`, `contextPrefix` (5 líneas Contextual Retrieval), `bm25Text` (diacríticas plegadas + lowercase + stopwords), `canonicalQuestion`, `contentHash`, `sourceFields[]`, `tags[]`, `tokens`, `validFrom`, `validTo`.

**Invalidación** wired en `editor.actions.ts` como fire-and-forget. **Contrato real de 11A**: granularidad `entityType` + `entityId?` — delete-then-reextract por sección completa o entidad concreta. `sourceFields[]` en cada chunk son metadatos de trazabilidad.

### i18n (Rama 11B)

`KnowledgeItem.locale`, `KnowledgeItem.templateKey` y `Property.defaultLocale` (`@default("es")`) son los tres pilares.

**Locales soportados**: `SUPPORTED_LOCALES = ["es", "en"] as const`. `isSupportedLocale(value)` es el type guard centralizado — cualquier entrada de usuario (action FormData, `searchParams.locale`) pasa por él. Locale desconocido → `regenerateLocaleAction` responde error friendly; `page.tsx` clampa al `defaultLocale` para no dejar la UI en estado incoherente.

**Identidad cross-locale**: los chunks autoextracted se emparejan por `(propertyId, entityType, entityId, templateKey)` — nunca por `id + locale` (el id es per-row, cambia en cada re-extract). `templateKey String?` es la clave semántica estable del chunk; NOT NULL en autoextract, NULL en items manuales. Un mismo `templateKey` identifica "el mismo chunk" en cualquier locale. Index: `@@index([propertyId, entityType, entityId, templateKey, locale])`.

**Valores de `templateKey`** (9 fijos):

Los valores concretos de `templateKey` son los literales `templateKey: "..."` emitidos por `knowledge-extract.service.ts` (por ejemplo `overview`, `checkin_time`, `checkout_time`, `capacity`, `checkin_logistics`, `unit_access`, `building_access`, `pets`, `smoking`, `children`, `quiet_hours`, `contact_info`, `amenity_existence`, `amenity_usage`, `space_info`, `system_info`, `system_troubleshooting`). El código es la fuente canónica — no mantener lista exhaustiva aquí (se desincroniza en cada rama que añada chunks).

**Extracción locale-scoped**: `extractFromPropertyAll(propertyId, locale)` y `upsertSection` eliminan solo ítems con `{ propertyId, locale, isAutoExtracted: true }` — extraer EN nunca borra ítems ES ni manuales.

**Localización real**: los 4 extractores inline (`contacts`, `amenities`, `spaces`, `systems`) ramifican `topic` y `bodyMd` por locale — nunca emiten strings ES cuando `locale="en"`. Los template-based (`property`, `access`, `policy`) consumen `knowledge_templates.json` que ya tiene variantes `es`/`en`. El top-level del JSON es `"defaultLocale": "es"` (describe el fallback por defecto de los templates, no un locale único).

**Fallback policy**:

- `getItemForLocale(itemId, locale, fallbackLocale)` — resuelve por identidad semántica. Si `source.locale === locale` devuelve el source. Si `source.templateKey === null` (manual) y el locale difiere, devuelve `null` (los manuales no tienen grafo cross-locale). Si no, busca sibling por `(propertyId, entityType, entityId, templateKey, locale)`; si no existe, cae al mismo identity con `fallbackLocale` anotando `_fallbackFrom`.
- `listMissingTranslations(propertyId, defaultLocale, targetLocales)` — match por `(entityType, entityId, templateKey, locale)`; filtra `templateKey: { not: null }` en ambas queries para excluir items manuales. Emite `MissingTranslation` con `templateKey` para que el caller pueda regenerar quirúrgicamente.

**`knowledge-i18n.service` — API pública**:

- `SUPPORTED_LOCALES`, `isSupportedLocale()`
- `getItemForLocale`, `listMissingTranslations`, `getLocaleStatusForProperty`, `extractI18n`

**UI**: `LocaleSwitcherClient` navega vía `router.push(pathname?locale=X)` para que el Server Component lea el locale desde `searchParams`. Tabs con dot de estado (naranja=missing, verde=present). Banner de warning cuando `nonDefaultMissing.length > 0`. Formulario "Añadir item" solo visible en `defaultLocale`.

**Creación de items manuales**: `createKnowledgeItemAction` lee `property.defaultLocale` desde la DB y lo persiste explícitamente en el nuevo `KnowledgeItem.locale`. **No se confía en el default de columna** (`@default("es")`) — si el host tiene la property en `en`, un item manual creado en la UI aterriza en `en`. Ningún valor de `locale` enviado por el cliente es honrado: el servidor es la autoridad. El formulario (`CreateKnowledgeItemForm`) solo aparece cuando `activeLocale === defaultLocale`, pero la regla dura vive en el action.

**Limitación MVP**: `invalidateKnowledgeInBackground` solo re-extrae el `defaultLocale`; los locales no-default se vuelven stale si el host edita la propiedad sin regenerar manualmente (acción explícita con botón "Generar" en la pestaña del locale).

- Mutaciones de propiedad/access/policies → `invalidateKnowledgeInBackground(propertyId, entityType, null)` (borra y re-extrae todos los chunks del entityType)
- Create/update de contacto/amenity/space/system → `invalidateKnowledgeInBackground(propertyId, entityType, entityId)` (borra y re-extrae solo los chunks de ese entityId)
- Delete de contacto/system → `deleteEntityChunksInBackground(propertyId, entityType, entityId)` (solo borra, no re-extrae)

**Visibilidad**: `sensitive` excluida en la query. Nunca hay escalación — cada chunk hereda exactamente la visibilidad de su entidad fuente. `assertVisibilityBound` lanza si se viola la invariante.

**Taxonomías**:

- `taxonomies/chunk_types.json` — 7 tipos de chunk con descripción y rango de palabras objetivo
- `taxonomies/knowledge_templates.json` — plantillas de extracción **activamente consumidas** por `renderKnowledgeTemplate()` en los extractores `property`, `access` y `policy`. Los extractores `contacts`, `amenities`, `spaces` y `systems` usan las plantillas como contrato de referencia; la integración completa se consolida en 11B.

## 2. Guide generation

`GuideVersion` se compone desde conocimiento elegible.

Reglas:

- nunca mezclar visibilidades incorrectas
- secciones ordenadas por key y sortOrder
- publish crea snapshot, no overwrite destructivo

### Publishing workflow (Rama 9C)

Publicar congela el `GuideTree` live en un `GuideVersion.treeJson` inmutable:

- **Publish**: `composeGuide(propertyId, "internal")` → serializa como `treeJson` en nueva `GuideVersion` con `status="published"`. Versiones previas se archivan (`status="archived"`).
- **Unpublish**: marca la versión publicada como `archived`.
- **Rollback**: crea una nueva versión (N+1) con el `treeJson` de una versión archivada anterior. Historial lineal, nunca se reescribe.
- **Diff**: `computeGuideDiff(oldTree, newTree)` calcula diferencias on-the-fly entre la versión publicada y el árbol live (secciones/items añadidos, eliminados, modificados).
- **Snapshot único**: audience=internal captura todo; el filtrado por audience aplica al renderizar, no al publicar.
- Los modelos `GuideSection` y `GuideSectionItem` fueron deprecados — `treeJson` es la única fuente de verdad para versiones publicadas.

### Presentation layer (Rama 10F)

A partir de 10F, el pipeline canónico de composición es:

```text
composeGuide(propertyId, audience, publicSlug)
  → filterByAudience(tree, audience)
  → normalizeGuideForPresentation(tree, audience)
  → render (json | md | html | pdf | React)
```

`normalizeGuideForPresentation` es un paso **terminal y puro**: convierte el modelo interno (`value`, `fields`, enums, JSON crudo) en shape de presentación (`displayValue`, `displayFields`, `presentationType`) aplicando `presenter-registry.ts`. Los renderers (markdown, HTML, PDF, React) consumen `displayValue` / `displayFields`; no conocen taxonomías. Sin este paso, raw JSON o enums internos pueden cruzar a `audience=guest`. Ver [ARCHITECTURE_OVERVIEW.md §13](../ARCHITECTURE_OVERVIEW.md) y [CONFIG_DRIVEN_SYSTEM.md §8](../CONFIG_DRIVEN_SYSTEM.md).

`GUIDE_TREE_SCHEMA_VERSION = 3` a partir de 10F. Snapshots pre-v3 se normalizan al servir con log `snapshotPreV3`; no hay rewrite masivo.

### Client search (Rama 10H)

La guía pública expone un buscador *instant*, offline-first, sobre el `GuideTree` guest ya normalizado. No interactúa con el pipeline de retrieval del asistente — son dos capas de descubrimiento con tradeoffs distintos:

| Capa | Implementación | Latencia | Ventaja | Limitación |
| --- | --- | --- | --- | --- |
| **10H — Client search** | Fuse.js embebido (`src/components/public-guide/guide-search.tsx`) sobre un index JSON emitido en RSC | p95 <20ms, sin red | Funciona sin conexión, cero round-trip, fuzzy por sinónimos manuales | Sin comprensión semántica, solo label/snippet/keywords |
| **11F — Semantic search** | `GET /api/g/:slug/search?q=` → `hybridRetrieve` (BM25+vec+RRF k=60) del pipeline 11C con `audience='guest'` forzado + `locale = Property.defaultLocale` | 300–1200ms con red | Entiende intención (`"cómo llego"` → arrival), cubre lenguaje natural largo | Requiere red, rate-limit 10 req/min/slug, sin síntesis LLM ni citations (payload son pointers) |

#### Semantic search (11F) — detalle

El path público **no incluye reranker ni synthesizer** — es pura retrieval con mapeo a secciones. El reranker de Cohere y el synthesizer de Claude siguen scoped al path operator del asistente (11C/11G) porque tienen coste/latency que el huésped no paga.

**Invariantes duros** (enforced por `src/test/guide-search-visibility.test.ts`):

- `audience` nunca se lee del request — `guideSemanticSearch` lo fuerza a `"guest"`.
- `locale` viene de `Property.defaultLocale`, nunca del cliente.
- `allowedVisibilitiesFor("guest")` del retriever (11C) nunca retorna `sensitive` — la defensa principal está en el retriever; el servicio no re-checkea, confía por contrato.

**Mapping entityType → sectionId**: config-driven en `taxonomies/guide_sections.json` (`entityTypes[]` por sección no-aggregator). `src/lib/taxonomy-loader.ts` valida la exhaustividad sobre `ENTITY_TYPES` al boot: añadir un nuevo tipo sin reclamarlo = throw en arranque. Override único: `journeyStage === "checkout"` re-homa cualquier hit a `gs.checkout` (un policy de checkout no va bajo Normas). Aggregators (ej. `gs.essentials`) se saltan para que el anchor apunte a la home canónica.

**Anchor resolution**: `item-<entityId>` si existe (scroll al item específico), `section-<sectionId>` si no (scroll a la sección completa). Los anchors coinciden con los IDs del DOM emitidos por `GuideRenderer`.

**Disparador UX** (en `guide-search.tsx`): la CTA "Búsqueda inteligente" aparece cuando `query >4 palabras` **O** Fuse retorna `<3 hits`, con debounce de 300ms para evitar flashing. Con 0 hits de Fuse, Enter dispara semantic. Enter sobre ≥1 hit sigue navegando al primer resultado Fuse (nunca hace fetch silencioso).

**Rate-limit**: in-memory Map<slug, ring-buffer>, 10 req/min. Pruning de buckets vacíos con cap 256 slugs activos — impide crecimiento unbounded ante un crawler. Respuesta 429 con `Retry-After` + `retryAfterSeconds` en body. El contador se scope al slug, no a IP — para MVP single-region es suficiente; multi-region requiere Redis.

**Upgrade path a multi-region**: cuando el public guide se despliegue en >1 proceso/región, reemplazar `rateBuckets` (Map) por un cliente Redis (`@upstash/ratelimit` o similar). El contrato del servicio (`{kind:'rate-limited', retryAfterSeconds}`) no cambia; swap al nivel de implementación.

**Invariante**: el index se construye en server (`src/lib/services/guide-search-index.service.ts`) **después** de `filterByAudience("guest")` + `normalizeGuideForPresentation("guest")`. Cada entry deriva exclusivamente de `displayValue` / `displayFields[].displayValue` — nunca de `value`/`fields` raw. Items con `presentationType === "raw"` se descartan en `filterRenderableItems`. Un hit no puede exponer texto que no haya pasado por el normalizador.

**Shape del index** (`src/lib/types/guide-search-hit.ts`):

- `GuideSearchEntry`: `{ id, anchor, sectionId, sectionLabel, label, snippet, keywords }`. `id` estable (`item-<id>` para top-level, `child-<parentId>-<idx>` para children flatten). `anchor` apunta al `id` del DOM (`item-<id>` o `item-<parentId>--child-<idx>` en `GuideItem`).
- `GuideSearchIndex`: `{ buildVersion, entries }`. `buildVersion` es un SHA-1 truncado a 12 chars sobre `propertyId | generatedAt | entries.length` + cada entry serializada como `id | label | snippet | keywords` — el contenido entra en el hash, no solo los ids, para que 10I invalide cuando un label/snippet/keyword cambia aunque los ids se mantengan.
- **Dedupe aggregator**: items duplicados entre una sección aggregator (ej. `gs.essentials` hero) y su sección canónica (ej. `gs.amenities`) se colapsan; el anchor del hit apunta siempre a la sección canónica ("anchor goes home, not to hero").

**Fuse options** (congeladas en Fase -1, 2026-04-17, en `src/lib/client/guide-search-index.ts`):

- `threshold: 0.35`, `ignoreDiacritics: true`, `ignoreLocation: true`, `minMatchCharLength: 2`.
- Weighted keys: `label ×2`, `snippet ×1.5`, `keywords ×1`.
- `keywords` concatena label + snippet + `guide_sections.json → searchableKeywords[]` (sinónimos manuales por sección: `wifi/wi-fi/internet/contraseña`, `parking/aparcamiento`, etc.).

**UX/A11y**:

- Trigger en el slot del header (`min-height: 44px`, pill), `/` abre, `Escape` cierra, `Enter` navega al primer hit, `ArrowUp/Down` mueven selección. Radix Dialog con focus trap nativo.
- Combobox + listbox + option ARIA pattern. `aria-activedescendant` en el input para soporte de lectores de pantalla sin mover foco del caret.
- Zero-result hint con `role="status"` + log `search-miss` (debounce 600ms) vía `src/lib/client/guide-analytics.ts` — shim con surface estable que un futuro wiring GA/PostHog cambia en un solo archivo.
- Axe-core `serious|critical = 0` enforced por `e2e/guide-search.spec.ts` en los 4 proyectos Playwright (375/768/1280 + iPhone 13). Los tokens del dialog se rebindean sobre `.guide-search__dialog` porque Radix portaliza a `body`, fuera del scope de `.guide-root`.

### Offline strategy (Rama 10I)

La guía pública se sirve como PWA instalable con caché offline en tres tiers. La capa es **transparente al modelo de render**: lo que el huésped ve online y offline es exactamente lo mismo (composeGuide → filterByAudience → normalize → render). El SW no transforma — solo replays.

**Tiers (declarados en `taxonomies/guide_sections.json` vía `offlineCacheTier`)**:

| Tier | Secciones | Estrategia | Disponibilidad offline |
|---|---|---|---|
| 1 — esenciales | `gs.essentials`, `gs.arrival`, `gs.checkout`, `gs.emergency` | Precache en `install` (HTML root + `/offline` + manifest) + SWR para HTML + cache-first para Next static/iconos/manifest | Garantizada offline |
| 2 — media thumbs | thumbnails de `/g/<slug>/media/.../thumb` | SWR con cap (`TIER2_MAX_ENTRIES = 12`); LRU eviction al insertar la 13 | Best-effort: thumbs vistas recientemente |
| 3 — media md/full | resoluciones grandes | Network-first con timeout 2s; fallback al cache si existe | No es objetivo offline |

**Versionado**: el SW lleva `__SW_VERSION__` = `GuideSearchIndex.buildVersion` (rama 10H). Mismo hash determinístico = mismo SW byte-a-byte; cualquier cambio en label/snippet/keyword/id flipea el hash y el browser dispara `update`. `Cache-Control: no-cache` en el route handler garantiza el refetch en cada navegación. Rollback/unpublish reemiten el SW con el hash anterior.

**Aislamiento per-slug**: `src/app/g/[slug]/sw.js/route.ts` sirve un SW dinámico con scope `/g/<slug>/`. No hay `public/sw.js` global (riesgo de scope `/`). Cache names llevan el slug en namespace (`guide-<slug>-tier{1,2,3}-<version>`), así dos guías instaladas en el mismo origen no se contaminan.

**Manifest dinámico**: `src/app/g/[slug]/manifest.webmanifest/route.ts` resuelve `propertyNickname` + `brandPaletteKey` y delega en `buildGuidePwaManifest()`. `theme_color` = `getBrandPair(brandPaletteKey).light`. iOS captura el `theme_color` al instalar; un cambio posterior solo se refleja al re-instalar (importante para Liora — replatform de paleta requiere comunicación a hosts con guías ya instaladas).

**Install nudge** (`src/components/public-guide/install-nudge.tsx`): aparece tras `visits >= 2` o `cumulativeMs >= 90s`. Chromium/Edge/Android usan `beforeinstallprompt`. iOS Safari (sin evento) abre panel manual con instrucciones del share sheet. `localStorage` per-slug (`guide-install-nudge:<slug>`) silencia el nudge tras `dismissedAt` o `installedAt`. Componente y CSS están intencionalmente neutros — el comportamiento es load-bearing y no se renegocia en Liora; el skin se reescribe sobre los selectors `guide-install-nudge*` ya enumerados en `guide.css`.

**Offline page** (`src/app/g/[slug]/offline/page.tsx`): shell estático precached al install, devuelto por `handleNavigation()` cuando red + cache fallan.

**Tests**: 5 invariantes en vitest (manifest shape, SW template substitution, precache asset existence, sección coverage de tier, install nudge threshold/persistencia) + 1 spec E2E fuerte (`e2e/guide-pwa-offline.spec.ts`) que cubre HTTP de manifest/sw/offline + DOM del nudge + axe-core sobre el nudge montado. SW lifecycle real (install/fetch/offline replay) deliberadamente no se testea en headless — flake típico; las unit tests cubren la fuente del template y los handlers.

**Comparativa con 10H (client search) y 11F (semantic retrieval futuro)**:

| Capa | Cobertura offline | Latencia | Trigger |
|---|---|---|---|
| 10H — fuzzy search | Total — el index entero embebe el snapshot | <20ms p95, todo client-side | `/` o tap en el botón de búsqueda |
| 10I — PWA shell + media | Tier 1 garantizado, tier 2 best-effort, tier 3 nunca | 0ms del SW (cache hit), red en background | Navegación dentro del scope `/g/<slug>/` |
| 11F — semantic retrieval (futuro) | **Solo online** — embeddings + LLM requieren red | Variable, depende del modelo | Miss en 10H + red disponible |

10I no asume 11F y viceversa. 10H y 10I se reforzaron mutuamente: el `buildVersion` del index actúa de cache-key para el SW.

### Output formats (Rama 9B)

El `GuideTree` devuelto por `composeGuide(propertyId, audience, publicSlug)` (ver `src/lib/services/guide-rendering.service.ts`) se expone en cuatro formatos vía `GET /api/properties/:id/guide?audience&format`:

| Format | Content-Type | Renderer | Uso |
|---|---|---|---|
| `json` | `application/json` | — (tree directo) | Consumo programático (asistente, exports) |
| `md` | `text/markdown; charset=utf-8` | `src/lib/renderers/guide-markdown.ts` | Publicable en Notion/GitHub/mensajería |
| `html` | `text/html; charset=utf-8` | `src/lib/renderers/guide-html.ts` | Embed en emails/preview — escape manual de `&<>"'`, URLs de media restringidas a `https?://` y `data:image/` |
| `pdf` | `application/pdf` (attachment) | `src/lib/renderers/guide-pdf.tsx` via `@react-pdf/renderer` | Descarga directa desde el preview |

Todos los formatos incluyen `generatedAt` (ISO) para auditoría. El filtrado por audience aplica tanto a items como a fields (ver `src/lib/visibility.ts`); `sensitive` nunca se emite.

## 3. Assistant retrieval (Rama 11C)

El pipeline RAG vive en [src/lib/services/assistant/](../../src/lib/services/assistant/) y se consume desde dos endpoints:

- `POST /api/properties/:id/assistant/ask` — público, responde con citations
- `POST /api/properties/:id/assistant/debug/retrieve` — interno, ops/ajuste

Orquestador: [pipeline.ts](../../src/lib/services/assistant/pipeline.ts) (`ask(input)` y `retrieve(input)`).

**Flujo `ask()`**:

```text
intent resolution (Haiku 4.5 → heuristic fallback)
  → hybrid retrieval (BM25 + vector, RRF fusion)
  → reranker (Cohere multilingual-v3.0 → identity fallback)
  → floor @ rerankScore ≥ 0.3
  → synthesizer (Claude Sonnet 4.6, ASSISTANT_LLM_MODEL) with <source id=N> wrapping
  → parse [N] citations, enforce mandatory-citation rule
  → persist AssistantConversation + 2 AssistantMessage rows
```

### Embeddings — Voyage `voyage-3-lite` (512-d)

- Provider: [embeddings.service.ts](../../src/lib/services/assistant/embeddings.service.ts)
- Input/output: API signature `embed(texts, { inputType })`; `document` en backfill, `query` en runtime
- Normalización: L2 antes de escribir al `vector(512)` de Postgres (se apoya en distancia coseno)
- Dev/test fallback: mock determinístico basado en hash. Prod falla rápido si falta `VOYAGE_API_KEY`.

### Retriever híbrido BM25 + vector + RRF

- [retriever.ts](../../src/lib/services/assistant/retriever.ts); RRF k=60, `CANDIDATE_LIMIT=100` por canal, topK del pipeline = 20
- Hard filters pushdown (SQL): `propertyId`, `locale`, `visibility::text = ANY($allowed)`, `valid_from/valid_to`, `journey_stage` opcional
- `allowedVisibilitiesFor(audience)` NUNCA incluye `sensitive` — invariante enforced
- BM25 channel: `ts_rank("bm25_tsv", to_tsquery('simple', $query))` sobre columna generated + GIN (ver `prisma/migrations/.../knowledge_embeddings_and_fts`)
- Vector channel: `1 - ("embedding" <=> $vec::vector)` con cosine distance sobre pgvector. Sin índice ANN en MVP — el scope efectivo por `propertyId + locale + visibility` es pequeño y el lineal es más barato que mantener ivfflat/HNSW
- Modo degraded: si <10% del scope tiene embedding, salta el canal vector y marca `degraded: true` para que el caller muestre "still indexing"

### Reranker — Cohere `rerank-multilingual-v3.0`

- [reranker.ts](../../src/lib/services/assistant/reranker.ts); top N = 5 tras rerank
- Documento para rerank = `contextPrefix + "\n" + bodyMd` (mismo signal que el retriever rankeó)
- Retry exponencial en 408/429/5xx. Identity fallback solo dev/test. Prod requiere `COHERE_API_KEY`.

### Synthesizer — Claude Sonnet 4.6 (configurable)

- [synthesizer.ts](../../src/lib/services/assistant/synthesizer.ts); modelo vía `ASSISTANT_LLM_MODEL` (default `claude-sonnet-4-6`)
- Mandatory citation rule: cada afirmación factual referencia `[N]`; si el modelo no cita, el parser escala automáticamente
- Escalation sentinel: respuesta que empiece por `ESCALATE:` se convierte en `{ escalated: true, escalationReason }` y no llega al huésped
- Prompt-injection defenses:
  - system prompt + `<source id="N" entityType topic>` wrapping → modelo trata fuentes como datos
  - `sanitizeSourceText()` flatten de headers `system:/assistant:/user:` + `ignore (all|previous) ...` hasta boundary de frase, strip de role tags `<system>/<user>/...`, `` ``` `` → `` `` ``
  - `sanitizeUserQuestion()` strip de `<user_question>` en la pregunta para que el atacante no cierre el tag desde fuera
- Output JSON estricto: `{ answer, citations: Citation[], escalated, escalationReason, confidenceScore }`. `Citation = { knowledgeItemId, sourceType, entityLabel, score }`.

### Intent resolver — Claude Haiku 4.5 (pinned)

- [intent-resolver.ts](../../src/lib/services/assistant/intent-resolver.ts); `claude-haiku-4-5-20251001` (NO configurable)
- Clasifica a un `JourneyStage` con confianza [0,1]
- Threshold: solo se pushea al retriever como hard-filter si `confidence ≥ 0.7` y `stage !== "any"`; si no, se deja scope abierto
- Fallback: heuristic keyword-based cuando `ANTHROPIC_API_KEY` está ausente o la llamada falla (estabilidad sobre precisión: una mala clasificación > pipeline bloqueado)

### Persistence

`persistConversation()` crea una `AssistantConversation` si no llega `conversationId`, y escribe los 2 `AssistantMessage` en `$transaction`. `citationsJson` carga un envelope `{ citations, escalationReason }` — no hay columna dedicada de escalationReason, evita migración.

### Tunables (en pipeline)

`RERANK_TOP_N=5`, `RERANK_FLOOR=0.3`, `INTENT_CONFIDENCE_THRESHOLD=0.7`, `RETRIEVER_TOP_K=20`.

### Backfill y rebuild

- Job determinístico: [src/lib/jobs/knowledge-embed-backfill.ts](../../src/lib/jobs/knowledge-embed-backfill.ts). Args: `--property=<id>`, `--batch=<n>`, `--dry-run`
- Idempotente: selecciona solo rows con `embedding IS NULL`, o con `embedding_model` distinto del `modelId` del provider, o con `embedding_version` distinta de la versión del provider
- Invalidación incremental: `upsertChunksIncremental({propertyId, locale, isAutoExtracted: true}, chunks)` en `knowledge-extract.service.ts` clasifica chunks en delete/create/update por `(entityType|entityId|templateKey)` y nulifica `embedding + embedding_model` solo cuando `contentHash` cambia. Resultado: preservación de embeddings en ediciones sin impacto semántico.

### Test matrix

- `assistant-embeddings-provider.test.ts` — determinismo, L2 norm, prod guard
- `assistant-retriever-internals.test.ts` — invariante de visibility (sensitive NUNCA), tsquery sanitizer, RRF fusion
- `assistant-reranker-fallback.test.ts` — identity orden y scaling, topN cap, prod guard
- `assistant-synthesizer-parsing.test.ts` — ESCALATE, no-citations, citation extraction/dedupe, sanitizer regex
- `assistant-intent-resolver.test.ts` — JSON robust parsing, clamp confianza, heurística por stage
- `assistant-pipeline.test.ts` — escalation paths, persistence, reranker floor, intent threshold pushdown, debug shape
- `knowledge-contextual-prefix.test.ts` — 5-line contextual prefix, stopwords bilingüe, contentHash determinismo

## 4. Conversation persistence

Las conversaciones del assistant deben persistirse por:

- `propertyId`
- `actorType`
- `audience`
- `language`

Los mensajes guardan:

- role
- body
- citationsJson
- confidenceScore
- escalated

## 5. Escalation (rama 11D)

Cuando el synthesizer decide `escalated: true` (sentinel `ESCALATE:` o ausencia de `[N]` refs), el pipeline NO inventa respuesta. En lugar de eso resuelve un contacto estructurado y lo propaga al caller para renderizarlo junto al turno del assistant.

### Trigger

- **Exclusivo**: `synthesized.escalated === true`. No hay threshold sobre `confidenceScore` ni sobre `citations.length` — la decisión vive en el synthesizer (mandatory-citation rule + sentinel) y `resolveEscalationContact()` solo actúa si esa señal está encendida.
- **Happy path**: `ask()` nunca toca `prisma.contact.findMany` cuando la respuesta es válida. Guard verificado por `src/test/assistant-pipeline.test.ts` ("escalationContact is null on the happy path").

### Intent resolution — heurística pura

- [escalation-intent.ts](../../src/lib/services/assistant/escalation-intent.ts): `resolveEscalationIntent({ question, lang })` → `EscalationIntentMatch { intentId, confidence, ... }`. Accent-strip NFD + lowercase, match por keywords ES/EN desde `taxonomies/escalation_rules.json`, longest-match tiebreak, emergency precedence absoluta sobre non-emergency.
- Confidence tiers: `emergency: 0.9`, `nonEmergency: 0.75`, `fallback: 0.25` (sin match). El fallback mapea a `int.general` → contacto general_host.
- **Precision gate**: [assistant-escalation-intent-precision.test.ts](../../src/test/assistant-escalation-intent-precision.test.ts) corre un corpus labeled ([escalation-intent-corpus.ts](../../src/test/fixtures/escalation-intent-corpus.ts), 53 rows + `CRITICAL_INTENTS`) y exige `precision ≥ 0.95` + `recall = 1.0` + ≥5 rows por intent crítico. Añadir un intent nuevo = (a) entry en `escalation_rules.json` con `keywords.{es,en}[]`, (b) ≥5 rows etiquetados en el corpus, (c) tests verdes.
- **Classifier LLM diferido más allá de 11E**: la heurística cubre los 4 intents críticos con precision ≥0.95 + recall 1.0; Haiku classifier como fallback queda parked en rama dedicada posterior. Se reabre (con su propia Fase -1) cuando aparezca un corpus de intents que la heurística no resuelva — no se prioriza mientras el gate de 11E pase con holgura.

### Contact resolution — 3-tier cascade

- [escalation.service.ts](../../src/lib/services/assistant/escalation.service.ts): `resolveEscalation({ propertyId, intentId, audience })` → `EscalationResolution | null`.
- Tiers:
  1. **`intent`** — hay contacto con `roleKey` (`ct.*`) que matchea `contactRoles[]` del intent en `escalation_rules.json`.
  2. **`intent_with_host`** — no hay contacto específico; se deriva al `ct.host` (general_host). Copy al huésped: "derivando al anfitrión".
  3. **`fallback`** — ni específico ni host disponibles; el caller decide si suprime o muestra un aviso neutro. Por ahora siempre existe host si existe al menos un contact.
- Orden determinístico: `prisma.orderBy = [{emergencyAvailable:"desc"},{isPrimary:"desc"},{sortOrder:"asc"},{createdAt:"asc"}]`.
- Visibility defense-in-depth: aunque el retriever ya clampa audience, el service re-filtra contacts por `visibility` (el caller puede venir de un path que no pase por retriever).
- Channel projection por contact:
  - `phone` → `{ kind: "tel", rawValue, href: "tel:+..." }`
  - `whatsapp` → `{ kind: "whatsapp", rawValue, href: "https://wa.me/..." }`; si no hay `whatsapp` pero sí `phone`, se infiere.
  - `email` → `{ kind: "email", rawValue, href: "mailto:..." }`
- `emergencyPriority: boolean` en la resolution = `intent` declara `emergency: true` en la taxonomía.

### Escalation persistence

- **Sin migración**. `AssistantMessage.citationsJson` se extiende con `escalationContact: EscalationResolution | null`, conviviendo con `{ citations, escalationReason }`. El parser del caller conoce el envelope completo.

### API contract

- `POST /api/properties/:id/assistant/ask` responde `{ data: { ..., escalationContact: EscalationResolution | null } }`. Field **required** en `askResponseSchema` (nullable) — un server que olvide serializarlo falla Zod validation. Ver [assistant-schema-escalation.test.ts](../../src/test/assistant-schema-escalation.test.ts).

### UI — operator dashboard

- [EscalationHandoff.tsx](../../src/components/assistant/EscalationHandoff.tsx): card inline renderizada en el turno escalado del assistant dentro de `AssistantChat`. Banner `Emergencia` / `Contacto` según `emergencyPriority`, intent label, fallback-level copy, ranked contacts con tap-to-call/WhatsApp/email (targets ≥44×44).
- Audience de 11D: **operator-only**. El widget huésped equivalente se entrega en 11F (`feat/guide-semantic-search` + widget público).

### Test matrix (11D)

- `assistant-escalation-intent.test.ts` (53 casos) — resolución por keyword, accent strip, precedence emergency > nonEmergency, language scoping.
- `assistant-escalation-intent-precision.test.ts` (9) — precision ≥ 0.95 + recall 1.0 por intent crítico.
- `assistant-escalation-service.test.ts` (15) — cascada de tiers, orden, visibility filter, channel projection, fallback con host.
- `assistant-schema-escalation.test.ts` (5) — Zod shape del envelope + rechazo de `fallbackLevel` / `channel.kind` desconocidos.
- `escalation-handoff.test.tsx` (6) — banner variants, hrefs, target size, empty contacts, Principal/24/7 badges.
- `assistant-pipeline.test.ts` — el happy path no llama `prisma.contact.findMany`; el escalated path produce `escalationContact` poblado.

## 6. Evals & release gate (rama 11E)

Release gate determinístico que valida end-to-end el pipeline RAG. Bloquea merges a `main` en cada PR desde el job `evals` de [.github/workflows/ci.yml](../../.github/workflows/ci.yml).

### Fixture bank

- [src/test/assistant-evals/fixtures.json](../../src/test/assistant-evals/fixtures.json): 60 fixtures etiquetados (ES 35 + EN 25) sobre 2 properties sintéticas + 57 `KnowledgeItem` hand-written en [knowledge-items-corpus.ts](../../src/test/assistant-evals/knowledge-items-corpus.ts). Bodies deliberadamente tight para que las citations esperadas sean estables bajo el stub synthesizer.
- Cada fixture declara: `question`, `language`, `audience`, `expectedFacts[]` (substring case-insensitive) y `expectedItemIds[]` (KI ids esperados en top-5).
- [property-seed.ts](../../src/test/assistant-evals/property-seed.ts) reconstruye las 2 properties + 57 items + chunks + embeddings determinísticos por cada run. Idempotente: `teardownEvalFixtures()` borra workspace/properties/knowledge items del scope eval antes de cada `seedEvalFixtures()`, sin `$transaction` (cada run arranca desde estado limpio, no desde rollback).

### Métricas

- **Accuracy**: cada fact esperado debe aparecer como substring case-insensitive en la respuesta sintetizada. Gate ≥ 0.85.
- **Recall@5**: `|expected_items ∩ top_5_citations| / |expected_items|`. El pipeline ya cappea en `RERANK_TOP_N = 5`. Gate ≥ 0.9.
- Actual: 95% accuracy + 95% recall@5 con holgura sobre ambos umbrales.

### Determinismo — resolvers pineados

Los 4 resolvers del pipeline se pinean a stubs vía `__set*ForTests` antes del run ([runner.ts](../../src/test/assistant-evals/runner.ts)):

- **Embeddings** → [SemanticBowEmbeddingProvider](../../src/test/assistant-evals/semantic-embeddings.ts): token-level BoW 512-d, stopword-filtered ES+EN, SHA-256 fold + L2-norm. Mismo input → mismo vector bit-exact, sin red.
- **Reranker** → identity pass-through (preserva el orden RRF, escala a `[0,1]`).
- **Synthesizer** → stub que concatena top-3 bodies truncados + `[N]` citations. Determinista y cubre accuracy sin tocar Claude.
- **Intent resolver** → heurística pura existente (sin LLM).

El gate NO consume `VOYAGE_API_KEY` / `COHERE_API_KEY` / `ANTHROPIC_API_KEY` — CI queda reproducible y barato. `npm run eval:assistant:refresh` (opcional) repuebla `embeddings-cache.json` con embeddings Voyage reales para un futuro gate de mayor fidelidad, palanca diferida sin consumo actual.

### Comando y artefactos

- `npm run eval:assistant` — corre [release-gate.test.ts](../../src/test/assistant-evals/release-gate.test.ts) via `vitest.evals.config.ts` (excluida del run default). Requiere pgvector local.
- Artifact JSON + markdown en `eval-artifacts/` (`.gitignore` los excluye), subido por el job CI con retención 14 días. Artifact incluye por fixture: question, answer, expected vs actual facts, citations top-5, flag booleano `accuracyPass` y métrica numérica `recallAt5`.

### Scope exclusions

- **Haiku intent classifier**: diferido a rama dedicada posterior (no 11E). Heurística pasa el precision gate; el classifier solo justifica costo cuando aparezca un corpus de intents que la heurística no resuelva.
- **Dashboard UI**: intencionalmente ausente. El artifact JSON + markdown (CI retention 14 días) es el surface completo — fail loud, sin UI que mantener.

## 7. Secret exclusion

- secretos fuera del corpus general
- secretos fuera de prompts del assistant salvo flujo interno explícito y autorizado
- si el usuario pide un secreto, responder con fallback seguro
