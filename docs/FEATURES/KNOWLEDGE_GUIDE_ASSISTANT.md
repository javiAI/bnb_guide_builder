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
