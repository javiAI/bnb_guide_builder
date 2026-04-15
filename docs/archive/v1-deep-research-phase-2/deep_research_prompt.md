# Deep Research Prompt — Guide Builder Taxonomy & Conditional Intelligence Redesign

## 1. Contexto del proyecto

**Guide Builder** es una aplicación SaaS para hosts de alquiler vacacional (Airbnb, Booking, VRBO, alquileres directos). Su propósito es:

1. **Capturar** de forma estructurada toda la información de una propiedad (tipo, ubicación, capacidad, espacios, camas, sistemas de infraestructura, equipamiento, políticas, contactos, acceso, check-in).
2. **Generar automáticamente**:
   - Una guía del huésped (guest guide) personalizada y multilenguaje.
   - Plantillas y automatizaciones de mensajería para cada touchpoint del viaje.
   - Una base de conocimiento que alimenta un asistente IA que responde preguntas de huéspedes.
   - Playbooks de troubleshooting e indicadores operativos para el equipo de limpieza/mantenimiento.
3. **Exportar e importar** hacia/desde OTAs (Airbnb, Booking). Cada item de taxonomía lleva un campo `source` con mapeos (ej. `"airbnb:wifi"`, `"booking:fac_123"`). El objetivo a medio plazo es permitir push/pull completo con los catálogos oficiales de facilidades de cada plataforma.

## 2. Principios arquitectónicos no negociables

- **Config-driven**: toda taxonomía, campo condicional, regla de dependencia y mapeo a OTA vive en `/taxonomies/*.json` y `/src/config/`. La UI React consume esto; nunca hardcodea listas de opciones, items o reglas.
- **IDs/enums en inglés; labels visibles en español**.
- **Sistema métrico**.
- **Visibilidades segregadas**: cada campo declara `public | internal | sensitive | ai`. Nunca mezclar contenido guest-facing con notas internas o secretos.
- **Secretos auditados**: ningún secreto se escribe en la DB plana; van a `SecretReference` apuntando a un vault.
- **Añadir una amenity, policy, método de acceso o sección nueva = editar taxonomía/config, no código React**.
- **Compatibilidad OTA**: cualquier decisión de taxonomía debe mantener mapeos bidireccionales limpios con Airbnb y Booking.

## 3. El problema a investigar

El módulo de **Amenities / Equipamiento** está funcionalmente roto. Aunque el sistema permite categorizar items como `property_only`, `space_only` o `multi_instance`, y aplica un filtrado básico por `suggestedSpaceTypes`, `canonicalOwner`, `isDerived` y (reciente) `relevantEnvironments`, la inteligencia es insuficiente:

### Síntomas confirmados

1. **5 items contaminan TODOS los espacios** por tener `suggestedSpaceTypes: []` con `scopePolicy: multi_instance` → el detector de humo aparece en el baño, la piscina y el despacho; el kayak aparece en el dormitorio; las bicicletas infantiles en todos los espacios.
2. **Sin filtro por tipo de propiedad**: un apartamento en 3ª planta muestra `am.skate_ramp`, `am.hockey_rink`, `am.batting_cage`, `am.outdoor_playground`, `am.mini_golf`. Un estudio urbano muestra `am.boat_slip`, `am.hammock`, `am.outdoor_kitchen`.
3. **Sin preconditions entre selecciones**: `am.crib`, `am.baby_monitor`, `am.baby_bath`, `am.pack_n_play`, `am.outlet_covers`, `am.window_guards` aparecen siempre, aunque `infantsAllowed=false` y `maxChildren=0`. `am.baby_monitor` debería requerir se admitan bebes o que exista una cuna (`am.crib`) o una habitación infantil o similar.
4. **Items mal categorizados**:
   - `am.smoke_alarm`, `am.co_alarm`, `am.fire_extinguisher`, `am.first_aid_kit` son **seguridad** (deberían ser `PropertySystem` con subtipo, o checklist property-level, NO equipamiento por-espacio).
   - `am.babysitter_recs`, `am.essentials`, `am.cleaning_products`, `am.laundromat_nearby` son **contenido de guía**, no equipamiento.
   - `am.beach_access`, `am.lake_access`, `am.ski_in_out`, `am.waterfront`, `am.resort_access` son **atributos de entorno/ubicación**, no equipamiento.
   - `am.pocket_wifi` es subtipo de `sys.internet`, no amenity independiente.
