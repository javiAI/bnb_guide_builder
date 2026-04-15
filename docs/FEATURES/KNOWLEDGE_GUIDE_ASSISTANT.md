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
