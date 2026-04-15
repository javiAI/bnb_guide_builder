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

## 6. Starter packs

Deben derivarse de:

- tone
- arrival strategy
- checkout policy
- review request strategy
- support posture

pero quedar editables después