5. **Items ultra-nicho sin scope claro**: `am.bowling_alley`, `am.laser_tag`, `am.batting_cage`, `am.mini_golf`, `am.climbing_wall`, `am.hockey_rink`, `am.life_size_games` aparecen en General para cualquier propiedad, aunque solo aplican a villas grandes con mucho terreno.
6. **`suggestedSpaceTypes` incorrectos o incompletos**:
   - `am.hot_tub` solo en `sp.garden`/`sp.patio` (falta `sp.bathroom`, `sp.pool`).
   - `am.exercise_equipment` solo en `sp.other`.
   - `am.fire_extinguisher` solo en `sp.kitchen` (debería ser property-wide).
   - `am.hammock` marcado property_only pero aplica a jardín, patio, terraza.

### Causa raíz

La taxonomía actual no modela:
- **Restricciones por `propertyType`** (apartment/house/villa/cabin/B&B/hotel).
- **Preconditions cruzadas** entre campos de propiedad (`infantsAllowed`, `maxChildren`, `bedroomsCount`, pisos, jardín configurado, piscina configurada).
- **Preconditions cruzadas** entre items (baby monitor requiere crib + kids-bedroom).
- **Categoría funcional real** de cada item (safety vs. entertainment vs. baby vs. outdoor vs. kitchen appliance vs. location attribute).
- **Escala/contexto mínimo requerido** (laser tag ⇒ villa con ≥X m² o ≥N dormitorios).

## 4. Objetivo de la investigación

Diseña una **arquitectura nueva y exhaustiva** para:

- **Amenities/Equipamiento** (foco principal) — redefinir el catálogo completo desde cero.
- **Sistemas** — completar el catálogo incluyendo los items de seguridad que hoy viven como amenities.
- **Motor de filtrado/inteligencia condicional** — unificar todas las reglas (`propertyType`, `roomType`, `layoutKey`, `propertyEnvironment`, flags como `infantsAllowed`, conteos, preconditions cross-item, spaces existentes, systems existentes) en un modelo declarativo en la propia taxonomía.
- **Reubicaciones** — qué items actuales salen de Amenities y a qué sección/entidad van (Systems, Guide, Property-level attributes, Access, etc.).
- **Mapeos OTA** — mantener/mejorar el campo `source` para que cada item sea exportable a Airbnb y Booking.

La solución debe:

1. **Maximizar experiencia de usuario**: el host solo debe ver opciones que tengan sentido para su propiedad concreta. Nada de ruido.
2. **Maximizar eficiencia**: la aplicación debe ser "inteligente" — inferir y sugerir, no pedir cada cosa manualmente.
3. **Cubrir todos los casos**: apartamento urbano, casa rural, villa de lujo con piscina, cabaña de montaña, B&B, habitación privada en piso compartido, suite de hotel boutique, alojamiento singular (yurt, casa árbol), ski chalet, beach house, lake house.
4. **Ser 100% config-driven**: todo debe expresarse en taxonomías JSON; nada hardcoded en React.
5. **Ser bidireccional con OTAs**: import y export limpios.

## 5. Input: estado actual

Se adjunta el archivo `current_state_snapshot.json` (383 KB) con:

- **`meta`**: contexto del producto y reglas de diseño.
- **`dataModel`**: resumen de cada modelo Prisma relevante y sus campos.
- **`captureFlow`**: pasos del wizard y secciones del editor.
- **`currentFilteringRules`**: reglas condicionales actuales detalladas para spaces, layout, features, systems, amenities, policies, contacts, access — con `gaps` y `knownBugs` explícitos.
- **`visibilityModel`**: niveles de visibilidad.
- **`taxonomies`**: TODAS las 27 taxonomías completas (property_types, room_types, space_types, space_availability_rules, space_features, bed_types, amenity_taxonomy, amenity_subtypes, system_taxonomy, system_subtypes, access_methods, building_access_methods, parking_options, accessibility_features, property_environments, policy_taxonomy, contact_types, troubleshooting_taxonomy, messaging_touchpoints, automation_channels, media_asset_roles, media_requirements, guide_outputs, visibility_levels, dynamic_field_rules, review_reasons, spanish_provinces).
- **`otaCompatibility`**: estado actual de mapeos a Airbnb/Booking.

