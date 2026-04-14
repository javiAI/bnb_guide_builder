# SYNC_CONTRACTS

Versión: 2026-04-14  
Idioma visible: es-ES  
IDs internos: inglés  
Unidades: sistema métrico  

## Resumen ejecutivo

La sincronización fiable es el pegamento del producto: sin ella aparecen desincronizaciones de capacidad (P2), duplicación de captura (P5) y filtros inconsistentes (P6). Este documento define:

- un contrato de eventos → acciones (qué se recalcula cuando cambia X),
- qué campos son **computed** y quién los calcula,
- criterios cuantitativos de completeness por sección,
- y un motor declarativo unificado de condiciones para disponibilidad de spaces/systems/amenities/policies/contacts.

El principio “single source of truth” se implementa con **ownership explícito**: cada hecho tiene un write-owner canónico (Property service, Space service, System service, Amenity service). Las vistas y outputs consumen el mismo estado derivado, evitando lógica duplicada en React.

## Contrato de sincronización: eventos → acciones

### Tabla de eventos

| Evento (mutación) | Owner | Acciones síncronas (en la misma request) | Acciones derivadas (post-commit) |
|---|---|---|---|
| `Property.propertyType/roomType/layoutKey` cambia | Property service | validar compatibilidad + escribir Property | recalcular disponibilidad de espacios; recomputar requiredSlots; generar warnings; recalcular derived amenities (por spaces/systems) |
| `Property.maxGuests/maxAdults/maxChildren/infantsAllowed` cambia | Property service | validar rangos | recalcular warnings capacidad y preconditions (amenities infantiles, etc.) |
| `Space` creado/actualizado/archivado | Space service | validar `spaceType` permitido por contexto | recomputar conteos reales; recomputar cap. por camas; actualizar coverage defaults de systems; actualizar derivaciones de amenities |
| `BedConfiguration` cambia | Space service | validar bedType y configJson | recomputar `sleepingCapacity` por espacio y propiedad; recomputar warnings capacidad |
| `PropertySystem` creado/actualizado | System service | validar subtype fields por taxonomía | recomputar derived amenities vinculados (wifi/heating/cooling/etc.); invalidar caches de guía/AI si aplica |
| `PropertySystemCoverage` cambia | System service | validar espacio pertenece a property | recomputar derivados; recalcular completeness de Systems |
| `AmenityInstance` creado/actualizado | Amenity service | validar subtype y visibilidad | recomputar completeness de Amenities; recalcular troubleshooting links |
| `AmenityPlacement` cambia | Amenity service | validar spaceId | recomputar lista efectiva por espacio; recomputar completeness |
| `Policies` cambia | Property service | validar schema según taxonomía | recomputar preconditions (amenities y secciones) + warnings cross |
| `Access` cambia | Property service | validar + secretos en vault | recomputar derivados (parking→amenities), recomputar publish readiness |

### Reglas de implementación

- **Síncrono**: validación de integridad y persistencia canónica.
- **Derivado**: recomputar computed fields y caches. Se puede hacer inline o con job.

Recomendación pragmática:
- Mantener un servicio `PropertyDerivedService.recompute(propertyId)` y llamarlo al final de toda mutación relevante (con debounce a nivel API si es necesario).

## Computed fields

| Campo computado | Definición | Fuente base | Quién lo calcula | Dónde se muestra |
|---|---|---|---|---|
| `derived.sleepingCapacityTotal` | suma de camas (capacidad) | `BedConfiguration` + `bed_types` | server | Overview + Spaces |
| `derived.sleepingCapacityBySpace` | por espacio | idem | server | Space header |
| `derived.actualBedroomsCount` | # espacios `sp.bedroom` activos | `Space` | server | Basics + Spaces |
| `derived.actualBathroomsCount` | # `sp.bathroom` activos | `Space` | server | Basics + Spaces |
| `derived.spaceAvailability` | `{requiredSlots,recommended,optional,excluded,warnings}` | property context + rules | server | CreateSpaceForm + warnings |
| `derived.systemCoverageBySpace` | systems aplicables por espacio | `PropertySystem` + coverage | server | Space detail |
| `derived.amenitiesEffectiveBySpace` | amenities configurables + derivados | instances + placements + derivations | server | Space detail + guía |
| `derived.sectionCompleteness` | score por módulo | completeness rules | server | Overview + sidebar |
| `derived.publishReadiness` | boolean + reasons | completeness + media + required fields | server | Publishing |

### Persistir estado derivado (opcional)

Si el coste de cálculo por request es alto, añadir tabla cache:

