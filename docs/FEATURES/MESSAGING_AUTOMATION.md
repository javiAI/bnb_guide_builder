# MESSAGING_AUTOMATION_SPEC

## 1. Messaging scope

La mensajería tiene tres capas:

1. templates editables
2. automation rules
3. generated drafts / send candidates

## 2. Touchpoints

Los touchpoints canónicos viven en `taxonomies/messaging_touchpoints.json`.

## 3. Template rules

Cada template incluye:

- `touchpointKey`
- `channelKey`
- `language`
- `audience`
- `title`
- `bodyTemplate`
- `variablesJson`
- `status`
- `visibility=internal`

## 4. Automation rules

Cada automation incluye:

- `triggerType`
- `sendOffsetMinutes`
- `timezoneSource`
- `conditionsJson`
- `active`

## 5. Safety rules

- no secrets por defecto
- no enviar booked-guest content a público
- validar variables faltantes
- recalcular drafts si cambian datos críticos

## 5bis. Variables (rama 12A)

Catálogo canónico en `taxonomies/messaging_variables.json` (cargado + validado
con Zod en `src/lib/taxonomy-loader.ts`). Ningún consumidor debe añadir
variables fuera de ese JSON.

Cada item declara:

- `id` (`mv.<token>`) + `variable` (snake_case)
- `label` / `description` / `example` en ES
- `group`: `property` | `contact` | `operations` | `reservation`
- `source`: unión discriminada por `kind`
  - `property_field` (`path` en allowlist: `propertyNickname`, `checkInStart`,
    `checkInEnd`, `checkOutTime`, `city`, `country`, `timezone`,
    `streetAddress`, `maxGuests`, `checkInWindow` virtual)
  - `contact` (`roleKey` + `fallbackRoleKeys[]` + `field` ∈
    `displayName|phone|whatsapp|email`)
  - `knowledge_item` (`topic` ∈ `wifi_name|wifi_password|smoking_policy|`
    `pet_policy|access_instructions|parking_instructions`)
  - `derived` (`derivation: guide_url`)
  - `reservation` — siempre `unresolved_context` en 12A
- `sendPolicy`: `safe_always` | `sensitive_prearrival` | `internal_only`
- `previewBehavior`: `resolve` | `placeholder`

### Estados de resolución

- **resolved** → dato encontrado; el `{{var}}` se sustituye por el valor.
- **missing** → variable conocida, fuente vacía; render `[Falta: Label]`.
- **unresolved_context** → depende de reserva (12B); render `[Label]`.
- **unknown** → token ausente del catálogo; se preserva literal en la salida
  y bloquea guardado con sugerencia Levenshtein (`¿Quisiste decir {{y}}?`).

### Resolución canónica > KnowledgeItem

`knowledge_item` consulta primero el render canónico (wifi desde
`PropertyAmenityInstance.detailsJson`, políticas desde `policiesJson`,
acceso desde `accessMethodsJson`, parking desde `am.parking
guestInstructions`). Si canonical no aporta valor y el topic admite
fallback narrativo, recurre a `KnowledgeItem` más confiable
(visibilidad ≤ internal, orden por `confidenceScore`). `wifi_name`/
`wifi_password` nunca usan fallback narrativo (bodies de KI son prosa).

Nunca se invoca la pipeline de assistant (RAG/reranker/synthesizer).

### Gate de validación

`createMessageTemplateAction` y `updateMessageTemplateAction` llaman a
`checkUnknownVariables(bodyMd)` y devuelven `fieldErrors.bodyMd[]` si
hay tokens desconocidos. `missing` y `unresolved_context` **no bloquean**
— emergen en el preview y al enviar (12B).

### Preview

`previewMessageTemplateAction(propertyId, bodyMd)` corre el resolver con
una sola consulta por propiedad + batches de `Contact`,
`PropertyAmenityInstance` y `KnowledgeItem`. Consumido por el editor
(`src/app/properties/[propertyId]/messaging/[touchpointKey]/`
`message-body-editor.tsx`) con debounce 400 ms.

## 6. Starter packs

Deben derivarse de:

- tone
- arrival strategy
- checkout policy
- review request strategy
- support posture

pero quedar editables después
