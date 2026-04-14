# SCOPING_MODEL

Versión: 2026-04-14  
Idioma visible: es-ES  
IDs internos: inglés  
Unidades: sistema métrico  

## Resumen ejecutivo

Este documento define un **modelo de scoping sin ambigüedades** para la captura de información de una propiedad: qué vive a nivel de **Property**, qué vive a nivel de **Space**, y qué se modela como **objeto global con cobertura por espacios** (multi-space). El principio rector es separar **(a) la entidad canónica** (el “objeto”) de **(b) dónde aplica** (cobertura/ubicación) y **(c) cómo se muestra** (visibilidad). Con esto se eliminan duplicidades, se habilita herencia con excepciones y se hace posible un flujo UX adaptativo 100% config-driven.

El problema actual viene de mezclar conceptos: por ejemplo, “calefacción” existe como infraestructura global en `Property.infrastructureJson` y también como campos locales en `Space.featuresJson`, sin reglas claras; y `PropertyAmenity.spaceId` (nullable) intenta resolver en una sola tabla los casos global / por espacio / multi-espacio, pero se queda corto para instancias múltiples con configuración distinta.

La propuesta introduce un patrón uniforme para todo lo “compartido pero experimentado en espacios” (**sistemas**) y para todo lo “equipamiento ubicable” (**amenities**): un objeto propiedad-level (capturado una vez) + una capa de **coverage/placement** (qué espacios aplica) + **overrides** opcionales por espacio. Esto permite: incidencias/playbooks vinculables al objeto correcto, UI sin duplicar trabajo, y sincronización fiable entre wizard y workspace.

## Modelo de scoping definitivo

### Conceptos básicos

**Property-level (P)**  
Hechos que describen a la propiedad como unidad pública/operativa, o que no tienen sentido fragmentar por estancias. Ej.: tipo de propiedad, dirección, reglas, contactos, horarios de check-in/out, y objetos globales (sistemas) que se configuran a ese nivel.

**Space-level (S)**  
Hechos físicos/funcionales de una estancia concreta o configuraciones que difieren por estancia. Ej.: camas del dormitorio 2, si el baño 1 tiene bidé, o si el salón tiene sofá cama.

**Multi-space (M)**  
Un **único objeto** que se configura una sola vez, pero “se aplica” a varios espacios. Ej.: `sys.heating` central (configuración única) que afecta a todos los espacios; o `am.tv` con una instancia en salón y otra en dormitorio.

> Regla práctica: **si el huésped lo percibe “en la habitación”, pero el host lo mantiene “como infraestructura/servicio”, es System (M)**. Si es un objeto “movible/instalable” que puede repetirse con variaciones, es Amenity (M).

### Tabla de decisión (qué es qué)

| Caso | ¿Qué es? | Scope | Entidad canónica | Ejemplo | Por qué |
|---|---|---:|---|---|---|
| Identidad y tipo | Atributo | P | `Property` | `propertyType`, `roomType`, nickname | Unifica wizard + workspace |
| Ubicación | Atributo | P | `Property` | dirección, timezone, lat/lng | No depende de espacios |
| Capacidad objetivo | Atributo | P | `Property` | `maxGuests/maxAdults/maxChildren` | Es el “contrato” con OTAs |
| Distribución física | Atributo + derivado | P + S | `Property` + `Space` | `bedroomsCount` vs dormitorios reales | Conteos declarados ≠ inventario real |
| Camas | Inventario | S | `BedConfiguration` | cama doble en dormitorio 1 | Varía por estancia |
| Internet / Wifi | Sistema | M | `PropertySystem(sys.internet)` | SSID/contraseña, router | Un único sistema con cobertura |
| Calefacción / refrigeración | Sistema | M | `PropertySystem(sys.heating/sys.cooling)` | aerotermia, caldera, splits | Global con excepciones por espacios |
| Agua caliente | Sistema | M | `PropertySystem(sys.hot_water)` | termo, caldera | Afecta a baños/cocina |
| Electricidad / gas | Sistema | M | `PropertySystem(sys.electricity/sys.gas)` | cuadro eléctrico | Infraestructura |
| Ascensor | Sistema/infra edificio | P | `PropertySystem(sys.elevator)` | ascensor del edificio | No varía por estancia; afecta accesibilidad |
| Detector de humo / CO | Sistema de seguridad | P/M | `PropertySystem(sys.smoke_detector/sys.co_detector)` (propuesto) | sensores | Es seguridad/infra, no “equipamiento” |
| TV / Smart TV | Amenity instanciable | M | `PropertyAmenityInstance(am.tv)` | TV en salón y dormitorio | Repetible con variantes |
| Toallas / sábanas | Amenity consumible (derivable) | P/M | `PropertyAmenityInstance(am.essentials)` o derivado | kit de ropa | Mejor capturarlo una vez |
| Parking | Atributo de llegada | P | `Property.accessMethodsJson.parking` | parking privado/calle | Afecta llegada; mapea a OTAs |
| Accesibilidad | Atributo + por-espacio | P + S | `accessMethodsJson` + `Space.featuresJson` | step-free, barras baño | Parte es entrada, parte es baño |
| “Acceso a playa / waterfront” | Atributo de entorno | P | `Property` (atributos) | waterfront | No es equipamiento |
| Recomendaciones | Contenido guía | P | `KnowledgeItem`/`GuideSectionItem` | texto | Es contenido, no inventario |

