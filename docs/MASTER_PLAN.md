# Plan maestro — Amenities v2 + Sync Contracts

Versión: 2026-04-14
Basado en: `docs/deep_research_1/` + `docs/deep_research_2/`
Alcance: 7 fases, 20 ramas, ~20 PRs independientes y revisables

---

## Principios de ejecución

1. **Una rama = una PR = un cambio lógico**. Nada de super-PRs.
2. **Config-driven**: si una regla vive en React, es un bug.
3. **Backwards-compat dentro de una fase, breaking entre fases**. La fase 2 (modelo amenities) es el único punto de no retorno — dual-write durante transición.
4. **Tests nuevos en cada PR**. Sin tests, no merge.
5. **Validación TS + Prisma antes de commit** (`/pre-commit-review`).
6. **Revisión Copilot en cada PR** (`/review-pr-comments`).

---

## Resumen de fases

| Fase | Título | Ramas | Riesgo | Valor | Breaking? |
|---|---|---:|---|---|---|
| 1 | Fundación arquitectónica | 5 | Bajo | Alto | No |
| 2 | Modelo amenities v2 | 3 | Alto | Alto | Sí (DB) |
| 3 | Subtypes + derivations UI | 3 | Medio | Alto | No |
| 4 | Sync & derived state | 3 | Medio | Alto | No |
| 5 | Spaces polish | 3 | Bajo | Medio | No |
| 6 | Incidents & troubleshooting | 2 | Bajo | Alto | No |
| 7 | Polish final | 3 | Medio | Medio | Sí (visibility) |

---

## FASE 1 — Fundación arquitectónica

**Objetivo**: dejar todas las piezas de metadata y motor listas antes de tocar el modelo de datos. Cero cambios breaking.

### Rama 1A — `feat/conditional-engine`

**Propósito**: motor condicional unificado (`evaluateItemAvailability`) + DSL declarativo + `PropertyContext` builder. **Reemplaza** el evaluator actual de `dynamic_field_rules.json`. El contenido del JSON se migra al nuevo DSL en esta misma rama; el evaluator antiguo se elimina.

**Archivos a crear**:
- `src/lib/conditional-engine/types.ts` — tipos `PropertyContext`, `ItemRules`, `EvaluationResult`
- `src/lib/conditional-engine/evaluator.ts` — función pura `evaluateItemAvailability(rules, ctx)`
- `src/lib/conditional-engine/operators.ts` — operadores atómicos (`equals`, `in`, `gt`, `exists`, `containsAny`, …)
- `src/lib/conditional-engine/context-builder.ts` — `buildPropertyContext(propertyId)` desde Prisma
- `src/lib/conditional-engine/cycle-detector.ts` — validador de ciclos en `requiresAmenities/requiresSystems` (build-time)

**Archivos a modificar**:
- `src/lib/taxonomy-loader.ts` — no cambia semántica, pero exporta `evaluateItemAvailability` para consumidores
- `src/lib/types/taxonomy.ts` — añadir tipo `ItemRules` opcional en items

**Tests**:
- `src/test/conditional-engine/evaluator.test.ts` — 15+ casos: equals/in/gt/allOf/anyOf/not/requires*
- `src/test/conditional-engine/context-builder.test.ts` — build desde Prisma mockeado
- `src/test/conditional-engine/cycle-detector.test.ts` — detecta ciclos A→B→A en requires*

**Criterio de done**: el motor es una librería pura, 100% cubierta por tests, no usada aún en UI. El PR sólo añade el nuevo servicio.

---

### Rama 1B — `feat/amenity-audit-apply`

**Propósito**: aplicar la auditoría de 142 amenities del research a `amenity_taxonomy.json`. Cada item gana un campo `destination` + opcional `target` + nota.

**Archivos a modificar**:
- `taxonomies/amenity_taxonomy.json` — enriquecer cada item con `destination: amenity_configurable|derived_from_space|derived_from_system|derived_from_access|moved_to_*`
- `src/lib/types/taxonomy.ts` — tipo `AmenityDestination` + campo en `AmenityItem`
- `src/lib/taxonomy-loader.ts` — helpers `getAmenityDestination(id)`, `isAmenityConfigurable(id)`, `isAmenityDerived(id)`, `isAmenityMoved(id)`

