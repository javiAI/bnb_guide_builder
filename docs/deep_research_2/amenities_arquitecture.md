# AMENITIES_ARCHITECTURE

Versión: 2026-04-14  
Idioma visible: es-ES  
IDs internos: inglés  
Unidades: sistema métrico  

## Resumen ejecutivo

La sección **Equipamiento (Amenities)** debe capturar inventario y experiencia sin contaminarla con infraestructura, ubicación o accesibilidad. Hoy el modelo `PropertyAmenity(spaceId nullable)` y el filtrado por `suggestedSpaceTypes` no soportan bien:

- amenities globales vs por espacio vs multi-espacio (P4),
- duplicación/variantes (TV en varios dormitorios con tamaños distintos),
- items “derivados” que deberían inferirse de spaces/systems (cocina, ascensor, calefacción),
- y la necesidad de mostrar solo lo relevante según el contexto de la propiedad (P6).

Este documento define: (1) una **taxonomía de scoping** clara, (2) un **modelo de datos** que soporta instancias y placements sin duplicar captura, (3) un **flujo UX** coherente desde sección global y desde cada espacio, y (4) una **auditoría completa** del catálogo actual (142 items) con destino/migración para cada uno.

La decisión clave: los conceptos de “infraestructura/servicio” viven en **Sistemas** (con cobertura por espacios). Amenities se reservan para inventario o elementos de experiencia; muchos flags OTA se **derivan** de spaces/systems para mantener single source of truth.

## Criterios de clasificación: amenity vs system vs feature vs other

### Árbol de decisión (implementable)

1) ¿Es un **servicio/infraestructura** mantenido por el host y que puede afectar a varios espacios?  
→ **System** (`PropertySystem` + coverage). Ej.: internet, calefacción, agua caliente, ascensor, alarma, pool maintenance.

2) ¿Describe la **existencia física de un espacio** o un atributo estructural del layout?  
→ **Space** (spaceType) o **Space feature** (`Space.featuresJson`). Ej.: “Patio/Balcón”, “Jardín”, “Cocina”.

3) ¿Es un **atributo de ubicación/entorno** (no inventario)?  
→ **Property attribute** (`Property.propertyEnvironment` y flags). Ej.: waterfront, ski-in/out, beach access.

4) ¿Es un **contenido textual/recomendación** (no inventario)?  
→ **Guide / Knowledge**. Ej.: “lavandería cercana”, “recomendaciones de babysitter”.

5) Si no: ¿Es un objeto/experiencia que puede existir en 0..N espacios y puede tener variantes?  
→ **Amenity instance** (inventario) con placements. Ej.: TVs, barbacoas, bicicletas, juegos.

## Modelo de scoping para amenities


## Taxonomía de scoping (global vs por-espacio vs multi)

### Categorías siempre globales (o derivadas de sistemas)

- Conectividad: `am.wifi` (derivada de `sys.internet`)
- Calefacción y refrigeración: `am.heating`, `am.air_conditioning` (derivadas de `sys.heating/sys.cooling`)
- Agua caliente: `am.hot_water` (derivada de `sys.hot_water`)
- Ascensor: `am.elevator` (derivada de `sys.elevator`)

Regla: se muestran en Equipamiento como “presentes”, pero se editan en Sistemas.

### Categorías típicamente por espacio

- Baño: secador de pelo, champú, gel, bidé, bañera (a menudo derivables por fixtures del baño, o configurables como consumibles)
- Cocina: microondas, horno, utensilios (por kitchen space)
- Dormitorios: mosquitera, oscurecimiento, almacenamiento (mejor como space features, no como amenity manual)

Regla: si se puede inferir consistentemente desde `Space.featuresJson`, marcar como `derived_from_space`.

### Categorías multi-espacio (instanciables)

- TVs, ventiladores, consolas, bicicletas, barbacoas, hamacas
- “Quantity” y “nota por ubicación” viven en placements; la configuración principal vive en la instancia.


### Tipos de scoping

- `amenity_configurable` (capturable): requiere persistencia `PropertyAmenityInstance`.
- `derived_from_space`: se infiere de `Space` y/o `Space.featuresJson` (no se persiste como amenity).
- `derived_from_system`: se infiere de `PropertySystem` y/o coverage.
- `derived_from_access`: se infiere del módulo Access (parking, etc.).
- `moved_to_*`: reclasificación fuera de Amenities.

### Reglas de UI por tipo