## Sistemas: objeto global con cobertura por espacios

El patrón para sistemas resuelve el caso “afecta a toda la propiedad pero se experimenta en cada espacio”.

### Modelo de datos propuesto (Prisma)

Se añaden dos modelos canónicos:

- `PropertySystem` (una fila por sistema activo en la propiedad)
- `PropertySystemCoverage` (capa de cobertura/override por espacio)

Contrato:

- `PropertySystem.systemKey` referencia `taxonomies/system_taxonomy.json`
- `PropertySystem.detailsJson` sigue `taxonomies/system_subtypes.json` (fields tipados con visibilidad)
- `PropertySystemCoverage.mode` controla excepciones por espacio

**DefaultCoverageRule** viene de la taxonomía del sistema:

- `property_only`: no aplica a spaces (ej.: intercom)
- `all_relevant_spaces`: aplica a todos los espacios relevantes por defecto (ej.: internet)
- `selected_spaces`: requiere selección explícita (ej.: cable_tv o cooling si no es central)

### Herencia y excepciones

Regla:

1. El sistema define una cobertura por defecto (desde taxonomía).
2. Cada espacio decide su estado efectivo:
   - `inherited`: usa la cobertura por defecto
   - `override_yes`: fuerza “aplica”
   - `override_no`: fuerza “no aplica”
3. Las overrides se deben poder gestionar desde:
   - la vista del sistema (bulk)
   - la vista del espacio (local)

### UX para capturar sistemas sin duplicar

**En “Sistemas” (property-level):**
- Lista de sistemas sugeridos (por tipo de propiedad, layout, entorno).
- Cada sistema: toggle “activo”, configuración (fields), y bloque “¿Dónde aplica?”.
- `all_relevant_spaces`: checklist de espacios con estado por defecto “incluido”; permitir excluir.
- `selected_spaces`: checklist de espacios con estado por defecto “no incluido”; permitir incluir.

**En cada espacio:**
- Subpanel “Sistemas en este espacio” con chips:
  - `Heredado`
  - `Incluido`
  - `Excluido`
- Click abre drawer del sistema (sin duplicar configuración).

## Amenities: objeto instanciable con placements

Los amenities NO deben modelar infraestructura. Son inventario/experiencia, a menudo repetible.

Patrón:

- La instancia se captura una vez (tiene subtipo y detalles).
- Se asigna a 0..N espacios (placements).
- Si hay dos TVs distintas, se crean 2 instancias del mismo `amenityKey` con detalles diferentes.

(El detalle del modelo está en `AMENITIES_ARCHITECTURE.md`.)

## Reglas para `Property.infrastructureJson`

Decisión:

- **Deprecar** el uso de `infrastructureJson` para sistemas (calefacción, refrigeración, ascensor, etc.).
- Mantener `infrastructureJson` SOLO para:
  - building meta no estructurada (temporal)
  - campos legacy durante migración

Migrar a:

- `PropertySystem` + `PropertySystemCoverage`
- campos tipados en `Property` para atributos estructurales usados por el motor condicional

## Impacto en Prisma (cambios propuestos)

### Cambios en `Property`

Añadir campos tipados:

- `layoutKey String?` (FK a `space_availability_rules.layoutKeys`)
- `propertyEnvironment String?` (FK a `property_environments.json`)
- `floorLevel Int?` (planta del alojamiento, 0=calle)
- `buildingFloorsCount Int?` (si aplica)
- `hasElevator Boolean?` (si aplica, puede mapearse a sys.elevator)
- `hasPrivateEntrance Boolean?` (si aplica)

### Nuevos modelos

Añadir:

- `PropertySystem`
- `PropertySystemCoverage`

### Ajustes de visibilidad

Unificar el contrato de visibilidad en DB y taxonomías:

- DB hoy usa strings como `"public"`.
- Taxonomía sugiere 4 niveles: `guest`, `ai`, `internal`, `sensitive`.

Recomendación pragmática:
- Añadir enum `VisibilityLevel` en Prisma y migrar valores.
- Mantener compatibilidad en API (aceptar aliases `public`→`guest`, `secret`→`sensitive`).