**Archivos a crear**:
- `taxonomies/amenity_destinations_summary.json` — snapshot generado por script, sólo lectura (para auditoría fácil)
- `scripts/apply-amenity-destinations.ts` — script idempotente que aplica la tabla del research a la taxonomía

**Tests**:
- `src/test/amenity-destinations.test.ts`:
  - todos los 142 items tienen `destination`
  - `am.wifi` → `derived_from_system` target `sys.internet`
  - `ax.*` (13 items) → `moved_to_access`
  - items `moved_to_system` tienen `target: sys.*` válido (existe en `system_taxonomy.json`)
  - items `derived_from_space` no aparecen como seleccionables en UI (mock)

**Criterio de done**: la taxonomía queda enriquecida, no se mueve código de UI todavía. Esto habilita 1C-1E.

---

### Rama 1C — `feat/systems-safety-infrastructure`

**Propósito**: añadir los 4 nuevos systemKeys de seguridad que la auditoría propone como `moved_to_system`.

**Archivos a modificar**:
- `taxonomies/system_taxonomy.json` — añadir:
  - `sys.smoke_detector` (ex `am.smoke_alarm`)
  - `sys.co_detector` (ex `am.co_alarm`)
  - `sys.fire_extinguisher` (ex `am.fire_extinguisher`)
  - `sys.first_aid_kit` (ex `am.first_aid_kit`)
  - Todos con `defaultCoverageRule: all_relevant_spaces` excepto `first_aid_kit` (property_only)
- `taxonomies/system_subtypes.json` — campos tipados para cada uno (ubicación, fecha última revisión, tipo de detector, etc.)
- `taxonomies/amenity_taxonomy.json` — los 4 items originales pasan a `destination: moved_to_system` con `target` correspondiente
- `src/app/properties/[propertyId]/systems/` — verificar que los nuevos systems aparecen en el listado (sin cambios de código, sólo visuales)

**Tests**:
- `src/test/systems-safety.test.ts`:
  - los 4 nuevos systemKeys existen en `system_taxonomy.json`
  - tienen subtypes en `system_subtypes.json`
  - los 4 items amenity correspondientes tienen `destination: moved_to_system`
- `src/test/release-gates.test.ts` (actualizar) — no cambia, pero verificar que todo sigue pasando

**Criterio de done**: el usuario ve 4 sistemas nuevos en la UI de Systems. Los amenities correspondientes siguen visibles en Equipamiento (se ocultarán en rama 3B).

---

### Rama 1D — `feat/accessibility-audit`

**Propósito**: consolidar los 17 items `moved_to_access` en la taxonomía `accessibility_features.json`. Hoy tenemos esa taxonomía pero no sabemos si cubre todos los `ax.*`.

**Archivos a modificar**:
- `taxonomies/accessibility_features.json` — asegurar cobertura de los 13 `ax.*` + 4 items de parking + `am.single_level_home`
- `taxonomies/amenity_taxonomy.json` — los 17 items pasan a `destination: moved_to_access` con `target` correspondiente en accessibility_features o parking_options
- `src/app/properties/[propertyId]/access/access-form.tsx` — verificar que el selector de accessibility features cubre todos (gap analysis)

**Tests**:
- `src/test/accessibility-coverage.test.ts`:
  - todos los 13 `ax.*` del amenity taxonomy tienen equivalente en `accessibility_features.json`
  - parking variants (`am.free_parking_premises`, `am.paid_parking_*`) mapean a `parking_options.json`
  - `am.single_level_home` está como accessibility feature

**Criterio de done**: UI Access ya permite capturar todo lo que antes estaba duplicado en amenities. Los amenities siguen visibles; se ocultarán en 3B.

---

### Rama 1E — `feat/environment-property-attributes`

**Propósito**: los 6 items `moved_to_property_attribute` (waterfront, ski_in_out, beach_access, lake_access, resort_access, private_entrance) pasan a atributos tipados de Property (o `propertyEnvironment`).

