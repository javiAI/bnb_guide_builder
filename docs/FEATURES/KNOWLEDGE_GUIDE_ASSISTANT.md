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

**Invalidación** wired en `editor.actions.ts` como fire-and-forget. **Contrato real de 11A**: granularidad `entityType` + `entityId?` — delete-then-reextract por sección completa o entidad concreta. `sourceFields[]` en cada chunk son metadatos de trazabilidad (qué campos de la entidad componen el chunk) y preparación para invalidación fina en 11B, **no** determinan el scope de invalidación en 11A.

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
| **11F — Semantic search** (pendiente) | RAG sobre `KnowledgeItem` + embeddings | 500–2000ms con red | Responde preguntas en lenguaje natural con síntesis y citations | Requiere red, coste por query |

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

## 3. Assistant retrieval

Pipeline:

1. normalize question
2. optional intent resolution
3. candidate retrieval
4. strict visibility and language filters
5. ranking
6. answer synthesis
7. citations
8. confidence gating
9. escalation if needed

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

## 5. Secret exclusion

- secretos fuera del corpus general
- secretos fuera de prompts del assistant salvo flujo interno explícito y autorizado
- si el usuario pide un secreto, responder con fallback seguro
