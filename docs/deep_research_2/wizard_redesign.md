# WIZARD_REDESIGN

Versión: 2026-04-14  
Idioma visible: es-ES  
IDs internos: inglés  
Unidades: sistema métrico  

## Resumen ejecutivo

El wizard debe crear una propiedad “usable” rápidamente sin pedirlo todo, y a la vez debe sembrar correctamente el workspace para evitar captura duplicada (P5) y permitir un flujo adaptativo (P6). La propuesta es un wizard de **4 pasos + revisión**, donde cada respuesta:

- actualiza campos canónicos en `Property` (source of truth),
- persiste el raw en `WizardResponse` (continuidad),
- y cuando procede, crea entidades canónicas (espacios/camas) de forma determinista.

El wizard no compite con el workspace: lo alimenta. La regla: **si ya está en DB canónica no se vuelve a pedir**; si se pidió en wizard, el workspace lo muestra pre-rellenado y lo deja enriquecer.

## Objetivo “usable” vs “publicable en OTA”

### Usable (mínimo viable)

Una propiedad es **usable** cuando permite:
- generar una guía base (estructura, capacidad, llegada),
- y que el operador pueda continuar en el workspace sin bloquearse.

Requisitos mínimos propuestos:

- `propertyNickname`
- `propertyType`
- `roomType`
- `country`, `city`, `timezone` (dirección completa puede ser opcional en “usable”)
- `maxGuests`
- `bathroomsCount` (mínimo 1 salvo casos raros)
- `layoutKey` si `roomType=rt.entire_place`
- `primaryAccessMethod` + `checkInStart/checkInEnd/checkOutTime`

**Y**: espacios sembrados:
- al menos 1 baño (Space)
- dormitorios según `bedroomsCount` si aplica, o `sp.studio/sp.loft` si aplica
- `BedConfiguration` si el usuario responde “plan de camas”

### Publicable en OTA (gating posterior)

Para “publish-ready” (no necesariamente en wizard), además se suele requerir:
- dirección completa
- fotos mínimas
- políticas clave
- descripción
- amenities/export mapping completos

Esto se controla con `completeness` (ver `SYNC_CONTRACTS.md`).

## Estructura propuesta del wizard

### Paso “Tipo y estructura”

Inputs:
- `propertyNickname` (text, required)
- `propertyType` (enum de `property_types.json`, required)
- `roomType` (enum de `room_types.json`, default desde propertyType.defaults)
- `layoutKey` (enum de `space_availability_rules.layoutKeys`, requerido solo si `roomType=rt.entire_place`)
- `propertyEnvironment` (enum de `property_environments.json`, recommended)

Condicionales:
- si `roomType != rt.entire_place`, ocultar `layoutKey`
- si `propertyType.requiresBuildingAccess=true`, preconfigurar `hasBuildingAccess=true`

Writes (inmediato):
- actualizar `Property.propertyNickname, propertyType, roomType`
- añadir `Property.layoutKey` (propuesto) si aplica
- añadir `Property.propertyEnvironment` (propuesto)
- `Property.hasBuildingAccess` según propertyType o input

Persiste en WizardResponse:
- todas las respuestas (para continuidad)

Efectos derivados:
- precalcular `SpaceSlots` y mostrar preview del inventario esperado (“Se crearán 2 dormitorios y 1 baño”).

### Paso “Ubicación”

Inputs:
- `country` (enum/ISO o text guiado)
- `region` (para España, guía `spanish_provinces` si aplica)
- `city`
- `streetAddress` (optional para “usable”, required para publish)
- `postalCode` (optional)
- `timezone` (required)
- `latitude/longitude` (optional; ideal si hay map picker)

Writes:
- actualizar campos de dirección en `Property`

### Paso “Capacidad y distribución”

Inputs:
- `maxGuests` (required)
- `maxAdults`, `maxChildren`, `childrenAgeLimit`, `infantsAllowed` (guided; defaults)
- `bedroomsCount` (required si layout admite dormitorios; else 0)
- `bathroomsCount` (required; default 1)
- “Plan de camas” (UI adaptativa):
  - si hay dormitorios: por cada dormitorio i, lista de beds (bedType + quantity)
  - si studio/loft: “zona de descanso” única (mismo formato)

Condicionales:
- si `maxChildren=0` y `infantsAllowed=false`: ocultar bloque “equipamiento infantil” posteriores (amenities suggestions)
- si `roomType=rt.private_room`: `bedroomsCount` fijo 1 (editable solo si se cambia roomType)

