# ARCHITECTURE_OVERVIEW

Versión: 2026-04-15
Autoridad: `version_3`
Idioma visible: español
IDs internos y código: inglés
Unidades: sistema métrico

Este documento es la fuente de verdad para el diseño del sistema: misión, capas, route map, ownership de escritura, reglas de sincronización y principios de producto. Sustituye y consolida a los anteriores `MASTER_IMPLEMENTATION_SPEC.md` y `SYSTEM_ARCHITECTURE.md`.

---

## 1. Executive output

- Objeto central: `Property`
- Contexto organizativo: `Workspace`
- Dos capas UX obligatorias:
  - alta rápida de propiedad usable
  - workspace posterior por módulos
- Regla de producto:
  - texto libre solo cuando no haya taxonomía razonable
  - una misma verdad de negocio no se captura dos veces
- Regla de seguridad:
  - `sensitive` nunca sale por defecto
- Regla de localización:
  - toda UI visible al operador y al huésped debe estar en español

## 2. Product mission

La aplicación debe servir, desde una única fuente de verdad, para:

1. crear y mantener una guía útil para huéspedes
2. producir una base de conocimiento fiable para AI
3. alimentar mensajes reutilizables y automatizables
4. soportar operación interna, limpieza, mantenimiento y revisión
5. publicar múltiples outputs sin reescribir contenido

## 3. Layers

### Product and UI

- App shell
- Property creation wizard (4 pasos + review)
- Property workspace modules
- Guest guide + AI view

### Application

- Route handlers / server actions
- Zod validation
- Permission and visibility enforcement
- Orchestration services

### Domain and persistence

- Prisma models
- Typed repositories
- Canonical entity services
- Audit logging

### Derived content

- Knowledge generation
- Guide versioning
- Publishing gates
- Messaging starter packs
- Review queue

### Retrieval and automation

- Assistant retrieval pipeline
- Message automation scheduler contract
- Output export services

## 4. Canonical UX model

### A. Entry and property creation

- Dashboard de propiedades
- Wizard inicial de 4 pasos + review
- Posibilidad de crear propiedad usable, guardar borrador o continuar más tarde

### B. Property workspace

Módulos canónicos (18):

1. Overview
2. Basics / Property
3. Arrival & access
4. Policies
5. Spaces
6. Amenities
7. Systems
8. Troubleshooting
9. Local guide
10. Knowledge base
11. Guest guide
12. AI view
13. Messaging
14. Publishing
15. Cleaning & ops
16. Media library
17. Analytics
18. Settings / Activity log

### C. Reusable outputs

1. Guest guide
2. AI knowledge export
3. Messaging pack
4. OTA snippets (Airbnb/Booking — futuro)
5. Internal ops pack

## 5. Route map

### Canonical routes

- `/`
- `/properties/new/welcome`
- `/properties/new/step-1`
- `/properties/new/step-2`
- `/properties/new/step-3`
- `/properties/new/step-4`
- `/properties/new/review`
- `/properties/:propertyId`
- `/properties/:propertyId/property`
- `/properties/:propertyId/access`
- `/properties/:propertyId/policies`
- `/properties/:propertyId/spaces`
- `/properties/:propertyId/amenities`
- `/properties/:propertyId/systems`
- `/properties/:propertyId/troubleshooting`
- `/properties/:propertyId/troubleshooting/:playbookKey`
- `/properties/:propertyId/local-guide`
- `/properties/:propertyId/knowledge`
- `/properties/:propertyId/guest-guide`
- `/properties/:propertyId/ai`
- `/properties/:propertyId/messaging`
- `/properties/:propertyId/messaging/:touchpointKey`
- `/properties/:propertyId/publishing`
- `/properties/:propertyId/ops`
- `/properties/:propertyId/media`
- `/properties/:propertyId/analytics`
- `/properties/:propertyId/settings`
- `/properties/:propertyId/activity`

## 6. Source-of-truth rules

### Runtime taxonomies