**Archivos a modificar**:
- `prisma/schema.prisma` — añadir `Property.hasPrivateEntrance Boolean?`
  - Los otros 5 (waterfront, ski, beach, lake, resort) son valores de `propertyEnvironment` ya existente → mapear destinos
- `taxonomies/property_environments.json` — verificar que `env.beach`, `env.ski`, `env.lake`, `env.waterfront`, `env.resort` existen
- `src/app/properties/[propertyId]/property/property-form.tsx` — añadir toggle "Entrada privada" (mapea a `hasPrivateEntrance`)
- `src/lib/schemas/editor.schema.ts` — añadir `hasPrivateEntrance` a `propertySchema`
- `taxonomies/amenity_taxonomy.json` — los 6 items con `destination: moved_to_property_attribute` + `target` correspondiente

**Migración Prisma**: `npx prisma migrate dev --name add_has_private_entrance`

**Tests**:
- `src/test/property-environment-mapping.test.ts`:
  - cada uno de los 6 items tiene `target` que apunta a `Property.hasPrivateEntrance` o a un `propertyEnvironment` válido
  - la migración de `hasPrivateEntrance` no rompe properties existentes (default null)

**Criterio de done**: el usuario puede marcar "Entrada privada" en Basics; los 5 entornos están todos en environments. Los amenities siguen visibles; se ocultarán en 3B.

---

## FASE 2 — Modelo amenities v2 (punto de no retorno)

**Objetivo**: migrar de `PropertyAmenity(spaceId?)` a `PropertyAmenityInstance + PropertyAmenityPlacement`. Esta es la única fase con breaking changes en DB.

### Rama 2A — `feat/amenity-instance-model`

**Propósito**: crear los nuevos modelos Prisma `PropertyAmenityInstance` + `PropertyAmenityPlacement` **desde cero** (decisión confirmada) + backfill desde el antiguo `PropertyAmenity`. Modo dual-write: ambos modelos coexisten durante la transición hasta que 2C haga cutover.

**Archivos a modificar**:
- `prisma/schema.prisma`:
  - añadir modelo `PropertyAmenityInstance` (con `instanceKey default "default"`, `detailsJson`, `subtypeKey`, etc.)
  - añadir modelo `PropertyAmenityPlacement` (join table con `@@unique([amenityId, spaceId])`)
  - **mantener** `PropertyAmenity` existente hasta post-cutover (rama 2C+7 días); luego se elimina en rama de cleanup
  - añadir `@@unique([propertyId, amenityKey, instanceKey])` en el nuevo modelo
- `scripts/migrate-amenities-to-instances.ts` — script idempotente de backfill:
  - por cada `PropertyAmenity` → crear `PropertyAmenityInstance` + opcional `PropertyAmenityPlacement`
  - `instanceKey = spaceId ? "space:" + spaceId : "default"`
- `prisma/migrations/XXX_add_amenity_instance_model/` — migración generada

**Archivos a crear**:
- `src/lib/repositories/amenity-instance.repository.ts` — reads/writes sobre los nuevos modelos
- `src/lib/actions/amenity-instance.actions.ts` — server actions: `createInstance`, `updateInstance`, `deleteInstance`, `addPlacement`, `removePlacement`

**Tests**:
- `src/test/amenity-instance-repo.test.ts` — CRUD básico con DB real (integration test)
- `src/test/amenity-migration.test.ts` — script de backfill es idempotente; corre dos veces sin duplicados

**Criterio de done**: ambos modelos existen en DB. El script de backfill poblado con datos reales. La UI sigue leyendo del modelo antiguo (cambia en 2C).

**⚠️ Riesgo**: migración en prod debe correr con downtime o con feature flag.

---

### Rama 2B — `feat/amenity-dual-write`

**Propósito**: hacer que todas las escrituras al modelo antiguo también escriban al nuevo. Lecturas siguen del antiguo. Esto permite rollback si algo va mal.

