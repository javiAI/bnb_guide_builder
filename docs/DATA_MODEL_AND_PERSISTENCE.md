# DATA_MODEL_AND_PERSISTENCE

## 1. Modeling principles

- PostgreSQL es el source of truth operativo
- Prisma es el ORM canónico
- no usar `WizardResponse.valueJson` como única verdad de negocio
- `WizardResponse` guarda captura y continuidad, no reemplaza entidades canónicas
- los modelos frecuentes de filtro y render deben tener columnas tipadas

## 2. Canonical models

### Core context

- `Workspace`
- `User`
- `WorkspaceMembership`
- `Property`

### Capture and continuity

- `WizardSession`
- `WizardResponse`

### Canonical property entities

- `Space`
  - `id`, `propertyId`, `spaceType`, `name`, `sortOrder`, `guestNotes`, `aiNotes`, `internalNotes`, `visibility`, timestamps
- `PropertyAmenity`
  - `id`, `propertyId`, `amenityKey`, `subtypeKey`, `spaceId`, `guestInstructions`, `aiInstructions`, `internalNotes`, `troubleshootingNotes`, `visibility`, timestamps
- `TroubleshootingPlaybook`
  - `id`, `propertyId`, `playbookKey`, `title`, `severity`, `symptomsMd`, `guestStepsMd`, `internalStepsMd`, `escalationRule`, `visibility`, `language`, timestamps
- `LocalPlace`
  - `id`, `propertyId`, `categoryKey`, `name`, `shortNote`, `guestDescription`, `aiNotes`, `distanceMeters`, `hoursText`, `linkUrl`, `bestFor`, `seasonalNotes`, `verifiedAt`, `visibility`, timestamps
- `OpsChecklistItem`
  - `id`, `propertyId`, `scopeKey`, `title`, `detailsMd`, `estimatedMinutes`, `required`, `sortOrder`, timestamps
- `StockItem`
  - `id`, `propertyId`, `categoryKey`, `name`, `restockThreshold`, `locationNote`, `unitLabel`, timestamps
- `MaintenanceTask`
  - `id`, `propertyId`, `taskType`, `title`, `cadenceKey`, `nextDueAt`, `ownerNote`, timestamps

### Media

- `MediaAsset`
  - `id`, `propertyId`, `assetRoleKey`, `mediaType`, `storageKey`, `mimeType`, `language`, `caption`, `visibility`, `status`, `uploadedByUserId`, timestamps
- `MediaAssignment`
  - `id`, `mediaAssetId`, `entityType`, `entityId`, `sortOrder`, `usageKey`

### Knowledge and guide

- `KnowledgeSource`
- `KnowledgeItem`
- `KnowledgeCitation`
- `Intent`
- `GuideVersion`
- `GuideSection`
- `GuideSectionItem`

### Messaging

- `MessageTemplate`
- `MessageAutomation`
  - `id`, `propertyId`, `touchpointKey`, `templateId`, `channelKey`, `active`, `triggerType`, `sendOffsetMinutes`, `timezoneSource`, `conditionsJson`, timestamps
- `MessageDraft`

### Assistant

- `AssistantConversation`
  - `id`, `propertyId`, `actorType`, `audience`, `language`, timestamps
- `AssistantMessage`
  - `id`, `conversationId`, `role`, `body`, `citationsJson`, `confidenceScore`, `escalated`, `createdAt`

### Security and audit

- `SecretReference`
- `AuditLog`

## 3. Derived models

No requieren persistencia dedicada al principio si la consulta es determinista:

- review queue
- publish blockers
- output readiness cards
- analytics gap summaries

## 4. Source-of-truth boundary map

| Layer | Canonical owner | Notes |
|---|---|---|
| property identity | `Property` | editable desde creation wizard y Basics |
| arrival, policies, spaces, amenities, troubleshooting, local guide, ops | entidades canónicas por módulo | wizard escribe aquí; detail pages también |
| raw capture | `WizardResponse` | replay, draft continuity, auditing |
| knowledge | `KnowledgeItem` | derivado + editable en Knowledge Base |
| guide output | `GuideVersion` | derivado y versionado |
| messages | `MessageTemplate`, `MessageAutomation` | derivados al inicio, luego editables |
| secrets | `SecretReference` + vault | nunca en retrieval general |

## 5. Migration strategy from current repo

El repo actual ya tiene:

- `Property`
- `WizardSession`
- `WizardResponse`
- `KnowledgeSource`
- `KnowledgeItem`
- `GuideVersion`
- `GuideSection`
- `GuideSectionItem`
- `MessageTemplate`
- `MessageDraft`
- `SecretReference`
- `AuditLog`

Se añaden en v3:

- `Space`
- `PropertyAmenity`
- `TroubleshootingPlaybook`
- `LocalPlace`
- `OpsChecklistItem`
- `StockItem`
- `MaintenanceTask`
- `MediaAsset`
- `MediaAssignment`
- `KnowledgeCitation`
- `Intent`
- `MessageAutomation`
- `AssistantConversation`
- `AssistantMessage`

## 6. Delete semantics

- canonical business entities: soft-archive donde aplique
- guide versions: archive, no destructive overwrite
- message templates: archive, no hard delete en flujos normales
- media assets: soft delete + storage cleanup job posterior
- audit log: append-only

## 7. Indexing priorities

- property-scoped lists
- visibility + language + status
- journeyStage for retrieval
- touchpointKey for messaging
- due dates for review and maintenance
