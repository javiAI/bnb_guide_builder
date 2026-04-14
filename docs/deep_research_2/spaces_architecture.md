# SPACES_ARCHITECTURE

Versión: 2026-04-14  
Idioma visible: es-ES  
IDs internos: inglés  
Unidades: sistema métrico  

## Resumen ejecutivo

La sección **Espacios** debe convertirse en el inventario estructural canónico de una propiedad. La arquitectura propuesta resuelve:

- P1: los espacios combinados (estudio, loft, cocina-salón, etc.) son **derivados de `Property.layoutKey`** y por tanto no se pueden “contradecir” añadiendo espacios incompatibles.
- P2: la capacidad total se consolida automáticamente a nivel de propiedad, se compara con `maxGuests` y se muestra con avisos accionables.
- P5/P6: el wizard crea (y re-sincroniza) `Space` y `BedConfiguration` de forma determinista, y el workspace filtra opciones dinámicamente en función del contexto.
- P7: Espacios pasa a ser un “centro de verdad” para todo lo que depende de layout/capas de sleeping/amenities por estancia.

El núcleo técnico es un **motor unificado de disponibilidad** que devuelve un objeto `{requiredSlots, recommendedTypes, optionalTypes, excludedTypes, warnings}` dado un `PropertyContext`. Esto reemplaza la lógica parcial actual basada solo en `roomType+layoutKey`.

## Modelo conceptual

### Dos capas: tipos vs instancias

- `spaceType` (taxonomía): define el tipo de estancia (ej. `sp.bedroom`).
- `Space` (DB): instancia concreta (ej. “Dormitorio principal”), con `featuresJson` según `space_features.json` y `BedConfiguration` como inventario de camas.

### “Slots” requeridos (conteo guiado)

Para eliminar ambigüedad con `bedroomsCount/bathroomsCount`, el motor genera **slots**:

- `slot.bedroom[1..N]`
- `slot.bathroom[1..M]`
- `slot.layout_primary` (si layout deriva un espacio: `sp.studio`, `sp.loft`, `sp.kitchen_living`, etc.)

Un slot es una expectativa UX (“debería existir un espacio de este tipo”), no una entidad en DB. Se usa para completeness y warnings.

## Matriz de disponibilidad de espacios

### Regla base (actual) y extensión (propuesta)

La matriz base existente (según `space_availability_rules`) es:

**rt.entire_place (por layoutKey)**

| roomType | layoutKey | required | recommended | optional | excluded |
| --- | --- | --- | --- | --- | --- |
| rt.entire_place | layout.separate_rooms | sp.bathroom | sp.kitchen, sp.living_room, sp.bedroom | sp.dining, sp.office, sp.laundry, sp.balcony, sp.patio, sp.garden, sp.garage, sp.storage, sp.pool, sp.other | sp.shared_area, sp.studio, sp.loft, sp.open_plan, sp.kitchen_living, sp.kitchen_dining_living |
| rt.entire_place | layout.kitchen_living | sp.bathroom | sp.kitchen_living, sp.bedroom | sp.dining, sp.office, sp.laundry, sp.balcony, sp.patio, sp.garden, sp.garage, sp.storage, sp.pool, sp.other | sp.kitchen, sp.living_room, sp.shared_area, sp.studio, sp.loft, sp.open_plan, sp.kitchen_dining_living |
| rt.entire_place | layout.kitchen_dining_living | sp.bathroom | sp.kitchen_dining_living, sp.bedroom | sp.office, sp.laundry, sp.balcony, sp.patio, sp.garden, sp.garage, sp.storage, sp.pool, sp.other | sp.kitchen, sp.living_room, sp.dining, sp.shared_area, sp.studio, sp.loft, sp.open_plan, sp.kitchen_living |
| rt.entire_place | layout.open_plan_living_dining | sp.bathroom | sp.kitchen, sp.open_plan, sp.bedroom | sp.office, sp.laundry, sp.balcony, sp.patio, sp.garden, sp.garage, sp.storage, sp.pool, sp.other | sp.living_room, sp.dining, sp.shared_area, sp.studio, sp.loft, sp.kitchen_living, sp.kitchen_dining_living |
| rt.entire_place | layout.studio | sp.bathroom, sp.studio |  | sp.office, sp.balcony, sp.patio, sp.garden, sp.storage, sp.pool, sp.other | sp.bedroom, sp.living_room, sp.kitchen, sp.dining, sp.laundry, sp.garage, sp.shared_area, sp.loft, sp.open_plan, sp.kitchen_living, sp.kitchen_dining_living |
| rt.entire_place | layout.loft | sp.bathroom, sp.loft | sp.kitchen | sp.dining, sp.balcony, sp.patio, sp.garden, sp.garage, sp.storage, sp.pool, sp.other | sp.bedroom, sp.living_room, sp.shared_area, sp.studio, sp.open_plan, sp.kitchen_living, sp.kitchen_dining_living |