**Archivos a modificar**:
- `src/lib/actions/editor.actions.ts` — en `toggleAmenityAction`, `updateAmenityAction`: escribir también en `PropertyAmenityInstance + Placement`
- `src/lib/actions/amenity-instance.actions.ts` — idem en las nuevas actions, que también toquen el modelo antiguo
- `src/app/properties/[propertyId]/amenities/page.tsx` — sin cambios, sigue leyendo del antiguo

**Tests**:
- `src/test/amenity-dual-write.test.ts`:
  - toggle amenity → row en ambos modelos
  - update detalles → ambos actualizados
  - delete → ambos borrados
  - `PropertyAmenity.spaceId=null` → Instance sin Placements
  - `PropertyAmenity.spaceId=X` → Instance + 1 Placement

**Criterio de done**: cada mutación toca ambos modelos. Consistencia verificable con script de drift detection.

---

### Rama 2C — `feat/amenity-reads-cutover`

**Propósito**: migrar todas las lecturas al nuevo modelo. Tras esto, el modelo antiguo queda deprecated.

**Archivos a modificar**:
- `src/app/properties/[propertyId]/amenities/page.tsx` — leer de `PropertyAmenityInstance + placements`
- `src/app/properties/[propertyId]/amenities/amenity-selector-v2.tsx` — usar el nuevo shape (instances con placements, instanceKey, etc.)
- `src/app/properties/[propertyId]/spaces/` — actualizar proyecciones "equipamiento en este espacio" para leer placements
- `src/app/properties/[propertyId]/ai/` — si consume amenities, actualizar
- `src/lib/repositories/amenity-instance.repository.ts` — expandir queries para cubrir todos los casos de lectura

**Archivos a eliminar/deprecar**:
- Marcar `PropertyAmenity` como `@deprecated` en schema (no borrar aún — esperar 1 semana post-deploy)

**Tests**:
- `src/test/amenities-page.test.ts` — render con instancias + placements
- `src/test/amenity-reads-parity.test.ts` — mismo resultado leyendo antiguo vs nuevo (durante dual-write)

**Criterio de done**: la UI funciona 100% con el nuevo modelo. El antiguo se mantiene sólo para rollback; escrituras siguen duales hasta la próxima rama.

---

## FASE 3 — Subtypes + derivations UI

### Rama 3A — `feat/amenity-subtypes-ui`

**Propósito**: render dinámico de campos de subtipo cuando un amenity con subtype se habilita. Wifi pide SSID/password, cafetera pide tipo/cápsulas, piscina pide tamaño/horario, etc.

**Archivos a modificar**:
- `src/app/properties/[propertyId]/amenities/amenity-selector-v2.tsx` — al togglear amenity con subtype → expandir form tipado desde `amenity_subtypes.json`
- `src/lib/actions/amenity-instance.actions.ts` — `updateInstanceDetailsAction(instanceId, detailsJson)` con validación Zod contra `amenity_subtypes.json`
- `src/lib/schemas/editor.schema.ts` — schema dinámico generado desde subtypes (similar a `spaceFeaturesSchema`)

**Archivos a crear**:
- `src/components/amenity-subtype-field.tsx` — componente genérico que renderiza un subtype field (text, select, boolean, etc.)
- `src/components/amenity-subtype-form.tsx` — wrapper que compone todos los fields de un subtype

**Tests**:
- `src/test/amenity-subtype-form.test.tsx` — render de wifi subtype (SSID+password fields)
- `src/test/amenity-subtype-validation.test.ts` — validación Zod con subtypes incompletos falla

**Criterio de done**: usuario habilita wifi → ve campos SSID/password → los rellena → persisten en `detailsJson`. Mismo flow para cafetera, piscina, etc.

---

### Rama 3B — `feat/amenity-derivations-badge`

**Propósito**: implementar las 5 categorías de destino. Items `derived_from_*` se muestran con badge read-only y CTA al módulo dueño. Items `moved_to_*` se ocultan (ya los capturamos en otro sitio).