Las opciones guiadas viven en `taxonomies/*.json`. Ver `CONFIG_DRIVEN_SYSTEM.md` para el listado completo y el contrato del loader.

### Canonical persisted entities

La verdad de negocio persistida vive en los modelos Prisma listados en `DATA_MODEL.md`. Resumen de write owners:

| Fact | Write owner |
|---|---|
| Property basics | `Property` service |
| Wizard capture (raw answers) | `WizardSession` + `WizardResponse` service |
| Spaces | `Space` service |
| Amenities | `PropertyAmenityInstance` + `PropertyAmenityPlacement` services |
| Systems | `PropertySystem` service |
| Troubleshooting | `TroubleshootingPlaybook` service |
| Incidents | `Incident` service |
| Local recommendations | `LocalPlace` service |
| Ops | `OpsChecklistItem`, `StockItem`, `MaintenanceTask` services |
| Media metadata | `MediaAsset` + `MediaAssignment` services |
| Knowledge items | Knowledge generation + manual editorial services |
| Guide versions | Guide composition service |
| Message templates | Messaging service |
| Automations | Messaging automation service |
| Assistant conversations | Assistant conversation service |
| Secrets | Vault integration + `SecretReference` metadata |
| Audit trail | Audit service |

### Derived layers

Son derivadas, no write owners:

- `PropertyDerived` cache
- Review queue
- Publish blockers
- Readiness cards
- Completeness scores
- AI export payloads
- Guest guide render trees

## 7. Synchronization rules

- Wizard save escribe raw responses y actualiza entidades canónicas en la misma transacción cuando sea posible.
- Derivados (`PropertyDerived`, publish blockers, completeness) se recomputan determinísticamente en cada mutación. No se editan a mano.
- Messaging starter packs se generan desde entidades canónicas pero quedan editables como templates independientes.
- Audit log almacena diffs estructurados; nunca payloads de secretos.
- Dual-write está prohibido post-MASTER_PLAN: toda lectura usa el modelo canónico.

## 8. Visibility model

Enum `VisibilityLevel` (ver `SECURITY_AND_AUDIT.md`):

- `guest` — reutilizable en guía pública y huéspedes confirmados
- `ai` — accesible al assistant con filtros por audiencia
- `internal` — solo operadores
- `sensitive` — secretos; nunca entran en `KnowledgeItem` ni salen por defecto

## 9. Wizard capture principle

El wizard no pregunta "cuéntame todo". Debe:

- Ofrecer opciones comunes primero
- Abrir follow-ups condicionados
- Permitir `Other / custom` solo cuando exista en taxonomía
- Pedir notas concisas y estructuradas
- Pedir fotos o vídeo solo cuando reduzcan fricción
- Explicar por qué cada dato importa

## 10. Messaging principle

Cada mensaje:

- Tiene un único objetivo
- Usa variables estructuradas
- Reutiliza conocimiento canónico
- Nunca incluye secretos por defecto
- Queda editable después de autogenerarse

## 11. Assistant principle

El assistant:

- Responde solo desde conocimiento soportado
- Devuelve citas máquina-legibles
- Filtra por propiedad, idioma, journey stage y visibilidad
- Escala si no hay soporte suficiente
- Bloquea peticiones de secretos

## 12. Release principle

No se considera estable una fase si falta cualquiera de:

- Modelo de datos alineado
- Validación de inputs (Zod)
- Tests relevantes (unit + integration)
- Release gates (ver `QA_AND_RELEASE.md`)
- Docs actualizados

## 13. Rendering model

### Guest guide

- Consume `GuideVersion`, `GuideSection`, `GuideSectionItem`
- Incluye solo items con visibility `guest` según audiencia

### AI view

- Consume `KnowledgeItem` filtrado por visibility `guest` o `ai`
- Añade metadata de confianza, freshness y citations

### Messaging

- Consume `MessageTemplate`, `MessageAutomation`
- Variables resueltas desde datos canónicos y knowledge