**roomTypes no-entire_place (layout no aplica)**

| roomType | layoutKey | required | recommended | optional | excluded |
| --- | --- | --- | --- | --- | --- |
| rt.private_room | (none) | sp.bedroom, sp.bathroom | sp.shared_area | sp.office, sp.balcony, sp.storage, sp.other | sp.kitchen, sp.living_room, sp.dining, sp.laundry, sp.garden, sp.garage, sp.pool, sp.studio, sp.loft, sp.open_plan, sp.kitchen_living, sp.kitchen_dining_living |
| rt.shared_room | (none) | sp.shared_area |  | sp.balcony, sp.storage, sp.other | sp.bedroom, sp.kitchen, sp.living_room, sp.dining, sp.office, sp.laundry, sp.patio, sp.garden, sp.garage, sp.pool, sp.studio, sp.loft, sp.open_plan, sp.kitchen_living, sp.kitchen_dining_living |
| rt.hotel_room | (none) | sp.bedroom, sp.bathroom |  | sp.balcony, sp.storage, sp.other | sp.kitchen, sp.living_room, sp.dining, sp.office, sp.laundry, sp.patio, sp.garden, sp.garage, sp.pool, sp.shared_area, sp.studio, sp.loft, sp.open_plan, sp.kitchen_living, sp.kitchen_dining_living |
| rt.other | (none) | sp.bathroom | sp.bedroom | sp.office, sp.balcony, sp.storage, sp.other | sp.open_plan, sp.kitchen_living, sp.kitchen_dining_living |

Extensión propuesta: añadir propertyType y propertyEnvironment para modular recommended/optional y reducir ruido.

### Tabla de decision: propertyType → sesgo de espacios (aplicable sobre la regla base)

> Nota: esto no “prohíbe” físicamente; clasifica como recommended/optional y reduce ruido en UI. Para casos raros, el UI debe permitir “Añadir un espacio no común” (buscador) que muestra opcionales avanzados bajo confirmación.

| propertyType | Sesgo recomendado (añadir a recommended) | Sesgo opcional (añadir a optional) | Sesgo opcional avanzado (no mostrar por defecto) |
|---|---|---|---|
| `pt.apartment` | `sp.balcony`, `sp.storage` | `sp.office`, `sp.laundry` | `sp.garden`, `sp.garage`, `sp.pool` |
| `pt.house` | `sp.patio`, `sp.garden` | `sp.garage`, `sp.storage`, `sp.laundry` | — |
| `pt.villa` | `sp.pool`, `sp.garden`, `sp.patio` | `sp.garage`, `sp.dining`, `sp.office` | — |
| `pt.cabin` | `sp.storage` | `sp.patio`, `sp.garden` | `sp.garage`, `sp.pool` |
| `pt.secondary_unit` | `sp.patio`, `sp.storage` | `sp.office`, `sp.laundry` | `sp.garden`, `sp.garage`, `sp.pool` |
| `pt.bed_and_breakfast` | `sp.shared_area` | `sp.dining` | `sp.garage`, `sp.pool` |
| `pt.boutique_hotel` | `sp.shared_area` | `sp.dining`, `sp.storage` | `sp.garden`, `sp.garage`, `sp.pool` |
| `pt.unique_space` | — | `sp.other`, `sp.patio` | — |
| `pt.other` | — | — | — |

### Regla por roomType (resumen)

| roomType | requiredSlots (mínimo) | recomendados (baseline) | excluidos clave |
|---|---|---|---|
| `rt.entire_place` | 1 baño + (layout space si aplica) | cocina o espacio combinado + (salón si aplica) | `sp.shared_area` |
| `rt.private_room` | 1 dormitorio + 1 baño (privado o compartido) | `sp.shared_area` | cocina/salón como estancias “propias” |
| `rt.shared_room` | 1 dormitorio | `sp.shared_area` | cocina/salón como estancias “propias” |
| `rt.hotel_room` | 1 dormitorio + baño (según privacidad) | `sp.shared_area` | `sp.kitchen`, `sp.laundry` (por defecto) |
| `rt.other` | fallback tolerante | fallback | — |

**Detalle implementable:** mantener la matriz actual de `space_availability_rules` como autoridad base y aplicar overlays por `propertyType` / `environment`.

## Espacios combinados: resolución definitiva

### Decisión

Mantener los `spaceTypes` combinados en taxonomía (para compatibilidad y render genérico), pero marcarlos como **derivados por layout**, no “creables libremente”.

- `layout.studio` ⇒ espacio derivado: `sp.studio`
- `layout.loft` ⇒ `sp.loft`
- `layout.kitchen_living` ⇒ `sp.kitchen_living`
- `layout.kitchen_dining_living` ⇒ `sp.kitchen_dining_living`
- `layout.open_plan_living_dining` ⇒ `sp.open_plan`

### Reglas