Writes:
- `Property.maxGuests/maxAdults/maxChildren/childrenAgeLimit/infantsAllowed`
- `Property.bedroomsCount/bathroomsCount` (declared)
- Si existe plan de camas: persistir en WizardResponse (siempre) y sembrar en BD (ver abajo)

Creación canónica (inmediata, idempotente):
- crear/actualizar `Space` seeds:
  - layout-derived space (`sp.kitchen_living`, etc.) si aplica
  - `sp.bedroom` x `bedroomsCount` si aplica
  - `sp.bathroom` x `bathroomsCount`
- crear/actualizar `BedConfiguration` seeds para cada dormitorio/zona

### Paso “Llegada y check-in”

Inputs:
- check-in/out:
  - `checkInStart`, `checkInEnd`, `checkOutTime` (required)
- `primaryAccessMethod` (enum de access_methods, required)
- `isAutonomousCheckin` (boolean, default por método)
- `hasBuildingAccess` (boolean, si propertyType requiere building o roomType != entire_place)
- building access methods (si `hasBuildingAccess=true`) — guided
- parking options + accessibility features (capturados en `accessMethodsJson`)

Writes:
- `Property.checkInStart/checkInEnd/checkOutTime`
- `Property.primaryAccessMethod`
- `Property.isAutonomousCheckin/hasBuildingAccess`
- `Property.accessMethodsJson` (parking + accessibility)

### Revisión y creación “usable”

Pantalla final:
- resumen (tipo, ubicación, capacidad, llegada)
- warnings no bloqueantes (capacidad en camas vs maxGuests si plan incompleto)
- CTA “Crear propiedad usable”

Endpoint recomendado:
- `POST /api/properties/create-usable` (ya existe en contratos)

## Qué se crea canónicamente vs qué se queda en WizardResponse

### Regla

- Si el dato es parte del modelo canónico y se reutiliza en múltiples módulos → escribirlo en su entidad canónica.
- WizardResponse siempre guarda el raw.

### Tabla de decisiones

| Pregunta | Canonical now? | Entidad | Motivo |
|---|---|---|---|
| propertyType/roomType/layoutKey | sí | `Property` | gating de spaces, amenities, systems |
| ubicación y timezone | sí | `Property` | necesario para mensajería y guide |
| capacidad maxGuests | sí | `Property` | comparación con camas + export OTA |
| plan de camas | sí (si respondido) | `BedConfiguration` | evita duplicar captura; habilita warnings |
| políticas detalladas | no | (posterior en Policies) | UX-first, no bloquear |
| contactos | no | (posterior en Contacts) | UX-first, no bloquear |

## Tabla completa: pregunta_wizard → campo_BD → sección_workspace

| pregunta_wizard | campo_BD | sección_workspace afectada |
|---|---|---|
| wizard.nickname | Property.propertyNickname | Overview + Basics |
| wizard.propertyType | Property.propertyType | Basics + filtros globales |
| wizard.roomType | Property.roomType | Basics + Spaces |
| wizard.layoutKey | Property.layoutKey (nuevo) | Spaces + filtros |
| wizard.propertyEnvironment | Property.propertyEnvironment (nuevo) | Amenities + Local Guide |
| wizard.country | Property.country | Basics |
| wizard.city | Property.city | Basics |
| wizard.timezone | Property.timezone | Messaging + automations |
| wizard.maxGuests | Property.maxGuests | Basics + Spaces |
| wizard.bedroomsCount | Property.bedroomsCount | Spaces |
| wizard.bathroomsCount | Property.bathroomsCount | Spaces |
| wizard.bedPlan[*] | BedConfiguration + Space (seeded) | Spaces |
| wizard.checkInStart | Property.checkInStart | Arrival |
| wizard.checkInEnd | Property.checkInEnd | Arrival |
| wizard.checkOutTime | Property.checkOutTime | Arrival |
| wizard.primaryAccessMethod | Property.primaryAccessMethod | Arrival |
| wizard.buildingAccess | Property.accessMethodsJson | Arrival |
| wizard.parking | Property.accessMethodsJson.parking | Arrival |
| wizard.accessibility | Property.accessMethodsJson.accessibility | Arrival |

## Reglas de adaptatividad (sin hardcode)

Todas las dependencias `shown_if` y defaults deben vivir en:
- `taxonomies/dynamic_field_rules.json` (cross-field)
- `src/config/schemas/wizard-steps.ts` (declarativo)

Ejemplos de reglas:
- si `roomType != rt.entire_place` → ocultar `layoutKey`
- si `layoutKey = layout.studio` → `bedroomsCount=0` + ocultar dormitorio builder
- si `bedroomsCount = 0` y layout != studio/loft → warning y prompt para revisar