**Archivos a modificar**:
- `src/app/properties/[propertyId]/amenities/page.tsx` — filtrar items por `destination`:
  - `amenity_configurable`: render normal (toggle + placements + subtypes)
  - `derived_from_space|system|access`: badge + CTA deep-link
  - `moved_to_*`: no se muestra
- `src/app/properties/[propertyId]/amenities/amenity-selector-v2.tsx` — componente `<AmenityDerivedBadge>` con botón "Configurar en [Sección]"

**Archivos a crear**:
- `src/lib/amenity-derivation-resolver.ts` — dado un amenity derivado, devuelve `{isActive: boolean, sourceUrl: string, sourceLabel: string}` consultando spaces/systems/access
- `src/components/amenity-derived-badge.tsx`

**Tests**:
- `src/test/amenity-derivation-resolver.test.ts` — `am.wifi` derived from `sys.internet`: si system activo → isActive=true
- `src/test/amenities-page-filtering.test.ts` — items `moved_to_*` no aparecen; `derived_from_*` aparecen como badge

**Criterio de done**: la página de Equipamiento refleja la reclasificación. Ya no hay duplicación (wifi sólo se edita en Systems; parking sólo en Access).

---

### Rama 3C — `feat/amenity-cross-validations`

**Propósito**: validaciones cruzadas que generan warnings y publish blockers. Basado en sync_contracts.md sección "Validaciones cruzadas".

**Archivos a crear**:
- `src/lib/validations/cross-validations.ts` — funciones puras:
  - `validateWifiComplete(property)` — wifi activo sin SSID/password = blocker
  - `validateSmartLockBackup(property)` — smart lock sin backup code = blocker
  - `validateCapacityCoherence(property)` — maxGuests vs sleepingCapacity = warning
  - `validateInfantsVsCrib(property)` — cuna con `infantsAllowed=false` = warning
  - `validateVisibilityLeaks(property)` — sensitive en endpoint guest/AI = error
- `src/lib/validations/run-all.ts` — orquestador que corre todas y devuelve `{blockers: [], warnings: [], errors: []}`

**Archivos a modificar**:
- `src/app/properties/[propertyId]/page.tsx` — Overview muestra blockers/warnings inline con CTAs

**Tests**:
- `src/test/cross-validations.test.ts` — 15+ casos (uno por validación × estados válido/inválido)

**Criterio de done**: lista de validaciones corre en cada request de Overview; bloqueos se reflejan en publish readiness.

---

## FASE 4 — Sync & derived state

### Rama 4A — `feat/property-derived-service`

**Propósito**: servicio canónico `PropertyDerivedService.recompute(propertyId)` que calcula todos los computed fields.

**Archivos a crear**:
- `src/lib/services/property-derived.service.ts`:
  - `computeSleepingCapacity(propertyId)` — total y por espacio
  - `computeActualCounts(propertyId)` — actualBedroomsCount, actualBathroomsCount
  - `computeSpaceAvailability(propertyId)` — usando motor condicional + space_availability_rules
  - `computeSystemCoverageBySpace(propertyId)`
  - `computeAmenitiesEffectiveBySpace(propertyId)` — merge de configurable + derived_from_*
  - `recomputeAll(propertyId)` — orquestador

**Archivos a modificar**:
- `src/lib/actions/editor.actions.ts` — al final de cada action mutante, llamar `recomputeAll(propertyId)` (puede ser fire-and-forget)
- `src/lib/actions/amenity-instance.actions.ts` — idem

**`PropertyDerived` cache desde el inicio** (decisión confirmada):

- Añadir modelo Prisma `PropertyDerived { propertyId @id, derivedJson, recomputedAt, updatedAt }` en esta rama.
- `recomputeAll(propertyId)` escribe el payload completo en la tabla cache.
- Reads desde la cache; invalidación por `updatedAt` de entidades padre.
- Migración Prisma: `npx prisma migrate dev --name add_property_derived_cache`.

**Tests**:
- `src/test/property-derived.test.ts`:
  - sleepingCapacity sum correcto con crib=0
  - actualBedroomsCount cuenta sólo `sp.bedroom` activos
  - amenitiesEffectiveBySpace incluye derivados