| Tipo | ¿Se muestra en Equipamiento? | ¿Se puede editar aquí? | Acción principal |
|---|---|---|---|
| configurable | sí | sí | “Añadir” / “Asignar a espacios” |
| derived_from_space | sí (con badge) | no | “Editar espacio/feature” |
| derived_from_system | sí (con badge) | no | “Editar sistema” |
| derived_from_access | sí (con badge) | no | “Editar llegada/parking” |
| moved_to_* | no | n/a | n/a |

## Modelo de datos definitivo

### Problema del modelo actual

`PropertyAmenity` con `spaceId nullable` fuerza duplicar filas para cubrir multi-espacio y no soporta bien el caso: “una instancia se comparte por varios espacios”.

### Propuesta

1) Renombrar el concepto canónico a **instancia** (lo que existe y puede tener configuración):
- `PropertyAmenityInstance` (o mantener el nombre `PropertyAmenity` pero semántica de instancia)

2) Añadir tabla de **placements**:
- `PropertyAmenityPlacement`

#### Prisma propuesto

```prisma
enum VisibilityLevel {
  guest
  ai
  internal
  sensitive
}

model PropertyAmenityInstance {
  id         String   @id @default(cuid())
  propertyId String   @map("property_id")
  amenityKey String   @map("amenity_key") // FK amenity_taxonomy.json
  subtypeKey String?  @map("subtype_key") // FK amenity_subtypes.json
  instanceKey String  @default("default") @map("instance_key")
  detailsJson Json?   @map("details_json") // typed via amenity_subtypes fields (public where apply)
  guestInstructions String? @map("guest_instructions")
  aiInstructions    String? @map("ai_instructions")
  internalNotes     String? @map("internal_notes")
  troubleshootingNotes String? @map("troubleshooting_notes")
  visibility VisibilityLevel @default(guest)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  placements PropertyAmenityPlacement[]

  @@unique([propertyId, amenityKey, instanceKey])
  @@index([propertyId])
  @@map("property_amenity_instances")
}

model PropertyAmenityPlacement {
  id        String @id @default(cuid())
  amenityId String @map("amenity_id")
  spaceId   String @map("space_id")
  quantity  Int?   @map("quantity")
  note      String? @map("note")

  amenity PropertyAmenityInstance @relation(fields:[amenityId], references:[id], onDelete: Cascade)
  space   Space @relation(fields:[spaceId], references:[id], onDelete: Cascade)

  @@unique([amenityId, spaceId])
  @@index([spaceId])
  @@map("property_amenity_placements")
}
```

#### Semántica

- Un amenity property-level se representa como instance sin placements (o con placement “virtual” property).
- Un amenity por espacio: una instance con 1 placement.
- Un amenity multi-espacio: una instance con varios placements.
- Variantes: múltiples instances con distinto `instanceKey` (ej. `tv.living` y `tv.bedroom1`).

### Migración desde el modelo actual

**Input legacy**: `PropertyAmenity(propertyId, amenityKey, spaceId?, subtypeKey?, guestInstructions, ...)`

Migración:
- Crear `PropertyAmenityInstance` por cada fila legacy:
  - `instanceKey = (spaceId ? "space:" + spaceId : "default")` (o generar ordinal estable)
- Si legacy tenía `spaceId`, crear placement con ese `spaceId`.
- Si legacy tenía `spaceId NULL`, no crear placements.

Optimización opcional post-migración:
- detectar instancias idénticas (mismo amenityKey + mismos detalles + mismos textos) y fusionar placements.

## Flujo UX completo

### Entrada principal: sección Equipamiento (global)

Wireframe textual:

- Header: “Equipamiento”
  - buscador
  - chips de filtros: “Solo esenciales”, “Por estancias”, “Derivados”, “Faltan por completar”
- Bloque “Sugeridos para esta propiedad” (top 10)
- Bloque por grupos semánticos (desde taxonomía): Baño, Cocina, Entretenimiento, Exterior, etc.

Para cada item:
- toggle “Disponible”
- si configurable:
  - selector “¿Dónde está?”:
    - “General (toda la propiedad)”
    - lista de espacios relevantes (checkbox)
    - atajos: “Aplicar a todos los dormitorios / baños”
  - botón “Detalles” (abre formulario de subtipo + instrucciones)
- si derivado:
  - badge: “Se configura en Sistemas/Espacios/Acceso”
  - CTA hacia el módulo dueño

### Entrada secundaria: dentro de cada Space

En la ficha del espacio:
- subpanel “Equipamiento de este espacio”
  - lista corta de suggestions (solo suggestedSpaceTypes contiene este spaceType)
  - CTA “Añadir equipamiento a este espacio”
  - al seleccionar un amenity:
    - si existe una instance global compatible, ofrecer:
      - “Usar existente” + añadir placement
      - “Crear una variante” (nuevo instanceKey)

