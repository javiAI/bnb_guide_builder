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

## 5ter. Automations + Scheduler + Drafts lifecycle (rama 12B)

### 5ter.1 Triggers (taxonomy)

`taxonomies/messaging_triggers.json` (Zod loader en `src/lib/taxonomy-loader.ts` vía `loadMessagingTriggers()`). Cada entry declara:

- `id` (`before_arrival`, `day_of_checkin`, `after_checkout`, `on_booking_confirmed`)
- `label`, `description` (ES)
- `anchorField`: `"checkIn" | "checkOut" | "bookingConfirmed"` (la DB **no** guarda anchor — la verdad vive en taxonomía)
- `defaultOffsetMinutes`
- `presets: { label, offsetMinutes }[]` — chips sugeridos en la UI

Legacy mapping (sin migración DB): `reservation_relative → before_arrival`, `on_event → on_booking_confirmed`. Aplicado en `src/lib/schemas/messaging.schema.ts` (`normaliseTriggerType`).

### 5ter.2 Automation entity

`MessageAutomation` (Prisma):

- `id`, `propertyId`, `templateId`, `channelKey`, `touchpointKey`
- `triggerType` (ID de la taxonomía tras `normaliseTriggerType`)
- `sendOffsetMinutes: Int`
- `active: boolean`
- `@@index([propertyId])`, `@@index([propertyId, touchpointKey])`

Check-time gate (`createMessageAutomationAction`): si `bodyUsesInternalOnly(template.bodyMd) === true`, se bloquea la creación con error "La plantilla usa variables internas (internal_only) y no puede automatizarse — edítala primero".

### 5ter.3 Materialization contract

`materializeDraftsForReservation(reservationId, { client? }): MaterializeOutcome[]` en `src/lib/services/messaging-automation.service.ts`.

Contrato:

1. Si `reservation.status === "cancelled"` → cancela en cascada drafts `pending_review|approved` y retorna `outcome: "blocked_reservation_cancelled"` para cada una.
2. Lista automations activas del `propertyId` + `triggerType` válido.
3. Para cada automation:
   - `computeScheduledSendAt({trigger, reservation, property, offsetMinutes})` — `fromZonedTime(local, property.timezone)` sobre anchor + offset. DST-aware (`Europe/Madrid` CET/CEST).
   - `resolveVariables(propertyId, template.bodyMd, { reservation })` — las 4 reservation vars suben a `resolved`.
   - Runtime safety para plantillas con `bodyUsesSensitivePrearrival(bodyMd) === true`: ventana permitida `[checkIn − SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS, checkIn)` (actualmente 48 h). Si `scheduledSendAt >= checkIn` **o** `scheduledSendAt < checkIn − 48h` → `outcome: "blocked_sensitive_prearrival"` (no se crea draft). Esto cubre tanto post-llegada (credenciales inútiles después de check-in) como envío demasiado anticipado (p. ej. `wifi_password` 14 días antes queda bloqueado).
   - Upsert por `@@unique([automationId, reservationId])`:
     - No existe → crea `MessageDraft { status: "pending_review", bodyMd: output, scheduledSendAt, resolutionStatesJson }`. Outcome `created`.
     - Existe en `pending_review` y cambian body/scheduledSendAt/resolutionStates → update + lifecycle event. Outcome `updated`.
     - Existe en `pending_review` e inputs idénticos → `unchanged` (no write).
     - Existe en `approved|sent|skipped|cancelled|error` → **nunca** modificar. Outcome `unchanged`.

Idempotencia: dos llamadas consecutivas con los mismos inputs producen `[created, unchanged]`. La tabla `message_drafts` es estable bajo retries del cron.

### 5ter.4 Drafts lifecycle

Estados y transiciones (enforced por `LIFECYCLE_TRANSITIONS` en `messaging-automation.service.ts`):

