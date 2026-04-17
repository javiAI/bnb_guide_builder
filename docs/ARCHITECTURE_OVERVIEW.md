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

### Public routes (no auth)

- `/g/:slug` — Guest guide (read-only, audience=guest forced). Resolves `Property.publicSlug` → latest published `GuideVersion.treeJson`, re-filtered to guest audience. `sensitive` and `internal` items are stripped server-side before render. Shows "guía no disponible" if no published version exists.
- `/g/:slug/media/:assetId-:hashPrefix/:variant` — stable public media proxy (Rama 10D). Decouples CDN-cached HTML from R2 presigned URL lifecycle (1h expiry). `:variant` ∈ `thumb`/`md`/`full`. Strong immutable cache when `contentHash` present (ETag = `"{contentHash}-{variant}"`), weak revalidating cache otherwise. Range requests propagate to R2 (206 partial content). Auth: 404 unless asset's property has `publicSlug = :slug` AND ≥1 published `GuideVersion`. See `docs/FEATURES/MEDIA_ASSETS.md` §7.

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
- `GuideVersion.treeJson` — snapshot inmutable del `GuideTree` al momento de publicar (audience=internal, se filtra al renderizar)

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

- Servicio: `composeGuide(propertyId, audience, publicSlug)` en `src/lib/services/guide-rendering.service.ts` devuelve un `GuideTree` tipado (`src/lib/types/guide-tree.ts`): `sections[] → items[] → fields[] / media[] / children[]`.
- Secciones declaradas en `taxonomies/guide_sections.json` (9 slots: essentials aggregator + arrival, spaces, howto, amenities, rules, checkout, local, emergency) + resolvers registrados por `resolverKey` — añadir sección = editar taxonomía + registrar resolver, nunca tocar componentes.
- Empty sections siempre presentes en el tree con `items: []`; `emptyCtaDeepLink` es `null` para `audience === "guest"` (host-panel links nunca expuestos al huésped) y la ruta resuelta con `propertyId` para audiences internas.
- Filtrado por audiencia delega en `canAudienceSee` (`src/lib/visibility.ts`) — aplicado a nivel item y a nivel field. `sensitive` nunca emitido por el resolver.
- Resiliencia: taxonomy keys desconocidas no rompen el render — el item se emite con `deprecated: true`, `label` = raw key, y un warning. Invariante enforced por `src/test/guide-no-hardcoded-ids.test.ts`.
- Output estable: `renderMarkdown(tree)` en `src/lib/renderers/guide-markdown.ts` + React renderer (10E) como canal principal para `/g/:slug`.

### Guest presentation layer (rama 10F — post-auditoría 2026-04-17)

**El filtrado por audiencia no es suficiente**: `canAudienceSee` controla *qué se ve*, no *cómo se ve*. Sin una capa terminal, un `policiesJson` viaja al huésped como JSON crudo, un enum `rm.smoking_outdoor_only` aparece como clave técnica, y un `emptyCopy` editorial ("Añade normas...") escrito para el host se muestra tal cual al huésped. La capa de presentación sella ese contrato.

**Pipeline canónico** (a partir de 10F): `composeGuide → filterByAudience → normalizeGuideForPresentation → render`.

- `normalizeGuideForPresentation(tree, audience)` es **pura y terminal**: no consulta DB, no muta input, devuelve un `GuideTree` con `GUIDE_TREE_SCHEMA_VERSION = 3`. Se invoca también al servir `snapshotJson` pre-v3 (normalización al servir, sin rewrite en DB).
- Cada `GuideItem` gana 4 campos opcionales: `presentationType?`, `displayValue?`, `displayFields?`, `presentationWarnings?`. El renderer consume `displayValue` / `displayFields` — nunca formatea desde `value` / `fields` raw.
- **Presenter registry** (`src/config/registries/presenter-registry.ts`): `Map<taxonomyKey | presentationType, Presenter>`. Presenters mínimos cubiertos: policy, contact, amenity, space, checkin_window, access_instruction, generic-text (fallback). Coverage test falla si hay `taxonomyKey` en `policy_taxonomy` / `contact_roles` / `amenity_taxonomy` sin presenter.
- Taxonomías extendidas: `guestLabel?`, `guestDescription?`, `icon?`, `heroEligible?`, `quickActionEligible?`, `guestCriticality?` se declaran aquí, no en React. 10G/10H/10I los consumen; 10F los prepara sin consumirlos.
- `guide_sections.json` añade `emptyCopyGuest?` + `hideWhenEmptyForGuest?`. `emptyCopy` queda reservado para audience internal (copy editorial del host). **Nunca** se muestra copy editorial del host al huésped.
- **Invariantes anti-leak** (5 canónicas, sincronizadas con [QA_AND_RELEASE.md §3](QA_AND_RELEASE.md); tests en `src/test/guest-leak-invariants.test.ts`):
  1. Ningún `displayValue` / `displayFields.value` en `audience=guest` empieza por `{` o `[` ni contiene sustring `"json":`.
  2. Ningún `displayValue` / `displayFields.value` en `audience=guest` coincide con clave taxonómica — regex `^[a-z]+(_[a-z]+)*\.[a-z_]+$` (ej: `rm.smoking_outdoor_only`, `ct.host`, `am.wifi`).
  3. `section.emptyCopy` no aparece en trees `audience=guest`; solo `emptyCopyGuest` cuando existe.
  4. Ningún `displayValue` / `label` en `audience=guest` está en la deny-list de labels internos (`"Slot"`, `"Propiedad"`, `"Config JSON"`, ...).
  5. Items con `presentationType === "raw"` en `audience=guest` no se renderizan (sentinel de bug + log `missing-presenter`).
- Schema evolution: `GUIDE_TREE_SCHEMA_VERSION = 2` → `3`. Snapshots pre-v3 se normalizan al servir (`snapshotPreV3` log).

### AI view

- Consume `KnowledgeItem` filtrado por visibility `guest` o `ai`
- Añade metadata de confianza, freshness y citations

### Messaging

- Consume `MessageTemplate`, `MessageAutomation`
- Variables resueltas desde datos canónicos y knowledge