1. Si `layoutKey` deriva un spaceType, ese spaceType es **required slot** y su instancia se gestiona vía “Cambiar layout” (no desde “Añadir espacio”).
2. `CreateSpaceForm` muestra solo `recommended + optional` y esconde `optional avanzados` detrás de buscador con confirmación.
3. Si existen espacios “excluidos” en DB, no se borran automáticamente: se marcan como **incompatibles** y se ofrece acción de “resolver”.

### Cambio de layout: operación guiada (sin pérdida silenciosa)

- Siempre presentar “plan de migración” antes de ejecutar.
- Acciones disponibles:
  - **Convertir** (merge/split)
  - **Archivar** (mantener pero fuera de guía y fuera de export OTA)
  - **Cancelar** (volver atrás)

**Archivar** requiere un campo explícito:
- `Space.status = active|archived` (propuesto)

## Capacidad consolidada

### Definición

**Capacidad por camas** (computed):
- `sleepingCapacity = Σ (bed.quantity * bedSleepingCapacity)`
- `bt.crib` cuenta 0.
- `bt.other` usa `configJson.customCapacity` si existe; si no, usa default.

**Capacidad objetivo**:
- `Property.maxGuests` (wizard o edición en Basics)
- opcionalmente `maxAdults/maxChildren`

### Dónde se muestra (UX)

- Overview: siempre visible.
- Cabecera de Espacios: indicador y CTA.
- Editor de `maxGuests`: preview con impacto.

### Warnings exactos y acciones

| Condición | Nivel | Mensaje | Acción primaria |
|---|---|---|---|
| `sleepingCapacity==0` y `maxGuests>0` | error | “Capacidad definida pero sin camas.” | “Añadir camas” |
| `sleepingCapacity < maxGuests` | warning | “Camas para {sleepingCapacity} pero maxGuests={maxGuests}.” | “Revisar camas” |
| `sleepingCapacity > maxGuests` | warning | “Camas para {sleepingCapacity} pero maxGuests={maxGuests}.” | “Ajustar maxGuests” |
| hay camas `bt.crib` y `infantsAllowed=false` | warning | “Hay cuna pero no se admiten bebés.” | “Revisar políticas” |

## Pre-población desde wizard

### Tabla wizard → entidades canónicas

| Campo wizard | Condición | Entidad creada | Valor inicial |
|---|---|---|---|
| `layoutKey=layout.studio` | `roomType=rt.entire_place` | `Space` | `sp.studio`, name “Estudio” |
| `layoutKey=layout.loft` | `roomType=rt.entire_place` | `Space` | `sp.loft`, name “Loft” |
| `layoutKey=layout.kitchen_living` | `roomType=rt.entire_place` | `Space` | `sp.kitchen_living`, name “Cocina-salón” |
| `layoutKey=layout.kitchen_dining_living` | `roomType=rt.entire_place` | `Space` | `sp.kitchen_dining_living`, name “Cocina-comedor-salón” |
| `layoutKey=layout.open_plan_living_dining` | `roomType=rt.entire_place` | `Space` | `sp.open_plan`, name “Salón-comedor” |
| `bedroomsCount=N` | layout admite dormitorios | `Space` xN | `sp.bedroom`, name “Dormitorio {i}” |
| `bathroomsCount=M` | siempre | `Space` xM | `sp.bathroom`, name “Baño {i}” |
| “camas por dormitorio” | dormitorios existe | `BedConfiguration` | por tipo, cantidad, configJson |

### Re-sincronización wizard ↔ workspace (sin duplicar captura)

Regla: el wizard **solo** crea/actualiza entidades que fueron sembradas por wizard y no han sido “tomadas” por el usuario.

Añadir metadatos:

- `Space.createdBy` + `Space.wizardSeedKey`
- `BedConfiguration.wizardSeedKey`

Reglas de update:
- Si el usuario edita manualmente un `Space` sembrado, se marca `createdBy=user` (o se limpia seedKey), y deja de “sincronizarse” automáticamente.
- Si el wizard reduce conteos, no se elimina; se propone archivar.

## Propuesta de additions en space_features.json

### Reglas

- Los `SpaceFeatureGroup` deben seguir siendo tipados y condicionales (`shown_if`).
- No introducir en space_features conceptos “globales” (internet, calefacción central): eso vive en Systems + Coverage.

### Campos sugeridos (mínimos)

1) `sfg.access_and_privacy` (applies_to: dormitorio/estudio/loft/shared_area/other)  
- `sf.lockable_door` (boolean, guest)  
- `sf.has_blackout_curtains` (boolean, guest)  

2) `sfg.bathroom_fixtures` (applies_to: baño)  
- `sf.shower_type` (enum: walk_in|bathtub_combo|bathtub_only|none)  
- `sf.bidets_present` (boolean, guest)  

3) `sfg.sleeping_zone` (applies_to: estudio/loft)  
- `sf.sleeping_zone_separated` (boolean, guest)  
- `sf.sleeping_zone_notes` (text, guest)  