```text
pending_review ──approve──▶ approved ──mark_sent──▶ sent
       │                        │
       │                        └──cancel──▶ cancelled
       ├──skip────▶ skipped
       ├──discard─▶ cancelled
       └──edit (solo body, permanece en pending_review)
```

`sent` y `skipped` son terminales. `cancelled` es terminal (re-materialización no la revive).

`MessageDraft.lifecycleHistoryJson`: append-only `{ at: ISO, from: status, to: status, actorId?: string, note?: string }[]`. `scheduler` actor = `"scheduler"`; host actions = `req.userId`. Audit log, no rollback.

### 5ter.5 Cancel cascade

`cancelReservationAction` envuelve en `$transaction`:

1. `reservation.update({status: "cancelled"})`
2. `cancelDraftsForReservation(reservationId, {client: tx})` → drafts con `status ∈ {pending_review, approved}` pasan a `cancelled` con evento lifecycle (`actorId: null`, audit-only). `sent` y `skipped` quedan tal cual.

`materializeDraftsForReservation` también detecta `reservation.status === "cancelled"` y cancela en cascada — garantiza consistencia si el cron corre después de un cancel en caliente.

### 5ter.6 Scheduler

`runTick(now, {lookaheadDays?, dispatchLimit?}): TickReport` en `src/lib/services/messaging-scheduler.ts`.

1. `reservationsInWindow = prisma.reservation.findMany({ where: OR: [{checkOutDate >= now}, {checkInDate between [now, now+lookahead]}, {createdAt >= now-24h}], status: "confirmed" })`.
2. Para cada reservation → `materializeDraftsForReservation(id)`. Agrega outcomes.
3. `listDueDrafts(now, {limit})` → `status: "approved" AND scheduledSendAt <= now`.
4. Para cada due draft → `transitionDraftAction(id, "mark_sent", {actorId: "scheduler"})`. NO dispatch real (sin provider). El marcado cierra el ciclo y deja espacio a 12D/E para plugear email/WhatsApp.

Retorna `TickReport { now, materialized: {created, updated, unchanged, blocked_*}, dispatched: number }` — observable vía logs del cron handler.

### 5ter.7 Cron endpoint

`POST /api/cron/messaging` (`src/app/api/cron/messaging/route.ts`):

- `export const dynamic = "force-dynamic"`, `runtime = "nodejs"`.
- Si `process.env.CRON_SECRET` no está definido → `500 { error: "CRON_SECRET not configured" }`.
- Authorization: `Bearer ${CRON_SECRET}` requerido. Mismatch → `401`.
- OK → `runTick()` y retorna `{ ok: true, report }`.

Schedule: `vercel.json` → `{ "crons": [{ "path": "/api/cron/messaging", "schedule": "*/10 * * * *" }] }` (cada 10 min).

Sin BullMQ, sin webhooks, sin host notifications. El cron es el único driver.

### 5ter.8 ReservationContext en el resolver

`resolveVariables(propertyId, body, { reservation?: ReservationContextRow })` — 12A expuso el hook; 12B lo consume. Cuando `reservation` llega:

- `guest_name` → `reservation.guestName` (fallback `[Nombre del huésped]` si null)
- `check_in_date` / `check_out_date` → `Intl.DateTimeFormat(locale, {day:"numeric",month:"long"})` — locale precedence: `reservation.locale || property.defaultLocale || "es"`
- `num_guests` → `reservation.numGuests`

Las 4 pasan de `unresolved_context` a `resolved`. Sin reservation, siguen en `unresolved_context` (placeholder en preview).

## 6. Starter packs (rama 12C)

Catálogo canónico en `taxonomies/messaging_starter_packs.json` (Zod loader en `src/lib/taxonomy-loader.ts`). **6 packs** = 3 tones (`friendly | formal | luxury`) × 2 locales (`es | en`), mono-locale (`language === locale`). Cada pack trae **7 templates** (uno por touchpoint de `messaging_touchpoints.json`) con **automation pre-cableada (`active: false`)** para que el host revise → active.

