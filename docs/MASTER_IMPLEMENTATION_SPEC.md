# MASTER_IMPLEMENTATION_SPEC

Versión: 2026-04-07  
Autoridad: `version_3`  
Idioma visible: español  
IDs internos y código: inglés  
Unidades: sistema métrico

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
  - `secret` nunca sale por defecto
- Regla de localización:
  - toda UI visible al operador y al huésped debe estar en español

## 2. Product mission

La aplicación debe servir, desde una única fuente de verdad, para:

1. crear y mantener una guía útil para huéspedes
2. producir una base de conocimiento fiable para AI
3. alimentar mensajes reutilizables y automatizables
4. soportar operación interna, limpieza, mantenimiento y revisión
5. publicar múltiples outputs sin reescribir contenido

## 3. Canonical UX model

### A. Entry and property creation

- dashboard de propiedades
- wizard inicial de 4 pasos + review
- posibilidad de:
  - crear propiedad usable
  - guardar borrador
  - continuar más tarde

### B. Property workspace

Módulos canónicos:

1. Overview
2. Basics
3. Arrival & access
4. Policies
5. Spaces
6. Amenities
7. Troubleshooting
8. Local guide
9. Knowledge Base
10. Guest guide
11. AI view
12. Messaging
13. Publishing
14. Cleaning & ops
15. Media library
16. Analytics
17. Settings
18. Activity log

### C. Reusable outputs

1. guest guide
2. AI knowledge export
3. messaging pack
4. OTA snippets
5. internal ops pack

## 4. Route map

### Canonical routes

- `/`
- `/properties/new/welcome`
- `/properties/new/step-1`
- `/properties/new/step-2`
- `/properties/new/step-3`
- `/properties/new/step-4`
- `/properties/new/review`
- `/properties/:propertyId`
- `/properties/:propertyId/basics`
- `/properties/:propertyId/arrival`
- `/properties/:propertyId/policies`
- `/properties/:propertyId/spaces`
- `/properties/:propertyId/spaces/:spaceId`
- `/properties/:propertyId/amenities`
- `/properties/:propertyId/amenities/:amenityId`
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

### Compatibility aliases for the current repo

- `/properties` -> redirect a `/`
- `/properties/:propertyId/overview` -> `/properties/:propertyId`
- `/properties/:propertyId/wizard/*` -> canonical módulo correspondiente
- `/properties/:propertyId/preview/guest` -> `/properties/:propertyId/guest-guide`
- `/properties/:propertyId/preview/ai` -> `/properties/:propertyId/ai`

## 5. Source-of-truth rules

### Runtime taxonomies

Las opciones guiadas viven en `taxonomies/*.json`.

### Canonical persisted entities

La verdad de negocio persistida vive en:

- `Workspace`
- `User`
- `WorkspaceMembership`
- `Property`
- `WizardSession`
- `WizardResponse`
- `Space`
- `PropertyAmenity`
- `TroubleshootingPlaybook`
- `LocalPlace`
- `OpsChecklistItem`
- `StockItem`
- `MaintenanceTask`
- `KnowledgeSource`
- `KnowledgeItem`
- `KnowledgeCitation`
- `GuideVersion`
- `GuideSection`
- `GuideSectionItem`
- `MessageTemplate`
- `MessageAutomation`
- `MessageDraft`
- `MediaAsset`
- `MediaAssignment`
- `AssistantConversation`
- `AssistantMessage`
- `SecretReference`
- `AuditLog`

### Derived layers

Son derivadas, no write owners:

- review queue
- publish blockers
- readiness cards
- AI export payloads
- guest guide render trees

## 6. Visibility model

- `public`
- `booked_guest`
- `internal`
- `secret`

Reglas:

- `secret` jamás entra en `KnowledgeItem`
- `booked_guest` puede verse por huéspedes confirmados y operadores
- `internal` solo operadores
- `public` es reutilizable en web abierta, snippets y FAQ pública

## 7. Wizard capture principle

El wizard no pregunta “cuéntame todo”.
El wizard debe:

- ofrecer opciones comunes primero
- abrir follow-ups condicionados
- permitir `Other / custom` solo cuando exista
- pedir notas concisas y estructuradas
- pedir fotos o vídeo solo cuando reduzcan fricción
- explicar por qué cada dato importa

## 8. Messaging principle

Cada mensaje:

- tiene un único objetivo
- usa variables estructuradas
- reutiliza conocimiento canónico
- nunca incluye secretos por defecto
- queda editable después de autogenerarse

## 9. Assistant principle

El assistant:

- responde solo desde conocimiento soportado
- devuelve citas máquina-legibles
- filtra por propiedad, idioma, journey stage y visibilidad
- escala si no hay soporte suficiente
- bloquea peticiones de secretos

## 10. Release principle

No se considera estable una fase si falta cualquiera de:

- modelo de datos alineado
- validación de inputs
- tests relevantes
- release gates
- docs y prompts actualizados
