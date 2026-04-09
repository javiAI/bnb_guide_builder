# SYSTEM_ARCHITECTURE

## 1. Layers

### Product and UI

- App shell
- property creation wizard
- property workspace modules
- guest guide and AI view

### Application

- route handlers / server actions
- Zod validation
- permission and visibility enforcement
- orchestration services

### Domain and persistence

- Prisma models
- typed repositories
- canonical entity services
- audit logging

### Derived content

- knowledge generation
- guide versioning
- publishing gates
- messaging starter packs
- review queue

### Retrieval and automation

- assistant retrieval pipeline
- message automation scheduler contract
- output export services

## 2. Write ownership

| Fact | Write owner |
|---|---|
| property basics | `Property` service |
| wizard capture raw answers | `WizardSession` + `WizardResponse` service |
| spaces | `Space` service |
| amenities | `PropertyAmenity` service |
| troubleshooting | `TroubleshootingPlaybook` service |
| local recommendations | `LocalPlace` service |
| ops | `OpsChecklistItem`, `StockItem`, `MaintenanceTask` services |
| media metadata | `MediaAsset` and `MediaAssignment` services |
| knowledge items | knowledge generation and manual editorial services |
| guide versions | guide composition service |
| message templates | messaging service |
| automations | messaging automation service |
| assistant conversations | assistant conversation service |
| secrets | vault integration + `SecretReference` metadata |
| audit trail | audit service |

## 3. Synchronization rules

- wizard save writes raw responses and updates canonical entities in the same transaction where feasible
- derived knowledge and publish blockers are regenerated deterministically, not hand-edited in duplicate
- message starter packs are generated from canonical entities and remain editable as independent templates
- audit log stores safe structured diffs, not raw secret payloads

## 4. Runtime taxonomy model

Taxonomías JSON versionadas controlan:

- property types
- room types
- access methods
- amenity taxonomy
- amenity subtypes
- policy taxonomy
- troubleshooting taxonomy
- messaging touchpoints
- guide outputs
- media requirements
- visibility levels
- dynamic field rules
- automation channels
- media asset roles
- review reasons

## 5. Rendering model

### Guest guide

- consume `GuideVersion`, `GuideSection`, `GuideSectionItem`
- include solo `public` o `booked_guest` según audiencia

### AI view

- consume `KnowledgeItem` filtrado
- añade metadata de confianza, freshness y citations

### Messaging

- consume `MessageTemplate`, `MessageAutomation`
- variables resueltas desde datos canónicos y knowledge

## 6. Security architecture

- secrets fuera de corpus general
- vault references segregadas
- visibilidad reforzada en backend
- rutas públicas sin contenido interno
- trazabilidad en cambios sensibles

## 7. Compatibility strategy

- mantener rutas legacy con redirects
- mantener `Workspace` como contexto organizativo aunque `Property` sea el objeto central del producto
- migrar progresivamente superficies wizard-first a módulos canónicos