### 6.1 Shape del pack

- `id` (`msp.<tone>_<locale>`) — identidad única
- `tone`, `locale`, `language`, `description`
- `templates[]` con:
  - `touchpointKey`, `channelKey` (`channel_default` del touchpoint)
  - `subjectLine?`, `bodyTemplate` (tokens `{{...}}` del catálogo 12A)
  - `automation: { triggerType, sendOffsetMinutes }`
  - `overrides?[]` por `appliesToPropertyTypes` con `patch: { subjectLine?, bodyTemplate? }`

Propagación de overrides: al apply/preview se selecciona el **primer** override cuyo `appliesToPropertyTypes` incluya el `property.propertyType`. El resto del template queda intacto (automation, channel). Sin override match → base body.

### 6.2 Invariantes de boot

El Zod validator corre al cargar el JSON y **falla build** si:

- dos packs comparten `(tone, locale)` o `id`
- `language !== locale`
- un `touchpointKey` no existe en `messagingTouchpoints`
- un `triggerType` no existe en `messagingTriggers`
- un `appliesToPropertyTypes` entry no existe en `propertyTypes`
- un `{{token}}` en body/override no existe en `messagingVariables`
- un token con `sendPolicy: "internal_only"` aparece en cualquier body
- un token con `sendPolicy: "sensitive_prearrival"` aparece en un template cuyo **touchpoint ≠ `mtp.day_of_checkin`**, **triggerType ≠ `day_of_checkin`**, o cuyo **offset no esté en `[-2880, 0)`** (= 48 h antes de check-in, nunca igual o posterior). El gate coincide con 12B `SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS = 48`.

### 6.3 Modelo de idempotencia (`origin` + `packId`)

`MessageTemplate` tiene dos columnas nuevas (migration `20260421104359_message_template_origin_12c`):

- `origin: "user" | "pack"` — `default "user"`
- `packId: string?` — `msp.*` cuando `origin = "pack"`, `null` si `origin = "user"`
- `@@index([propertyId, origin, packId])`

Reglas:

1. **Apply** (`applyStarterPack`, `$transaction`):
   - `findMany { propertyId, origin: "pack" }` → borra automations por `templateId` + borra templates (cualquier `packId`, incluye el que se re-aplica).
   - Crea `templates.length` rows con `origin: "pack", packId: pack.id, status: "draft"` + `automations` con `active: false, timezoneSource: "property_timezone"`.
   - Los rows con `origin: "user"` **nunca** se tocan.
2. **Re-apply mismo pack** → swap en sitio (`replacedTemplates === templatesCreated`).
3. **Apply distinto pack** → swap de pack-rows, `origin: "user"` queda tal cual.
4. **Edit host** (`updateMessageTemplateAction`) → flip `origin: "user"` + `packId: null`. El row deja de ser candidato para pack-replace en futuras aplicaciones.

### 6.4 Server actions + UI

- `previewStarterPackAction(propertyId, packId)` — resuelve variables token-por-token contra la property (reservation vars siguen siendo `unresolved_context` en preview, igual que 12A/12B).
- `applyStarterPackAction(_, FormData)` — lee `propertyId` + `packId`, corre `applyStarterPack`, retorna `ApplyStarterPackResult { packId, templatesCreated, automationsCreated, replacedTemplates, replacedAutomations }`.

`StarterPackPicker` en `src/components/messaging/starter-pack-picker.tsx` (cliente):

- Empty state CTA (`templateCount === 0 && !hasPackRows`): banner "Empieza con un pack".
- Estado con packs/templates: botón "Cargar pack" en la header.
- Modal con grid de 6 cards (tone + locale + templateCount) + preview drawer por template (subject, body resolved, badges `missing | reserva | desconocida`).
- Botón Apply muta a "Reemplazar pack" cuando `hasPackRows === true`.

Hook de onboarding wizard queda diferido (ver `docs/FUTURE.md`).