```prisma
model PropertyDerived {
  propertyId String @id @map("property_id")
  derivedJson Json @map("derived_json")
  recomputedAt DateTime @map("recomputed_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  property Property @relation(fields:[propertyId], references:[id], onDelete: Cascade)

  @@map("property_derived")
}
```

Regla: esto es cache; la autoridad sigue en entidades canónicas.

## Completeness por sección

### Principios

- Completeness guía, no bloquea (salvo en Publishing).
- Reglas versionadas y expressed en config (`completeness_rules.json` recomendado si queréis 100% config-driven).

### Espacios (score 0–100)

Propuesta de scoring:

- 40 pts: todos los `requiredSlots` cubiertos
- 30 pts: cada dormitorio activo tiene ≥1 cama con capacidad>0
- 10 pts: baños tienen fixtures mínimos (si el feature existe en taxonomy)
- 10 pts: nombres no vacíos
- 10 pts: no hay espacios `excluded` en estado `active`

Umbrales:
- ≥70: listo para amenities
- ≥90: listo para publicación (por spaces)

### Equipamiento (score 0–100)

- 40 pts: essentials (según contexto) confirmados/derivados:
  - internet configurado (system)
  - cocina presente o kitchenette (space-derived) si aplica
  - ropa de cama/toallas (amenity o derived)
- 30 pts: equipamiento clave por espacio relevante (mínimos por guías)
- 30 pts: instrucciones mínimas en items críticos (wifi, acceso, climatización) con visibilidad correcta

Umbrales:
- ≥60: guía básica
- ≥85: export OTA recomendado

### Sistemas (score 0–100)

- 60 pts: sistemas core configurados cuando aplican (internet, hot_water, electricidad)
- 40 pts: coverage revisada o heredada sin conflictos

## Validaciones cruzadas

- `maxGuests` vs `sleepingCapacityTotal`
- `infantsAllowed=false` con presencia de cuna/baby items
- `roomType=private_room` pero existen spaces incompatibles (kitchen privada, etc.)
- `layoutKey` y presencia de spaces incompatibles
- visibilidad: `sensitive` nunca se serializa en endpoints guest/AI

## Motor condicional unificado (declarativo)

### Objetivo

Un solo evaluador para:
- spaces availability
- systems suggestions
- amenities catalog por espacio
- policies/fields gating
- contacts suggestions

Firma:

`evaluateItemAvailability(itemRules, propertyContext) -> { available: boolean, reasons: string[] }`

### DSL propuesto

```jsonc
{
  "allOf": [
    { "propertyType": { "in": ["pt.villa", "pt.house"] } },
    { "roomType": { "equals": "rt.entire_place" } },
    { "propertyEnvironment": { "in": ["env.rural", "env.beach"] } },
    { "propertyFields": { "maxGuests": { "gte": 6 }, "infantsAllowed": true } },
    { "requiresSpaces": ["sp.garden"] },
    { "requiresSystems": ["sys.pool_maintenance"] },
    { "requiresAmenities": ["am.bbq_grill"] }
  ],
  "not": {
    "propertyFields": { "floorLevel": { "gt": 0 }, "hasElevator": false }
  }
}
```

### Operadores soportados

- `equals`
- `in` / `notIn`
- `gt` / `gte` / `lt` / `lte`
- `exists`
- `truthy` / `falsy`
- `containsAny` / `containsAll`
- combinadores: `allOf`, `anyOf`, `not`

Regla de combinación: AND implícito entre claves; `allOf` y `anyOf` anidables.

### Precedencia y orden de evaluación

1) `not` (si se cumple, item no disponible)
2) `allOf` (todas deben cumplirse)
3) `anyOf` (al menos una debe cumplirse)
4) reglas simples (`propertyType`, `roomType`, `propertyFields`, `requires*`)

### Ciclos en `requiresAmenities/requiresSystems`

- Los requires se evalúan contra el set actual de seleccionados.
- El bundle validator debe detectar ciclos en taxonomías y fallar build.

### PropertyContext (shape)

```ts
type PropertyContext = {
  property: {
    id: string
    propertyType?: string
    roomType?: string
    layoutKey?: string
    propertyEnvironment?: string
    floorLevel?: number
    hasElevator?: boolean
    maxGuests?: number
    maxChildren?: number
    infantsAllowed?: boolean
  }
  spaces: Array<{ id: string, spaceType: string }>
  systems: string[] // systemKeys activos
  amenities: string[] // amenityKeys efectivos (instancias activas)
}
```

### Pseudocódigo evaluateItemAvailability

```ts
function evaluateItemAvailability(rules, ctx) {
  // 0) si no hay rules → available=true
  // 1) eval not
  // 2) eval allOf
  // 3) eval anyOf
  // 4) eval condiciones atómicas
  // 5) return {available, reasons}
}
```