**Criterio de done**: API route `GET /api/properties/[propertyId]/derived` devuelve el payload completo.

---

### Rama 4B — `feat/completeness-scoring`

**Propósito**: implementar las fórmulas de completeness del research (40/30/10/10/10 para espacios, 40/30/30 para equipamiento, 60/40 para systems).

**Archivos a crear**:
- `taxonomies/completeness_rules.json` — reglas versionadas (pesos y umbrales)
- `src/lib/services/completeness.service.ts`:
  - `computeSpacesCompleteness(propertyId): number` (0–100)
  - `computeAmenitiesCompleteness(propertyId): number`
  - `computeSystemsCompleteness(propertyId): number`
  - `computeArrivalCompleteness(propertyId): number`
  - `computeOverallReadiness(propertyId): { usable: boolean, publishable: boolean, scores: {...} }`

**Archivos a modificar**:
- `src/lib/services/property-derived.service.ts` — integrar completeness como parte de `recomputeAll`
- `src/components/section-progress.tsx` — componente de progress por sección en sidebar

**Tests**:
- `src/test/completeness-scoring.test.ts` — casos fixture para cada umbral (≥70, ≥85, ≥90)

**Criterio de done**: sidebar muestra progress por sección; overall readiness en Overview.

---

### Rama 4C — `feat/overview-gaps-and-blockers`

**Propósito**: Overview rediseñada con cards de gaps, blockers, y next-best-action.

**Archivos a modificar**:
- `src/app/properties/[propertyId]/page.tsx` — layout de Overview:
  - Card "Capacidad" con maxGuests vs sleepingCapacity
  - Card "Gaps por sección" con scores + CTAs
  - Card "Publish readiness" con blockers
  - Card "Sistemas/equipamiento críticos pendientes" (wifi sin SSID, etc.)

**Archivos a crear**:
- `src/components/overview/capacity-card.tsx`
- `src/components/overview/gaps-card.tsx`
- `src/components/overview/publish-readiness-card.tsx`
- `src/components/overview/next-action-card.tsx`

**Tests**:
- `src/test/overview-page.test.tsx` — render con fixtures de distintos estados

**Criterio de done**: el Overview se convierte en "control tower" real. CTAs deep-link al dueño canónico de cada gap.

---

## FASE 5 — Spaces polish

### Rama 5A — `feat/space-overlays-by-property-type`

**Propósito**: overlays por propertyType y propertyEnvironment sobre la matriz base de espacios. Reduce ruido en UI (ej: `pt.villa` sugiere `sp.pool` por defecto).

**Archivos a modificar**:
- `taxonomies/space_availability_rules.json` — añadir sección `propertyTypeOverlays` + `environmentOverlays`
- `src/lib/services/space-availability.service.ts` (nuevo si no existe) — motor que aplica matriz base + overlays
- `src/app/properties/[propertyId]/spaces/create-space-form.tsx` — consumir el servicio

**Tests**:
- `src/test/space-availability-overlays.test.ts` — villa sesga pool/garden; apartment sesga balcony

**Criterio de done**: al crear un espacio, el selector está sesgado por contexto.

---

### Rama 5B — `feat/space-archived-status`

**Propósito**: añadir `Space.status = active|archived` para soportar cambios de layout sin pérdida silenciosa.

**Archivos a modificar**:
- `prisma/schema.prisma` — `Space.status String @default("active")`
- `src/lib/schemas/editor.schema.ts` — schemas que filtran active/archived
- `src/app/properties/[propertyId]/spaces/space-card.tsx` — acción "Archivar" + badge archivado
- `src/lib/actions/editor.actions.ts` — acción `archiveSpaceAction` (no borra, sólo marca)

**Migración**: `npx prisma migrate dev --name add_space_status`

**Tests**:
- `src/test/space-archive.test.ts` — archive no borra, excluye de conteos, excluye de guía

**Criterio de done**: cambio de layout puede archivar espacios incompatibles sin perder datos.

---

### Rama 5C — `feat/wizard-seed-tracking`

