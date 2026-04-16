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

### Output formats (Rama 9B)

El `GuideTree` devuelto por `composeGuide(propertyId, audience)` (ver `src/lib/services/guide-rendering.service.ts`) se expone en cuatro formatos vía `GET /api/properties/:id/guide?audience&format`:

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
