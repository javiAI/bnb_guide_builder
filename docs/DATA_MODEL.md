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
  - `id`, `propertyId`, `categoryKey` (`lp.*` taxonomy key, fail-loud en boot), `name`, `shortNote`, `guestDescription`, `aiNotes`, `distanceMeters`, `hoursText`, `linkUrl`, `bestFor`, `seasonalNotes`, `verifiedAt`, `visibility`, timestamps
  - **Geo + provenance (Rama 13A)**: `latitude` / `longitude` (DOUBLE PRECISION), `address`, `website`, `provider` (`"maptiler"` | `"mock"` | NULL para manual), `providerPlaceId` (fingerprint estable del proveedor), `providerMetadata` (JSONB con `nativeCategory`, `placeTypes[]`, `confidence`, `retrievedAt`)
  - `@@unique([propertyId, provider, providerPlaceId], map: "local_places_property_provider_place_unique")` — Postgres NULLs-distinct semantics: rows manuales (provider/providerPlaceId NULL) nunca colisionan entre sí; solo dos rows con la misma `(propertyId, provider, providerPlaceId)` no-NULL chocan. `createLocalPlaceAction` catch-ea Prisma `P2002` y devuelve "Este lugar ya está añadido" — no read-then-write.
- `LocalEvent` (Rama 13B — sync diario multi-source, ortogonal a `LocalPlace`)
  - `id`, `propertyId`, `canonicalKey` (sha256(16) de `{normalizedTitle|startsAtHour|propertyId}` — estable across ticks), `title`, `descriptionMd?`, `categoryKey` (`le.*` taxonomy), `startsAt`, `endsAt?`, `venueName?`, `venueAddress?`, `latitude?`, `longitude?`, `imageUrl?`, `sourceUrl?`, `priceInfo` JSONB, `confidence` Float, `primarySource` String (highest-priority contributor), `contributingSources` String[] (union ordenada por priority), `mergeWarnings` String[] (accumula cuando matcher fusionó events con venue distinto), `lastSyncedAt`, timestamps
  - `@@unique([propertyId, canonicalKey])` — key de idempotencia del upsert. Re-ejecutar el tick no crea duplicados.
  - Índices: `(propertyId, startsAt)`, `(propertyId, categoryKey)`
  - `onDelete: Cascade` desde `Property` (relación `localEvents LocalEvent[]`).
  - Merge per-field con excepciones: `sourceUrl` wins TM (deep-link a venta), `imageUrl` wins Firecrawl (scraped images). Resto de campos wins por priority descendente (`predicthq:100 > firecrawl:80 > ticketmaster:60`).
  - **Retention**: el sync `deleteMany` solo eventos **futuros** no re-surfaced en el tick (`startsAt >= tick AND lastSyncedAt < tick`). Eventos pasados se conservan como histórico — no hay sweep de legacy en 13B.
- `LocalEventSourceLink` (Rama 13B — provenance per-source por evento)
  - `id`, `eventId` (FK `LocalEvent.id` con `onDelete: Cascade`), `propertyId` (scalar, sin FK — enforced al write por `sync.ts`), `source` (`"predicthq" | "firecrawl" | "ticketmaster" | ...`), `sourceExternalId` (id nativo del proveedor), `sourceUrl?`, `confidence` Float, `providerMetadata` JSONB (`nativeCategory`, `nativeTypes[]`, `confidence`, `retrievedAt`), `retrievedAt`, timestamps
  - `@@unique([propertyId, source, sourceExternalId])` — scoped por property: el mismo evento en otra propiedad lleva otra row. Upsert-idempotent.
  - **Reconciliación stale**: si un source deja de surfacing un evento en un tick, su link para ese `eventId` se borra (`deleteMany` por diff de `tickLinkKeys`). Los links de otros sources se conservan.
  - Persistencia dentro del mismo `$transaction` que el `LocalEvent` padre — eventos y links nunca quedan desincronizados. Ver `src/lib/services/local-events/sync.ts`.
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
- `KnowledgeItem` — schema expandido en Rama 11A con campos AI pipeline completos:
  - Identidad del chunk: `chunkType` (`fact|procedure|policy|place|troubleshooting|summary|template`), `entityType` (`property|access|policy|contact|amenity|space|system`), `entityId String?`
  - Recuperación híbrida: `contextPrefix String` (prefijo multi-línea Contextual Retrieval), `bm25Text String` (texto normalizado BM25), `embedding Unsupported("vector(512)")?` (pgvector, Rama 11C — Voyage `voyage-3-lite`), `embedding_model String?` (model version stamp para invalidar al cambiar de provider), `bm25Tsv Unsupported("tsvector")?` (columna Postgres generated desde `bm25Text` via `dbgenerated`; declarada en `schema.prisma` junto con su GIN index para paridad con la DB, pero no queriable vía Prisma Client — acceso por `$queryRaw`), `tokens Int`
  - Metadata de calidad: `canonicalQuestion String?`, `contentHash String?` (sha256 16-char del prefijo + body), `confidenceScore Float @default(1.0)`, `validFrom DateTime?`, `validTo DateTime?`
  - Trazabilidad: `sourceFields String[]` (campos de la entidad fuente que generaron el chunk), `tags String[]`
  - Localización: `locale String @default("es")` (filtro duro en retrieval; i18n multi-locale en 11B — `SUPPORTED_LOCALES = ["es", "en"]`)
  - Identidad cross-locale (11B): `templateKey String?` — clave semántica estable del chunk que sobrevive a re-extracts. NOT NULL para autoextract; los valores concretos son los literales `templateKey: "..."` emitidos por `knowledge-extract.service.ts` (no mantener lista manual aquí — rota en cada rama que añade chunks). NULL para items manuales (no participan en cross-locale pairing). Pairing real: `(propertyId, entityType, entityId, templateKey)`
  - Índices: `(propertyId, locale, journeyStage)`, `(propertyId, chunkType)`, `(propertyId, entityType, entityId)`, `(propertyId, visibility)`, `(propertyId, entityType, entityId, templateKey, locale)` (11B — cross-locale lookup), GIN sobre `bm25_tsv` (11C)
  - Invalidación (11C): `upsertChunksIncremental` clasifica delete/create/update por `(entityType|entityId|templateKey)` dentro del scope `{propertyId, locale, isAutoExtracted: true}`. Cuando `contentHash` cambia se nulifican `embedding` y `embedding_model` (re-embed por el job de backfill); cuando no cambia el embedding persiste. Wired en `editor.actions.ts` fire-and-forget.
  - Backfill: `src/lib/jobs/knowledge-embed-backfill.ts` — idempotente (selecciona `embedding IS NULL`, o cuando `embedding_model` no coincide con `provider.modelId`, o cuando `embedding_version` no coincide con `provider.version`); args `--property`, `--batch`, `--dry-run`.
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
  - `id`, `conversationId`, `role` (`user|assistant`), `body`, `citationsJson`, `confidenceScore`, `escalated`, `createdAt`
  - `citationsJson` (Rama 11C) guarda un envelope `{ citations: Citation[], escalationReason: string | null }`. `Citation = { knowledgeItemId, sourceType, entityLabel, score }`. No hay columna dedicada de `escalationReason` para evitar migración — la ruta `ask` serializa y parsea la envoltura.

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