**Propósito**: `Space.createdBy` + `Space.wizardSeedKey` + `BedConfiguration.wizardSeedKey` para sincronización idempotente wizard↔workspace.

**Archivos a modificar**:
- `prisma/schema.prisma`:
  - `Space.createdBy String @default("user")` (user | wizard)
  - `Space.wizardSeedKey String?`
  - `BedConfiguration.wizardSeedKey String?`
- `src/lib/actions/wizard.actions.ts` — al crear seeds, asignar `wizardSeedKey`
- `src/lib/actions/editor.actions.ts` — al editar manualmente, limpiar `wizardSeedKey` (transfer ownership)

**Migración**: `npx prisma migrate dev --name add_wizard_seed_tracking`

**Tests**:
- `src/test/wizard-seed-tracking.test.ts`:
  - wizard crea con seedKey
  - re-entrar wizard no duplica (idempotencia)
  - edición manual limpia seedKey → deja de sincronizarse

**Criterio de done**: re-visitar wizard no duplica espacios; editar manual preserva cambios.

---

## FASE 6 — Incidents & troubleshooting linking

### Rama 6A — `feat/troubleshooting-linking`

**Propósito**: vincular playbooks a system/amenity/space/access.

**Archivos a modificar**:
- `prisma/schema.prisma` — `TroubleshootingPlaybook`:
  - `systemKey String?`
  - `amenityKey String?`
  - `spaceId String?`
  - `accessMethodKey String?`
- `src/app/properties/[propertyId]/troubleshooting/[playbookKey]/` — selector de target
- `src/app/properties/[propertyId]/systems/` — bloque "Troubleshooting relacionado"
- `src/app/properties/[propertyId]/amenities/` — idem por instance

**Migración**: `npx prisma migrate dev --name add_playbook_targets`

**Tests**:
- `src/test/playbook-linking.test.ts` — playbook con systemKey aparece en system detail; un playbook sólo puede tener un target

**Criterio de done**: playbooks se ven en contexto (system/amenity/space detail).

---

### Rama 6B — `feat/incident-model`

**Propósito**: modelo `Incident` para ocurrencias reales (vs Playbooks que son plantillas).

**Archivos a modificar**:
- `prisma/schema.prisma` — nuevo modelo `Incident`:
  - `propertyId, title, severity, status, targetType, targetId, playbookId?, occurredAt, resolvedAt?, visibility`
- `src/app/properties/[propertyId]/troubleshooting/` — pestaña "Ocurrencias"
- `src/lib/actions/incident.actions.ts` — CRUD

**Tests**: CRUD básico + filtering por target.

**Criterio de done**: ocurrencias registrables, visibles en ops. Filtrable por target (system/amenity/space/property). Link opcional a playbook heredando steps.

---

## FASE 7 — Polish final

### Rama 7A — `refactor/visibility-enum`

**Propósito**: migrar strings `"public"|"internal"|"sensitive"` a enum Prisma `VisibilityLevel{guest,ai,internal,sensitive}`.

**Archivos a modificar**:
- `prisma/schema.prisma` — enum + cambiar todos los campos `visibility String` a `VisibilityLevel`
- Script de migración: `"public"→"guest"`, `"secret"→"sensitive"`
- Todas las schemas Zod que validan visibility

**Migración compleja**: requiere script de data migration + deploy coordinado.

**Tests**: verificar que strings legacy se migran correctamente.

**Criterio de done**: enum tipado en todo el stack.

---

### Rama 7B — `feat/amenity-additions`

**Propósito**: añadir los items propuestos en el research:
- `am.hand_soap`, `am.dish_soap`, `am.laundry_detergent`, `am.air_purifier`, `am.humidifier`, `am.dehumidifier`, `am.cork_screw`, `am.basic_spices`

**Archivos a modificar**:
- `taxonomies/amenity_taxonomy.json` — añadir items con `destination: amenity_configurable`, `recommended` según contexto

**Tests**: los nuevos items aparecen en kitchen/bathroom contexts.

**Criterio de done**: catálogo enriquecido.

---

### Rama 7C — `chore/completeness-calibration`