### Deduplicación UX (reglas)

- Si el usuario intenta añadir el mismo amenityKey a múltiples espacios:
  - por defecto se comparte la misma instance.
  - solo se duplica si el usuario toca un campo de configuración que la hace distinta (confirmación explícita: “crear variante”).

## Relación con Incidencias (Troubleshooting)

`TroubleshootingPlaybook` hoy es property-level. Se debe poder vincular de forma canónica:

- con un system (`systemKey`) — ej. internet
- con un amenityKey (instance) — ej. BBQ
- con un espacio (`spaceId`) — ej. ducha baño 2

Propuesta mínima en Prisma:
- añadir a `TroubleshootingPlaybook`:
  - `systemKey String?`
  - `amenityKey String?`
  - `spaceId String?`
  - (opcional) `accessMethodKey String?`

En UI:
- en cada `PropertySystem` y `PropertyAmenityInstance`, mostrar “Troubleshooting relacionado” (lista de playbooks) + CTA “Crear playbook”.

## Auditoría completa del catálogo actual (142 items)

Leyenda de destinos:
- `amenity_configurable`: se mantiene como amenity instanciable.
- `derived_from_space`: se deriva de spaces/features.
- `derived_from_system`: se deriva de systems.
- `derived_from_access`: se deriva de access/parking.
- `moved_to_system`: pasa a Systems (nuevo systemKey).
- `moved_to_access`: pasa a Access/Accessibility.
- `moved_to_property_attribute`: pasa a Property (atributos de entorno/acceso).
- `moved_to_guide_content`: pasa a Guide/Knowledge.

### Matriz de cobertura (amenity_id → destino → migración)