## 6. Metodología de investigación exigida

1. **Lee el snapshot completo**. Cruza `amenity_taxonomy.items` contra `scopePolicies` para detectar todos los gaps, no solo los listados como bugs conocidos.
2. **Audita cada item** actual de `amenity_taxonomy`: decide si (a) permanece como amenity y con qué scope/precondition corregido, (b) se muda a systems, (c) se muda a guide content, (d) se muda a atributo de propiedad, (e) se elimina.
3. **Diseña un modelo nuevo de condiciones declarativas**. Propuesta mínima, pero extiende si algo falta:
   ```jsonc
   {
     "preconditions": {
       "propertyType": { "in": ["pt.villa", "pt.house"] },
       "propertyEnvironment": { "in": ["env.beach", "env.lake"] },
       "propertyFields": {
         "infantsAllowed": true,
         "maxChildren": { "gt": 0 },
         "bedroomsCount": { "gte": 3 }
       },
       "requiresSpaces": ["sp.bedroom"],
       "requiresAmenities": ["am.crib"],
       "requiresSystems": ["sys.pool_maintenance"],
       "excludedWhen": { "propertyType": "pt.apartment", "floor": { "gt": 0 } }
     }
   }
   ```
   Explica cada operador, cómo se combinan (AND implícito entre claves), y cómo se evalúan preconditions cross-item sin ciclos.
4. **Propón un motor unificado** (`evaluateItemAvailability(item, propertyContext)`) que reemplace los filtros ad-hoc dispersos en `amenities/page.tsx`, `spaces/page.tsx`, etc. Debe ser el mismo motor para amenities, systems, policies, contacts, spaces.
5. **Relista secciones desde cero**. Por cada sección dentro de Amenities (General property-wide + por-espacio para cada space type relevante), enumera la propuesta completa de items, con:
   - id, label español, descripción, `importanceLevel` (highlight/standard/bonus).
   - `scopePolicy`, `suggestedSpaceTypes`, `preconditions`, `relevantEnvironments`, `relevantPropertyTypes`.
   - `source: []` con mapeo Airbnb/Booking si existe en sus catálogos públicos.
   - Subtipo asociado (si aplica) con sus fields.
6. **Reclasifica sin perder nada**. Toda item actual debe terminar en algún sitio nuevo (Amenities, Systems, Guide, Property attributes, Access, o explícitamente eliminado con justificación).
7. **Cubre los 6 environments** (urban, beach, mountain, rural, ski, lake) y los 7 property types.
8. **Asegura que cada propiedad posible recibe un set coherente**. Simula al menos 6 propiedades distintas y documenta qué items aparecen en cada una (apartment urbano 3º piso / villa rural con piscina / cabaña ski / B&B playa / hotel boutique / yurt singular).
9. **Mantén compatibilidad OTA**. Para cada item nuevo, mapea a Airbnb (si tiene) y Booking.
10. **Respeta reglas de visibilidad**: cada campo nuevo declara visibility correcta.

## 7. Output requerido

Devuelve **dos artefactos**:

### A. `proposed_taxonomy.json` — JSON completo

Estructura mínima:

```jsonc
{
  "version": "YYYY-MM-DD",
  "locale": "es-ES",
  "unitsSystem": "metric",

  "relocations": [
    { "id": "am.smoke_alarm", "from": "amenities", "to": "systems", "newId": "sys.smoke_detector", "reason": "...", "migrationNote": "..." }
    // ... una entrada por cada item actual que cambia de sitio, con migration path
  ],

  "deletions": [
    { "id": "am.xxx", "reason": "..." }
  ],

  "newConditionEngine": {
    "operators": { /* definición declarativa */ },
    "evaluationOrder": [ /* pasos */ ],
    "precedenceRules": "..."
  },

  "amenities": {
    "groups": [ /* grupos nuevos con agrupación semántica real */ ],
    "items": [
      {
        "id": "am.xxx",
        "label": "...",
        "description": "...",
        "importanceLevel": "highlight|standard|bonus",
        "scopePolicy": "property_only|space_only|multi_instance",
        "suggestedSpaceTypes": [],
        "preconditions": { /* modelo declarativo */ },
        "relevantEnvironments": [],
        "relevantPropertyTypes": [],
        "canonicalOwner": null,
        "subtypeRef": null,
        "source": ["airbnb:...", "booking:..."],
        "visibility": "public"
      }
    ],
    "scopePolicies": { /* mapa id→policy para backward compat si se decide */ }
  },

  "systems": {
    "additions": [ /* nuevos systems absorbidos desde amenities: sys.smoke_detector, sys.co_detector, sys.fire_extinguisher, sys.first_aid, etc. */ ],
    "updatedSubtypes": [ /* fields nuevos */ ]
  },

  "propertyAttributes": {
    "additions": [ /* atributos nuevos a Property: ej. floor, hasPrivateEntrance, hasElevatorAccess, waterfront, beachAccessType, skiInOut */ ],
    "prismaFieldProposals": [ /* propuestas de campos nuevos en schema.prisma */ ]
  },

  "guideContent": {
    "movedFromAmenities": [ /* babysitter_recs, essentials list, laundromat_nearby, etc. con ubicación en guide_outputs */ ]
  },

  "spaceFeatureAdditions": [ /* items que mejor viven como space features, no amenities */ ],

  "propertyTypeConstraints": {
    "pt.apartment": { "excludedAmenities": [], "excludedSystems": [], "excludedSpaces": [] },
    "pt.house": { },
    "pt.villa": { "allowAll": true },
    "pt.cabin": { },
    "pt.secondary_unit": { },
    "pt.bed_and_breakfast": { },
    "pt.boutique_hotel": { },
    "pt.unique_space": { }
  },

  "simulations": [
    {
      "scenario": "Apartamento urbano 3ª planta, 2 dormitorios, sin niños, entorno urban",
      "property": { "propertyType": "pt.apartment", "propertyEnvironment": "env.urban", "bedroomsCount": 2, "maxChildren": 0, "infantsAllowed": false, "floor": 3 },
      "spaces": ["sp.bedroom", "sp.bedroom", "sp.bathroom", "sp.kitchen_living"],
      "expectedAmenities": {
        "general": [ /* ids */ ],
        "perSpace": { "sp.bedroom#1": [], "sp.bathroom": [], "sp.kitchen_living": [] }
      }
    }
    // mínimo 6 escenarios diversos
  ]
}
```

### B. `proposed_architecture.md` — Documento explicativo

Debe incluir:

1. **Resumen ejecutivo** (3–5 párrafos).
2. **Principios de diseño** que guían las decisiones.
3. **Arquitectura del motor condicional** — diagrama lógico, operadores, orden de evaluación, manejo de preconditions cíclicas.
4. **Criterios de clasificación**: cómo decidir si algo es amenity, system, guide content, property attribute o space feature. Árbol de decisión.
5. **Lista completa de reubicaciones** con justificación una a una.
6. **Catálogo final de amenities** agrupado semánticamente, con el razonamiento detrás de cada grupo.
7. **Migración de datos**: cómo tratar los `PropertyAmenity` existentes en la DB que corresponden a items reclasificados (mapping tabla a tabla, qué campos se copian, cuáles se pierden).
8. **Plan de implementación por fases** — branches secuenciales con dependencias y orden.
9. **Simulaciones detalladas** — los 6+ escenarios del JSON con narrativa.
10. **Riesgos y mitigaciones**.
11. **Impacto en OTA export/import**.

## 8. Calidad esperada

- **Exhaustividad**: no omitas ningún item actual. Todos los ~142 items de `amenity_taxonomy` deben tener un destino claro en el output o eliminarlos si no tienen valor o no tienen sentido, justificando porque.
- **Coherencia**: no contradicciones entre secciones.
- **Precisión técnica**: los nombres de tabla, campo, taxonomía JSON, space type IDs, system keys deben coincidir exactamente con el snapshot.
- **Implementabilidad**: la salida debe permitir que un ingeniero la implemente sin volver a tomar decisiones de producto. Cero ambigüedad.
- **Justificaciones**: cada decisión no trivial lleva una frase de "por qué".
- **UX-first**: cada decisión debe justificarse en términos de comodidad y eficiencia del host.

Tómate el tiempo que necesites. Revisa dos veces. Este documento es la base para rehacer el corazón de la aplicación.