**Propósito**: tras 2–4 semanas de uso, ajustar umbrales de completeness si están mal calibrados. No es técnico — es medición.

**Archivos a modificar**: `taxonomies/completeness_rules.json` — sólo pesos/umbrales.

**Criterio de done**: los scores reflejan realidad del usuario (no hay properties "al 90%" que estén obviamente incompletas).

---

## Checklist de ejecución por PR

Para cada rama, antes de merge:

1. [ ] Branch creada desde `main` actualizada
2. [ ] Cambios implementados
3. [ ] Tests nuevos pasan (`npx vitest run`)
4. [ ] `npx prisma generate && npx tsc --noEmit` sin errores
5. [ ] `/pre-commit-review` sin issues críticos
6. [ ] Commit con mensaje descriptivo
7. [ ] Push + PR con description + test plan
8. [ ] `/review-pr-comments` para aplicar feedback Copilot
9. [ ] Merge squash + delete branch
10. [ ] `git pull origin main --ff-only`

---

## Dependencias entre fases (grafo)

```
Fase 1 (independiente) ──────────────────────────────────────────┐
                                                                  │
  1A Motor condicional ──┐                                        │
  1B Auditoría amenities ──┐                                      │
  1C Sistemas seguridad ───┤                                      │
  1D Accessibility audit ──┤                                      │
  1E Property attributes ──┘                                      │
                                                                  ▼
Fase 2 (requiere 1B)                                    Fase 4 (requiere 1A)
  2A Instance model ──► 2B Dual-write ──► 2C Reads cutover          │
                                                ▼                    │
Fase 3 (requiere 2C)                                                 │
  3A Subtypes UI ──► 3B Derivations badge ──► 3C Cross-validations   │
                                                ▼                    ▼
                                        Fase 4 (requiere 3C)
                                          4A Derived service ──► 4B Completeness ──► 4C Overview gaps
                                                                      ▼
Fase 5 (requiere 4A)                                                  │
  5A Overlays ──► 5B Space archive ──► 5C Wizard seed tracking        │
                                                                      ▼
Fase 6 (requiere 3B)                                                  │
  6A Troubleshooting linking ──► 6B Incident model (opcional)         │
                                                                      ▼
Fase 7 (requiere 4B)
  7A Visibility enum ──► 7B Additions ──► 7C Calibration
```

---

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Migración amenities rompe datos prod | Dual-write + script idempotente + rollback via modelo antiguo intacto |
| Motor condicional lento en Overview | Medir p95 en 4A; si >200ms, añadir `PropertyDerived` cache en 4B |
| Drift entre modelo antiguo/nuevo durante dual-write | Script de drift detection que corre en CI |
| Visibility enum migration falla a mitad | Script idempotente + feature flag para toggle |
| Reclasificación amenities confunde usuarios actuales | Release notes + badge explicativo en items derivados |

---

## Timeline estimado (sin comprometer fechas)

- Fase 1: 5 PRs paralelizables → pronto
- Fase 2: secuencial (2A→2B→2C), alto cuidado
- Fase 3: paralelizable por rama
- Fase 4: secuencial
- Fases 5–7: paralelizables

**Total**: ~20 PRs. Orden óptimo: 1A+1B primero (desbloquean todo), 2A-2C juntos (no interrumpir), el resto según capacidad.

---

## Decisiones confirmadas (2026-04-14)

1. **Incident model (6B)**: ✅ implementar ahora (no diferir).
2. **PropertyDerived cache (4A)**: ✅ desde el inicio (no esperar a medir latencia).
3. **Visibility enum (7A)**: ✅ ahora, no diferir a fase separada.
4. **Motor condicional (1A)**: ✅ reemplaza `dynamic_field_rules.json`. Durante 1A se migra el contenido existente al nuevo DSL; el JSON se mantiene como fuente de reglas pero ya no se usa el evaluator antiguo.
5. **Naming amenities (2A)**: ✅ crear `PropertyAmenityInstance` desde cero como modelo nuevo. El antiguo `PropertyAmenity` queda deprecated + se elimina tras cutover estable.