| amenity_id | destination | target | migration_note |
| --- | --- | --- | --- |
| am.wifi | derived_from_system | sys.internet | La configuración vive en Systems (canonicalOwner). Este item se exporta como amenity derivada. |
| am.kitchen | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.air_conditioning | derived_from_system | sys.cooling | La configuración vive en Systems (canonicalOwner). Este item se exporta como amenity derivada. |
| am.washer | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.free_parking | derived_from_access | parking_options | Se deriva desde la configuración de parking del módulo Access para export OTA. |
| am.iron | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.bathtub | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.bidet | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.body_soap | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.cleaning_products | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.conditioner | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.hair_dryer | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.hot_water | derived_from_system | sys.hot_water | La configuración vive en Systems (canonicalOwner). Este item se exporta como amenity derivada. |
| am.outdoor_shower | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.shampoo | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.shower_gel | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.bed_linens | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.clothing_storage | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.dryer | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.drying_rack | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.essentials | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.extra_pillows_blankets | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.hangers | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.mosquito_net | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.room_darkening_shades | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.safe | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.arcade_games | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.batting_cage | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.books_reading | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.bowling_alley | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.climbing_wall | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.ethernet | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.exercise_equipment | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.game_console | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.laser_tag | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.life_size_games | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.mini_golf | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.movie_theater | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.piano | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.ping_pong | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.pool_table | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.record_player | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.skate_ramp | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.sound_system | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.theme_room | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.tv | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.baby_bath | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.baby_monitor | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.baby_safety_gates | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.babysitter_recs | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.board_games | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.changing_table | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.childrens_playroom | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.childrens_bikes | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.childrens_books_toys | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.childrens_dinnerware | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.crib | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.fire_screen | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.high_chair | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.outdoor_playground | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.outlet_covers | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.pack_n_play | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.table_corner_guards | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.window_guards | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.ceiling_fan | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.heating | derived_from_system | sys.heating | La configuración vive en Systems (canonicalOwner). Este item se exporta como amenity derivada. |
| am.indoor_fireplace | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.portable_fans | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.co_alarm | moved_to_system | sys.co_detector | Seguridad/infraestructura. Debe vivir como System para herencia/coverage y playbooks. |
| am.fire_extinguisher | moved_to_system | sys.fire_extinguisher | Seguridad/infraestructura. Debe vivir como System para herencia/coverage y playbooks. |
| am.first_aid_kit | moved_to_system | sys.first_aid_kit | Seguridad/infraestructura. Debe vivir como System para herencia/coverage y playbooks. |
| am.smoke_alarm | moved_to_system | sys.smoke_detector | Seguridad/infraestructura. Debe vivir como System para herencia/coverage y playbooks. |
| am.dedicated_workspace | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.pocket_wifi | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.baking_sheet | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.bbq_utensils | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.blender | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.bread_maker | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.coffee | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.coffee_maker | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.cooking_basics | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.dining_table | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.dishes_silverware | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.dishwasher | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.freezer | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.kettle | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.kitchenette | derived_from_space | sp.studio|sp.loft | Es tipo/layout de cocina, no inventario; se deriva por spaceType/features. |
| am.microwave | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.mini_fridge | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.oven | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.refrigerator | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.rice_maker | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.stove | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.toaster | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.trash_compactor | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.wine_glasses | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.beach_access | moved_to_property_attribute |  | Es atributo de ubicación/entorno; debe vivir en Property (y/o propertyEnvironment). |
| am.lake_access | moved_to_property_attribute |  | Es atributo de ubicación/entorno; debe vivir en Property (y/o propertyEnvironment). |
| am.laundromat_nearby | moved_to_guide_content | local_guide | Es recomendación/guía local, no equipamiento. |
| am.private_entrance | moved_to_property_attribute | Property.hasPrivateEntrance | Es atributo estructural de privacidad/acceso, no equipamiento. |
| am.resort_access | moved_to_property_attribute |  | Es atributo de ubicación/entorno; debe vivir en Property (y/o propertyEnvironment). |
| am.ski_in_out | moved_to_property_attribute |  | Es atributo de ubicación/entorno; debe vivir en Property (y/o propertyEnvironment). |
| am.waterfront | moved_to_property_attribute |  | Es atributo de ubicación/entorno; debe vivir en Property (y/o propertyEnvironment). |
| am.backyard | derived_from_space | sp.garden | Existe si hay espacio exterior (patio/jardín); no es equipamiento. |
| am.bbq_grill | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.beach_essentials | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.bikes | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.boat_slip | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.fire_pit | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.hammock | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.kayak | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.outdoor_dining_area | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.outdoor_furniture | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.outdoor_kitchen | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.patio_balcony | derived_from_space | sp.balcony|sp.patio | Se deriva de la existencia de balcón/patio; no es un item de inventario. |
| am.sun_loungers | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.elevator | derived_from_system | sys.elevator | Debe derivarse del System sys.elevator (infraestructura edificio). |
| am.ev_charger | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.free_parking_premises | moved_to_access | parking_options | Se modela como opción de parking en Access (parking_options), no como amenity. |
| am.free_street_parking | moved_to_access | parking_options | Se modela como opción de parking en Access (parking_options), no como amenity. |
| am.gym | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.hockey_rink | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.hot_tub | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.paid_parking_off_premises | moved_to_access | parking_options | Se modela como opción de parking en Access (parking_options), no como amenity. |
| am.paid_parking_on_premises | moved_to_access | parking_options | Se modela como opción de parking en Access (parking_options), no como amenity. |
| am.pool | derived_from_space |  | Derivado de espacios/features (no se captura en PropertyAmenity). |
| am.private_living_room | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.sauna | amenity_configurable |  | Amenity configurable (inventario/experiencia). |
| am.single_level_home | moved_to_access | accessibility_features | Es atributo de accesibilidad (no equipamiento). |
| ax.step_free_guest_entrance | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.guest_entrance_wide_81cm | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.accessible_parking_spot | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.step_free_path_to_entrance | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.step_free_bedroom_access | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.bedroom_entrance_wide_81cm | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.step_free_bathroom_access | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.bathroom_entrance_wide_81cm | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.shower_grab_bar | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.toilet_grab_bar | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.step_free_shower | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.shower_bath_chair | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |
| ax.ceiling_mobile_hoist | moved_to_access |  | Este item es un accessibility_feature (ax.*) y debe capturarse en Acceso/Accesibilidad, no como amenity. |

## Propuesta de additions a amenity_taxonomy (si se decide ampliar)

Estas additions se justifican por valor para guía/operación y porque son frecuentes en inventarios reales. Si se añaden, deben incluir `source` (si existe) o marcar `unspecified` hasta mapear.

- `am.hand_soap` (jabón de manos) — común en baños.
- `am.dish_soap` (lavavajillas manual) — cocina.
- `am.laundry_detergent` (detergente) — relevante si hay lavadora.
- `am.air_purifier` (purificador) — relevante en entornos urbanos o alérgenos.
- `am.humidifier` / `am.dehumidifier` — relevante en montaña/lago.
- `am.cork_screw` (sacacorchos) — cocina (detalle, pero reduce tickets).
- `am.basic_spices` (especias básicas) — opcional, para “cooking basics” granular.

Recomendación UX-first: no mostrarlos en wizard; solo como sugeridos en Equipamiento por contexto (`requiresAmenities` / spaceType kitchen/bathroom).
