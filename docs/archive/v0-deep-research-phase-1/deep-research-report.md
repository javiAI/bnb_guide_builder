# Especificación implementable para rediseñar scoping, espacios, amenities, wizard, IA y sync del Property Information Hub

Esta entrega consolida **una arquitectura sin ambigüedades** para: scoping (Property/Space/Multi-space), filtrado dinámico de espacios, capacidad consolidada, modelado de sistemas globales, amenities con deduplicación real, wizard adaptativo con pre-población idempotente, orden óptimo del workspace y contratos de sincronización + computed fields. Todo sigue el principio **config-driven** (reglas en taxonomías/JSON; componentes genéricos) y evita duplicar captura. fileciteturn0file7 fileciteturn0file8 fileciteturn0file9 fileciteturn0file10

## SCOPING_MODEL.md

### Objetivo

Definir el **modelo definitivo de scoping** para cualquier dato: qué es **Property-level**, qué es **Space-level**, qué es **Multi-space**, cómo se modela un **sistema global** que se experimenta por espacio, y qué cambios requiere el schema y las taxonomías.

Este modelo resuelve directamente:
- **P3** (infraestructura/sistemas globales vs locales)
- **P4** (amenities sin scoping claro)
- y habilita **P6** (flujo adaptativo) al convertir el scope en reglas configurables. fileciteturn0file7

---

### Definiciones canónicas

**Hecho (fact):** unidad de verdad de negocio (“hay wifi”, “Dormitorio 1 tiene 1 cama doble”).  
**Dueño canónico:** entidad/campo donde se edita el hecho.  
**Proyección:** el mismo hecho mostrado en otras pantallas/outputs (idealmente read-only; editable solo vía deep-link al dueño).  
**Scope:**
- **P (Property-level):** un hecho único por propiedad.
- **S (Space-level):** un hecho localizado en un espacio.
- **M (Multi-space):** un hecho instanciable, asignable a 1..N espacios.

Regla de oro: **un hecho se captura una sola vez** y el resto son proyecciones. Esto es coherente con “no hardcodear lógica de dominio en React” y con “canonical persisted entities”. fileciteturn0file7 fileciteturn0file8

---

### Tabla de decisión con ejemplos concretos

| Dominio | Ejemplo | Scope canónico | Por qué | Proyección típica |
|---|---|---:|---|---|
| Tipo de anuncio | `roomType = rt.entire_place` | P | Define privacidad/compartición; afecta todo el workspace citeturn0search1turn0search2 | Filtrado dinámico de espacios y secciones |
| Tipo de propiedad | `propertyType = pt.apartment` | P | Define expectativas y campos base citeturn0search0 | Infraestructura/edificio, wizard adaptativo |
| Capacidad declarada | `maxGuests` | P | Claim de ocupación; no es conteo físico | Comparación con capacidad calculada |
| Datos de dirección | país/ciudad/calle | P | Identidad global; publish/ops | Mensajería, guía local, publishing |
| Horarios | check-in/out | P | Es global (normalmente) | Guest guide + Mensajería |
| Zonas/estancias | “Baño 2” | S | Localizable y accionable | Guia de uso, incidencias localizadas |
| Camas | `bt.double x1` en Dormitorio 1 | S | Está en un espacio; base de capacidad | Capacidad total derivada fileciteturn0file2 |
| Wifi credenciales | SSID/password | P (amenity global) | Un servicio único: pedirlo por espacio duplica trabajo fileciteturn0file0 | Arrival, Guest guide, Troubleshooting |
| TV | TV en salón + TV dormitorio | M (instancias) | Puede haber varias instancias con config distinta fileciteturn0file1 | Vista por espacio, guía por ubicación |
| Agua caliente | tipo/operación | P (sistema) | Un sistema global con impacto transversal | Incidencias globales + guía |
| Calefacción/A.C. | central + splits en algunas estancias | P + coverage por espacio | Sistema global con endpoints; evita P3 | Espacios lo muestran como “heredado” |
| Ascensor | hay ascensor | P (infra) | Edificio, no habitación | Puede derivar a `am.elevator` sin capturarlo dos veces fileciteturn0file1 |
| Accesibilidad | “entrada sin escalones” | S o M | Suele ser evidencia localizada | Guía y publishing (evidence) fileciteturn0file1 |

---

### Modelo definitivo para sistemas globales con experiencia por espacio

Esto elimina la confusión actual de `infrastructureJson` “mezclando” edificio + sistemas operativos (P3). El schema actual solo tiene `infrastructureJson` en Property y fields locales en Space (`featuresJson`) para calefacción/refrigeración, más `TroubleshootingPlaybook` (playbooks, no incidencias). (Según schema.prisma pegado por el usuario.)

#### Decisión de producto

Introducir un **módulo canónico Sistemas** con dos niveles:

- **PropertySystem** (global): qué sistema es, cómo se usa, cómo se reinicia, proveedor, visibilidad, datos internos.
- **PropertySystemCoverage** (por espacio): si aplica, si no aplica, o si tiene override.

Estados de coverage por espacio:
- `inherited`
- `none`
- `override`

Esto permite que los campos de espacio existentes (p.ej. “dispositivos de calefacción” en `space_features.json`) actúen como **endpoint descriptor**, pero bajo un paraguas global que define el sistema real. fileciteturn0file5

---

### Reglas de herencia y excepciones

#### Defaults sin ambigüedad

1) Si existe un `PropertySystem` con `defaultCoverageRule = all_relevant_spaces`:
   - todo espacio relevante se crea como `inherited`.
2) Un espacio puede pasar a `none` si:
   - es un tipo de espacio “no climatizable” (balcón/patio/jardín/garaje/trastero, salvo override explícito),
   - o el usuario marca que ese espacio no recibe el sistema.
3) Un espacio puede pasar a `override` si:
   - tiene un equipo adicional (p.ej. split extra),
   - o una excepción operativa (p.ej. termostato independiente solo en dormitorio principal).

#### UX para no duplicar captura

- En **Sistemas (Property)**: tabla de espacios con selector `inherited/none/override` + nota (internal).
- En **Space detail**: bloque “Sistemas” read-only + CTA “Gestionar excepción” que abre el sistema global (evita edición duplicada por espacio).

---

### Impacto en el modelo de datos Prisma

El schema actual incluye:
- `Property.infrastructureJson` (mezcla edificio + “infra”),
- `Space.featuresJson`,
- `PropertyAmenity` con `spaceId` nullable,
- `TroubleshootingPlaybook` sin vínculo estructural a amenities/sistemas/espacios. (Según schema.prisma proporcionado.)

#### Cambios mínimos imprescindibles

##### Nuevos modelos para sistemas

```prisma
model PropertySystem {
  id         String   @id @default(cuid())
  propertyId String   @map("property_id")

  systemKey  String   @map("system_key")    // e.g. sys.internet, sys.heating, sys.hot_water
  subtypeKey String?  @map("subtype_key")   // config-driven
  detailsJson Json?   @map("details_json")  // campos tipados desde taxonomía
  opsJson     Json?   @map("ops_json")      // internal: proveedor, garantías, reinicio

  visibility String   @default("internal")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  coverages  PropertySystemCoverage[]

  @@index([propertyId])
  @@index([propertyId, systemKey])
  @@map("property_systems")
}

model PropertySystemCoverage {
  id        String   @id @default(cuid())
  systemId  String   @map("system_id")
  spaceId   String   @map("space_id")

  modeKey   String   @default("inherited") @map("mode_key") // inherited|none|override
  detailsJson Json?  @map("details_json") // solo override
  note      String?  @map("note")         // internal

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  system    PropertySystem @relation(fields: [systemId], references: [id], onDelete: Cascade)
  space     Space          @relation(fields: [spaceId], references: [id], onDelete: Cascade)

  @@unique([systemId, spaceId])
  @@index([spaceId])
  @@map("property_system_coverages")
}
```

##### Normalización de `infrastructureJson`

Queda reservado para **edificio/infraestructura física**, no para sistemas operativos:
- ascensor, planta, tipo de edificio, accesos, etc.

Los sistemas operativos (internet, climatización, agua caliente) pasan a `PropertySystem`.

#### Taxonomías nuevas recomendadas (config-driven)

Para mantener escalabilidad “solo editando taxonomías”:
- `system_taxonomy.json`
- `system_subtypes.json` (análoga a `amenity_subtypes.json`) fileciteturn0file0
- `system_coverage_rules.json` (qué spaceTypes son relevantes y defaults)

---

## SPACES_ARCHITECTURE.md

### Objetivo

Arquitectura definitiva de Espacios para resolver:
- **P1** espacios combinados sin contexto
- **P2** capacidad desincronizada
- **P5** pre-populación incompleta desde wizard
- **P6** flujo no adaptativo

Se apoya en:
- `space_types.json` (20 tipos, incluidos compuestos) fileciteturn0file6
- `space_features.json` (grupos por tipo) fileciteturn0file5
- `bed_types.json` (sleepingCapacity por tipo) fileciteturn0file2
- `room_types.json` (entire/private/shared/hotel/other) y definiciones coherentes con Airbnb citeturn0search1turn0search2

---

### Matriz roomType → spaceTypes disponibles

La decisión práctica: **roomType manda** más que propertyType para el set base de espacios “core” porque define qué es privado vs compartido. Airbnb define diferencias claras entre “entire place”, “room” y “shared room”. citeturn0search1turn0search2

#### Reglas globales

- `sp.shared_area` solo se permite cuando:
  - `roomType in {rt.private_room, rt.shared_room, rt.hotel_room}` fileciteturn0file6
- Espacios exteriores (`sp.balcony`, `sp.patio`, `sp.garden`) siempre opcionales.
- Espacios compuestos (`sp.studio`, `sp.kitchen_living`, `sp.kitchen_dining_living`, `sp.open_plan`, `sp.loft`) se permiten **solo si** el layout lo habilita (ver “espacios combinados”).

#### Matriz base

| roomType | Obligatorios | Recomendados | Opcionales | Excluidos por defecto |
|---|---|---|---|---|
| `rt.entire_place` | `sp.bathroom` (>=1) | `sp.kitchen*`, `sp.living_room*` | `sp.dining`, `sp.office`, `sp.laundry`, exteriores | `sp.shared_area` |
| `rt.private_room` | `sp.bedroom` (exactamente 1 por “unidad”), `sp.bathroom` (según baño privado o compartido) | `sp.shared_area` (si hay zonas comunes) | `sp.other` | compuestos de “entire place” salvo casos declarados |
| `rt.shared_room` | `sp.other` o `sp.shared_area` (según cómo lo representéis), `sp.bathroom` | — | exteriores | `sp.bedroom` como “privado” |
| `rt.hotel_room` | `sp.bedroom`, `sp.bathroom` | — | `sp.other` | `sp.kitchen*`, `sp.living_room*` salvo suites |

\* La cocina/salón en `rt.entire_place` puede ser simple o compuesta según layout (ver sección compuestos).

---

### Matriz propertyType → recomendación y restricciones

`property_types.json` ya ancla defaults y “requiresBuildingAccess”. Eso debe alimentar reglas de infraestructura/acceso y también defaults de layout. fileciteturn0file4 citeturn0search0

| propertyType | Tendencia de layout por defecto | Restricciones recomendadas |
|---|---|---|
| `pt.apartment` | `layout.kitchen_living` o `layout.separate_rooms` | habilitar “edificio” (portal/ascensor) |
| `pt.house` | `layout.separate_rooms` | exteriores más probables |
| `pt.secondary_unit` | `layout.studio` o `layout.separate_rooms` | insistir en entrada privada/compartida |
| `pt.unique_space` | `layout.other` (forzar elección explícita) | activar campos de contexto/seguridad |
| `pt.bed_and_breakfast` | `layout.private_room` (unidad habitación) | shared areas comunes |
| `pt.boutique_hotel` | `layout.hotel_room` | ocultar cocina salvo suites |

---

### Resolución definitiva de espacios combinados

Esto es la solución estructural para P1.

#### Decisión

Los space types compuestos **se mantienen** como tipos (porque ya existen y tienen feature groups específicos), pero:
- se marcan como **layout-derived**
- y se vuelven **mutuamente excluyentes** con sus componentes simples

Compuestos actuales:  
`sp.studio`, `sp.loft`, `sp.open_plan`, `sp.kitchen_living`, `sp.kitchen_dining_living`. fileciteturn0file6

#### Driver único: `Property.layoutKey`

Añadir `layoutKey` a Property (campo tipado o dentro de `infrastructureJson.layoutKey`; recomendado tipado para evitar “JSON cajón”). Valores internos:

- `layout.studio`
- `layout.loft`
- `layout.kitchen_living`
- `layout.kitchen_dining_living`
- `layout.open_plan_living_dining`
- `layout.separate_rooms`

#### Regla de exclusión

- Si `layoutKey = layout.studio`, entonces:
  - permitido: `sp.studio`, `sp.bathroom` (+ opcionales exteriores)
  - excluidos: `sp.bedroom`, `sp.kitchen`, `sp.living_room`, `sp.open_plan`, `sp.kitchen_living`, `sp.kitchen_dining_living`

- Si `layoutKey = layout.kitchen_living`, entonces:
  - permitido: `sp.kitchen_living` (core), `sp.bathroom`, `sp.bedroom` (según count)
  - excluidos: `sp.kitchen`, `sp.living_room`, `sp.kitchen_dining_living`

Y análogamente para el resto.

#### Config-driven implementation

Extender `space_types.json` con metadata (consumida por un servicio genérico, no por UI hardcodeada):

```json
{
  "id": "sp.kitchen_living",
  "isComposite": true,
  "derivedByLayoutKeys": ["layout.kitchen_living"],
  "mutuallyExclusiveWith": ["sp.kitchen", "sp.living_room", "sp.kitchen_dining_living"],
  "allowsSleeping": false
}
```

Además, añadir un nuevo archivo `space_availability_rules.json` (recomendado) para límites min/max por layout/roomType.

---

### Modelo de capacidad consolidada

Esto resuelve P2.

#### Fuente de verdad de capacidad

- `BedConfiguration` por espacio (schema actual).
- Capacidad base por `bed_types.json.sleepingCapacity`. fileciteturn0file2
  - `bt.crib` aporta 0. fileciteturn0file2
  - `bt.other` usa `configJson.customCapacity` si existe; si no, default 1. fileciteturn0file2

#### Cálculos canónicos

- Capacidad por espacio:
  - `spaceSleepingCapacity = Σ(capacity(bedType, configJson) * quantity)`
- Capacidad total propiedad:
  - `propertySleepingCapacity = Σ(spaceSleepingCapacity)` para espacios con `allowsSleeping=true`

Recomendación: `space_types.json` debe incluir `allowsSleeping` para evitar heurísticas.

#### Dónde se muestra (UX)

- **Spaces list (nivel propiedad):** banner fijo superior:
  - “Capacidad en camas (calculada): X”
  - “Máximo configurado: Y”
  - estado: OK / mismatch + CTA
- **Basics:** maxGuests editable y comparador visible
- **Space detail:** desglose de camas y capacidad del espacio

#### Warnings accionables

- Si X > Y:
  - CTA: “Actualizar máximo a X” o “Reducir plazas”
- Si X < Y:
  - CTA: “Bajar máximo a X” o “Añadir plazas”

#### Sincronización con campos existentes del schema

El schema tiene `bedroomsCount`, `bedsCount`, `bathroomsCount` en Property. (Según schema pegado.)

Decisión sin ambigüedad:
- **No se editan directamente** en Basics.
- Se recalculan automáticamente desde Spaces/BedConfiguration:
  - `bedroomsCount = count(spaces where spaceType in {sp.bedroom})` (y reglas especiales para studio/loft si queréis)
  - `bathroomsCount = count(spaces where spaceType=sp.bathroom)`
  - `bedsCount = Σ(quantity de BedConfiguration excluyendo bt.crib)` (crib no cuenta como cama para adultos)

Esto elimina la desincronización estructural y convierte esos campos en “derived reporting fields”.

---

### Pre-población desde wizard

Esto resuelve P5 y habilita P6.

#### Principio de persistencia

El wizard debe:
- escribir `WizardResponse` (continuidad),
- y escribir/actualizar entidades canónicas en la misma transacción cuando sea posible. fileciteturn0file8 fileciteturn0file10

#### Tabla campo_wizard → entidad → valor inicial

| Pregunta wizard (fieldKey) | Entidad destino | Operación | Valor inicial |
|---|---|---|---|
| `property.nickname` | Property | set | `propertyNickname` |
| `property.propertyType` | Property | set | `propertyType` |
| `property.roomType` | Property | set | `roomType` |
| `layout.layoutKey` | Property | set | `layoutKey` |
| `layout.bedroomsCount` | Spaces | upsert N dormitorios | `name="Dormitorio i"`, `spaceType=sp.bedroom` |
| `layout.bathroomsCount` | Spaces | upsert N baños | `name="Baño i"`, `spaceType=sp.bathroom` |
| `layout.bedroom[i].beds[]` | BedConfiguration | replace-set | bedType, quantity, configJson |
| `layout.coreAreas` | Spaces | upsert | según layout: kitchen/living/compuesto |
| `capacity.maxGuests` | Property | set | `maxGuests` |

#### Idempotencia estricta (evitar duplicados)

Añadir una convención en JSON (sin tocar UI) para “origin”:

- `Space.featuresJson.origin = {source:"wizard", key:"bedroom_1"}`
- `BedConfiguration.configJson.originKey = "bedroom_1.bed_1"`

Y la regla de actualización:
- si existe un Space con `origin.key`, se actualiza ese, no se crea uno nuevo.
- si cambia el número de dormitorios, se crean o archivan (soft) según origin keys.

---

### Campos recomendados a añadir en space_features (solo si hace falta)

El set actual es amplio (incluye calefacción/refrigeración por espacio, TV, etc.). fileciteturn0file5  
Añadir solo lo estrictamente necesario para evitar heurísticas:

- `sf.allows_sleeping` (boolean) en `sp.other` (casos raros)
- `sf.has_ethernet_port` (boolean) para endpoint sin duplicar wifi global

---

## AMENITIES_ARCHITECTURE.md

### Objetivo

Resolver P4 (scoping) y habilitar:
- deduplicación real (no configurar lo mismo 3 veces),
- multi-espacio (una instancia asignable a varios espacios),
- subtipos con campos tipados (wifi, cafetera, piscina…),
- integración con incidencias/playbooks.

Base existente:
- `amenity_taxonomy.json` (grupos + items) fileciteturn0file1
- `amenity_subtypes.json` (wifi, cafetera, piscina, etc.) fileciteturn0file0
- reglas dinámicas actuales para mostrar fields cuando un amenity se selecciona fileciteturn0file3

---

### Taxonomía de scoping para amenities

#### ScopePolicy (por amenity)

Cada amenity debe declarar una política `scopePolicy` (config-driven):

- `property_only`: una sola instancia global
  - Ej: `am.wifi` (SSID/password), `am.free_parking` como oferta. fileciteturn0file1 fileciteturn0file0
- `space_only`: requiere ubicación
  - Ej: `am.bathtub` (baño), `am.tv` si queréis forzar ubicación. fileciteturn0file1
- `multi_instance`: puede haber varias instancias; cada una se asigna a 1..N espacios
  - Ej: `am.tv`, `am.air_conditioning` (si modeláis unidades). fileciteturn0file1
- `derived`: se infiere de Spaces/Infraestructura y se muestra como “auto”
  - Ej: `am.kitchen` derivado de tener cocina/espacio compuesto. fileciteturn0file1 fileciteturn0file6

#### Dónde vive

Opción recomendada: extender `amenity_taxonomy.json.items[]` con:
- `scopePolicy`
- `suggestedSpaceTypes`
- `defaultVisibility`
- `isDerived`

Sin hardcode en UI: un servicio genérico interpreta estos flags. fileciteturn0file7

---

### Modelo de datos definitivo para PropertyAmenity

El schema actual tiene `PropertyAmenity.spaceId` nullable, lo que fuerza ambigüedad y no permite “una instancia asignada a múltiples espacios”. (Según schema pegado.)

#### Decisión recomendada

Migrar a **instancia + asignaciones** (join table), manteniendo compatibilidad temporal si hace falta.

##### Capa canónica

- `PropertyAmenity` representa una **instancia** (con `detailsJson`).
- `PropertyAmenityAssignment` representa dónde está (una o varias ubicaciones).
- `detailsJson` guarda los campos tipados desde `amenity_subtypes.json` (hoy no existe en el modelo, pero es imprescindible para wifi/coffee maker/piscina). fileciteturn0file0

##### Prisma propuesto

```prisma
model PropertyAmenity {
  id          String   @id @default(cuid())
  propertyId  String   @map("property_id")
  amenityKey  String   @map("amenity_key")
  subtypeKey  String?  @map("subtype_key")

  detailsJson Json?    @map("details_json") // valores de campos tipados (wifi.ssid, wifi.password, etc.)
  opsJson     Json?    @map("ops_json")     // internal: ubicaciones exactas, nº serie, etc.

  guestInstructions String? @map("guest_instructions")
  aiInstructions    String? @map("ai_instructions")
  internalNotes     String? @map("internal_notes")
  troubleshootingNotes String? @map("troubleshooting_notes")

  visibility String   @default("public")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  assignments PropertyAmenityAssignment[]

  @@index([propertyId])
  @@index([propertyId, amenityKey])
  @@map("property_amenities")
}

model PropertyAmenityAssignment {
  id        String   @id @default(cuid())
  amenityId String   @map("amenity_id")
  spaceId   String   @map("space_id")
  quantity  Int      @default(1)
  note      String?  @map("note") // internal por defecto

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  amenity PropertyAmenity @relation(fields: [amenityId], references: [id], onDelete: Cascade)
  space   Space           @relation(fields: [spaceId], references: [id], onDelete: Cascade)

  @@unique([amenityId, spaceId])
  @@index([spaceId])
  @@map("property_amenity_assignments")
}
```

##### Cómo cubre los requisitos del producto

- Amenity global: 1 instancia + 0 assignments (wifi).
- Amenity por espacio: 1 instancia + 1 assignment (bathtub en Baño 2).
- Amenity multi-espacio:
  - misma config: 1 instancia + N assignments
  - distinta config: N instancias (mismo `amenityKey`) + assignments independientes

---

### Flujo UX completo de Equipamiento

#### Pantalla principal: Equipamiento

Estructura:
- buscador
- filtros: grupo/categoría (de taxonomía), scope (Global / Por espacio / Multi / Derivados)
- bloque “Recomendados” usando `recommended` del taxonomy fileciteturn0file1

#### Añadir equipamiento (componente genérico)

Pasos (sin hardcode):
1) elegir item
2) resolver scope según `scopePolicy`
3) si requiere ubicación: selector de espacios + toggle “misma configuración para todos”
4) render de campos tipados a partir de `amenity_subtypes.json` y `dynamic_field_rules.json` (ya existe el patrón) fileciteturn0file0 fileciteturn0file3
5) guardar `detailsJson` + assignments

#### Acceso desde Space detail

En cada Space:
- lista de equipamiento asignado (proyección)
- CTA “Añadir aquí” prefiltra el selector de espacios al space actual

Esto evita duplicación: el usuario puede trabajar “por espacio” o “por catálogo” sin crear datos paralelos.

---

### Relación con Incidencias

El schema actual solo tiene `TroubleshootingPlaybook` (plantillas). Para cumplir la visión “avería aerotermia” vs “ducha baño 2”, falta un objeto “ocurrencia/incidencia” (registro real), además del playbook.

#### Decisión pragmática

Crear dos capas:

- **Playbook** (ya existe): conocimiento reusable.
- **Incident** (nuevo): evento real que se vincula a un **target** (system/amenity/space) y opcionalmente a un playbook.

##### Prisma propuesto

```prisma
model Incident {
  id         String   @id @default(cuid())
  propertyId String   @map("property_id")

  title      String
  severity   String   @default("medium")
  status     String   @default("open") // open|in_progress|resolved
  descriptionMd String? @map("description_md")

  targetType String   @map("target_type") // system|amenity|space|property
  targetId   String?  @map("target_id")

  playbookId String?  @map("playbook_id")
  occurredAt DateTime @default(now()) @map("occurred_at")
  resolvedAt DateTime? @map("resolved_at")

  visibility String   @default("internal")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  property Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  @@index([propertyId])
  @@index([propertyId, status])
  @@map("incidents")
}
```

Esto permite:
- aerotermia (targetType=system)
- ducha baño 2 (targetType=space)
- wifi (targetType=amenity)
y que el playbook sea reusable.

---

### Propuesta de amenities que faltan

Sin inventar categorías raras, hay gaps típicos de operación/OTA que suelen ser necesarios y no aparecen en la taxonomía actual:

- **Tecnología de acceso**: smart lock / lockbox / keypad (hoy aparecen como IDs en reglas de acceso, pero no como amenities). Si vuestra decisión es “se captura en Arrival, no en Amenities”, entonces deben aparecer como **derived** en amenities para evitar doble captura. fileciteturn0file3
- **Monitor de ruido / sensor** (operación)
- **Cámaras exteriores / disclosure** (mejor como “Safety disclosures”, pero si lo queréis en equipamiento, taxonomía separada)
- **Purificador/humidificador/deshumidificador** (frecuente en reviews de huéspedes)

Si preferís no mezclar “disclosures” con amenities, cread una taxonomía `safety_disclosures.json` dentro de Policies/Publishing, no en Amenities.

---

## WIZARD_REDESIGN.md

### Objetivo

Rediseñar el wizard para que:
- sea **adaptativo** (P6),
- cree una propiedad “usable” con **mínimos viables**,
- y haga **pre-población completa** de Spaces/Amenities/Sistemas sin intervención manual (P5),
- guardando continuidad en `WizardSession/Response` (como en el schema actual).

La taxonomía config-driven de wizard steps ya existe como patrón en arquitectura. fileciteturn0file7 fileciteturn0file8

---

### Estructura de pasos propuesta

Mantengo 4 pasos + review (coherente con la spec general), pero redefiniendo contenido para que la BD quede consistente.

#### Paso Tipo de anuncio y propiedad

Inputs (config-driven):
- `propertyNickname` (text, required)
- `propertyType` (taxonomy_radio: `property_types.json`) fileciteturn0file4
- `roomType` (taxonomy_radio: `room_types.json`) con hints (hotel_room solo en contextos hotel/B&B) citeturn0search1turn0search2

Condicionales:
- si `roomType=rt.other`: pedir `customRoomTypeLabel/Desc` (ya existen en schema)
- si `propertyType=pt.other`: pedir `customPropertyTypeLabel/Desc` (ya existen en schema)

Persistencia inmediata (decisión):
- crear `Property` **al final del paso** (no esperar al final del wizard), para permitir:
  - guardar progreso real,
  - y poblar entidades canónicas en pasos posteriores con propertyId estable.

Campos BD:
- Property: nickname, propertyType, roomType, custom fields, workspaceId, status=draft

---

#### Paso Distribución y capacidad

Objetivo: fijar layout y crear Spaces/BedConfiguration idempotentes.

Inputs:
- `layoutKey` (radio): studio / loft / kitchen_living / kitchen_dining_living / open_plan / separado
- `bedroomsCount` (integer, min/max según roomType)
- `bathroomsCount` (integer)
- “Dormitorio i”:
  - lista repetible de camas: bedType + quantity + config (si bt.other customLabel/customCapacity)

Persistencia:
- crear/upsert Spaces según layout:
  - si studio: crear `sp.studio` y NO crear bedrooms
  - si compuesto: crear espacio compuesto (p.ej. `sp.kitchen_living`) y excluir simples
  - crear N baños
  - crear N dormitorios (si aplica)
- crear/replace BedConfiguration por dormitorio usando origin keys
- recalcular y escribir:
  - Property.bedroomsCount/bathroomsCount/bedsCount (derivados)
  - computed capacity (ver SYNC_CONTRACTS)

También set:
- Property.maxGuests (pregunta al final del paso o inicio del siguiente)

---

#### Paso Acceso, horarios y contactos mínimos

Inputs:
- `checkInStart/checkInEnd/checkOutTime`
- `isAutonomousCheckin`
- `primaryAccessMethod` + `accessMethodsJson`
  - mostrado por reglas dinámicas (smart lock/keypad/lockbox/building staff) fileciteturn0file3
- Contacto principal (crear `Contact` con `isPrimary=true`, roleKey por taxonomía si existe)

Persistencia:
- Property: horarios, autonomía check-in, accessMethodsJson
- Contact: upsert primary

---

#### Paso Esenciales para guía y operación

Objetivo: capturar el mínimo de amenities/sistemas que desbloquean guía del huésped sin fricción.

Inputs adaptativos:
- Wifi: si `am.wifi` seleccionado → pedir SSID/password (campo sensible) fileciteturn0file0 fileciteturn0file3
- Cafetera: si se añade → subtipo e instrucciones fileciteturn0file0
- Pets (si policiesJson): si pets_allowed=true → mostrar campos extra fileciteturn0file3

Persistencia:
- Crear `PropertyAmenity` instancia wifi global con `detailsJson` (nuevo) y visibilidad adecuada
- Escribir `policiesJson` mínimos si se usa

---

#### Review y publicación de estado “usable”

Pantalla de resumen con:
- layout + espacios creados
- capacidad calculada vs maxGuests
- acceso y wifi completos
- checklist de completeness por sección

Botones:
- “Ir al workspace”
- “Continuar completando” (deep-links a gaps)

---

### Qué crea en BD inmediatamente vs WizardResponse

Regla:
- si un dato alimenta entidades canónicas del workspace, se escribe en la entidad **en el momento**,
- WizardResponse queda como “log de captura” y recuperación de sesión (no como truth).

Inmediato:
- Property (paso 1)
- Spaces + BedConfiguration (paso 2)
- Contact primary + Access/horarios (paso 3)
- Wifi amenity (paso 4)

Solo WizardResponse:
- estados de UI (wizard step stateJson),
- selecciones temporales que no queráis persistir aún (p.ej. “quiero añadir más tarde”).

Esto es consistente con “WizardResponse no reemplaza entidades canónicas”. fileciteturn0file8

---

### Datos mínimos viables para propiedad “usable”

Definición cuantitativa (para activar status “usable” interno, no necesariamente publish OTA):

- Property:
  - propertyType y roomType definidos
  - ubicación mínima (country, city) o al menos timezone si se quiere mensajería
  - maxGuests definido
- Spaces:
  - al menos 1 baño (`sp.bathroom`)
  - al menos 1 espacio con `allowsSleeping=true` y al menos 1 cama (excluyendo cuna)
- Arrival:
  - check-in/out definidos
  - método de acceso principal configurado
- Amenities:
  - wifi completo (SSID + password) o declarar explícitamente “no disponible”

---

### Tabla pregunta_wizard → campo_BD → sección workspace afectada

| Pregunta | Campo BD | Sección |
|---|---|---|
| Tipo de propiedad | Property.propertyType | Básicos |
| Tipo de anuncio | Property.roomType | Básicos |
| Layout | Property.layoutKey (nuevo) | Espacios |
| Dormitorios/baños | Space/Property derived counts | Espacios |
| Camas | BedConfiguration | Espacios |
| Max huéspedes | Property.maxGuests | Básicos + Espacios (capacidad) |
| Horarios | Property.checkInStart/End/checkOut | Acceso y check-in |
| Acceso | Property.primaryAccessMethod/accessMethodsJson | Acceso y check-in |
| Wifi | PropertyAmenity(am.wifi).detailsJson | Equipamiento + Guía |

---

## WORKSPACE_INFORMATION_ARCHITECTURE.md

### Objetivo

Reordenar y estructurar el workspace para maximizar:
- flujo natural del operador,
- dependencias claras,
- adaptatividad (mostrar solo lo relevante),
- y outputs (guía/AI/publishing) alimentados por una sola verdad.

La spec actual define módulos canónicos y rutas, pero el orden puede optimizarse para P7 y para introducir “Sistemas” como módulo explícito. fileciteturn0file9

---

### Orden óptimo propuesto de secciones

Este orden separa “Setup (verdad canónica)” de “Outputs” y “Ops”, y reduce el salto mental entre “Espacios ⇄ Amenities ⇄ Sistemas”.

1) Overview (panel de progreso/gaps)
2) Básicos
3) Espacios
4) Sistemas (nuevo)
5) Equipamiento
6) Acceso y check-in
7) Contactos
8) Normas
9) Incidencias
10) Guía local
11) Knowledge Base
12) Media
13) Mensajería
14) Publicación
15) Operaciones (Cleaning & Ops)
16) Analíticas
17) Configuración
18) Registro de actividad
19) Guía del huésped (output)
20) Vista AI (output)

**Nota:** pongo Outputs al final para que actúen como “render” de la verdad canónica. Si preferís que estén cerca (para motivación), moved “Guía del huésped” y “Vista AI” justo después de Media; no cambia el modelo de datos.

---

### Propósito y dependencias por sección

Resumen (sin bullets interminables):

**Overview**
- Propósito: mostrar gaps y CTAs (“te falta wifi”, “capacidad no cuadra”).
- Depende de: computed fields de todas las secciones.
- Output: “ready cards”, publish blockers. fileciteturn0file10

**Básicos**
- Captura: propertyType, roomType, dirección, maxGuests, flags (infantsAllowed, etc.).
- Depende de: wizard o ajustes.
- Genera: filtros, defaults, gating.

**Espacios**
- Captura: estructura física + camas + features por space_features.
- Depende de: layoutKey.
- Genera: capacidad calculada, conteos derivados, base de guía. fileciteturn0file5

**Sistemas (nuevo)**
- Captura: internet/sistemas térmicos/agua caliente/alarma/etc.
- Depende de: propertyType/roomType (para sugerencias) y spaces (para coverage list).
- Genera: troubleshooting contextual, guía de uso, operaciones.

**Equipamiento**
- Captura: amenities + subtypes + assignments.
- Depende de: spaces (para ubicación), sistemas (para evitar duplicar “internet” como dos verdades).
- Genera: guía, export OTA, troubleshooting.

**Acceso y check-in**
- Captura: método de acceso, credenciales, medias, building access.
- Depende de: propertyType/roomType y dynamic rules. fileciteturn0file3
- Genera: sección crítica de guest guide y mensajes.

**Contactos**
- Captura: contactos internos y guest-visible.
- Depende de: nada.
- Genera: escalado de incidencias/ops.

**Normas**
- Captura: policiesJson (pets, etc.) con reglas dinámicas. fileciteturn0file3
- Genera: guest guide, publishing validation.

**Incidencias**
- Librería: playbooks (TroubleshootingPlaybook).
- Registro real: incidents (nuevo) si lo implementáis.
- Depende de: sistemas/amenities/spaces para linking.

**Media**
- Captura: MediaAsset + assignments (ya existe join genérico). (schema)
- Depende de: entidades (para asignar fotos a espacios/amenities/sistemas).
- Genera: evidencia para accesibilidad y publishing.

**Outputs (Guía del huésped / Vista AI)**
- Consumen: GuideVersion/KnowledgeItem, generados desde canon. (schema)
- Dependen de: todo lo anterior.

---

### Secciones a añadir, eliminar o fusionar

**Añadir**
- **Sistemas**: imprescindible para P3 y para vincular incidencias globales sin hackear infrastructureJson.

**Mantener pero integrar profundamente**
- **Incidencias** debe existir como sección (biblioteca + lista), pero también aparecer incrustada:
  - en Sistemas (playbooks por sistema)
  - en Amenity detail (playbooks por amenity)
  - en Space detail (incidencias locales)

**No fusionar**
- Espacios y Equipamiento no se fusionan: su semántica y UX son distintas. Se conectan por assignments.

---

### Mapa de dependencias entre secciones

Dependencias directas:

- Básicos → (Espacios, Sistemas, Equipamiento, Acceso, Publishing)
- Espacios → (Sistemas coverage, Equipamiento assignments, Capacidad, Guía)
- Sistemas → (Incidencias, Guía, Mensajería)
- Equipamiento → (Incidencias, Guía, Publishing)
- Acceso → (Guía, Mensajería, Publishing)
- Media → (Publishing, Guía, Accesibilidad evidence)
- Incidencias → (Ops, Mensajería interna, Knowledge)

---

## SYNC_CONTRACTS.md

### Objetivo

Definir contratos deterministas:
- qué pasa cuando X cambia,
- qué campos son computed,
- quién los calcula (backend),
- cuándo se invalidan,
- criterios cuantitativos de completeness por sección,
- y validaciones cruzadas.

Esto aterriza P2, P5 y P6 en comportamiento implementable.

La arquitectura ya sugiere “derived content determinista” y sincronización wizard → entidades. fileciteturn0file10 fileciteturn0file8

---

### Tabla de eventos → acciones

| Evento | Acción canónica | Entidades afectadas | UI/outputs afectados |
|---|---|---|---|
| Crear/editar/eliminar BedConfiguration | Recalcular capacidad space y property | BedConfiguration, Space, Property | Warnings capacidad, publish blockers |
| Crear/eliminar Space | Recalcular conteos (bedrooms/bathrooms), recomputar capacity | Space, Property | Espacios, Basics (read-only conteos) |
| Cambiar `Property.maxGuests` | Recalcular mismatch capacity | Property | Overview banner + CTA |
| Cambiar `roomType` | Re-evaluar disponibilidad de espacios (p.ej. shared_area) | Property, Spaces (policy) | Filtrado dinámico y sugerencias |
| Cambiar `layoutKey` | Migración guiada de spaces compuestos/simples | Property, Space, BedConfiguration | “Cambiar distribución” con confirmación |
| Añadir `am.wifi` o editar SSID/pass | Validar campos requeridos por subtype | PropertyAmenity | Arrival, Guest guide, Messaging |
| Editar `primaryAccessMethod` | Aplicar dynamic field rules (mostrar/limpiar) | Property.accessMethodsJson | Arrival completeness fileciteturn0file3 |
| Crear/editar System | Crear/actualizar coverages default | PropertySystem + coverages | Sistemas + Space projections |
| Crear Incident | Enlazar target + (opcional) playbook | Incident | Ops + Troubleshooting |

---

### Computed fields

#### Lista de computed fields

| Computed field | Se calcula desde | Responsable | Invalida con |
|---|---|---|---|
| `propertySleepingCapacity` | BedConfiguration + bed_types | backend service | cambios en BedConfiguration fileciteturn0file2 |
| `spaceSleepingCapacity` | BedConfiguration por space | backend service | cambios en BedConfiguration |
| `Property.bedsCount` | suma quantities excluyendo crib | backend service | cambios BedConfiguration fileciteturn0file2 |
| `Property.bedroomsCount` | count spaces tipo bedroom | backend service | alta/baja Space |
| `Property.bathroomsCount` | count spaces tipo bathroom | backend service | alta/baja Space |
| `capacityMismatchStatus` | maxGuests vs computed capacity | backend service | cambio maxGuests o beds |
| `spacesCompletenessScore` | reglas + mínimos por tipo | backend service | cambios Spaces/features/camas |
| `amenitiesCompletenessScore` | policy + required subtypes | backend service | cambios amenities/detailsJson fileciteturn0file0 |
| `arrivalCompletenessScore` | dynamic required fields | backend service | cambios accessMethodsJson fileciteturn0file3 |

#### Dónde se calculan

En backend, dentro de “canonical entity services”/orchestrators (no en React), y en transacciones cuando el cambio es local. Esto sigue el patrón de ownership y sincronización del sistema. fileciteturn0file10

---

### Criterios de completeness por sección

Definiciones cuantitativas (ejemplo implementable):

**Espacios**
- Completo si:
  - existe al menos 1 baño
  - existe al menos 1 espacio con `allowsSleeping=true`
  - cada dormitorio tiene al menos 1 cama (excluyendo cuna)
  - no hay espacios “prohibidos” por layoutKey
- Score recomendado: 0–100 con pesos (baños 20, dormitorios/camas 50, features mínimas 30)

**Equipamiento**
- Completo si:
  - si wifi está marcado como presente, tiene SSID + password
  - no hay amenities con `scopePolicy=space_only` sin assignment
  - amenities recomendados por propertyType/roomType están al menos revisados (aceptados o descartados)
- Score: 0–100

**Acceso**
- Completo si:
  - checkInStart/checkInEnd/checkOutTime definidos
  - primaryAccessMethod definido
  - campos requeridos por la regla dinámica están presentes fileciteturn0file3

---

### Validaciones cruzadas

| Regla | Severidad | Acción |
|---|---|---|
| computedCapacity > maxGuests | warning | CTA ajustar maxGuests o camas |
| roomType != entire_place y no existe shared_area (cuando se marca que hay zonas compartidas) | warning | Sugerir `sp.shared_area` |
| wifi seleccionado sin SSID/password | blocker para “usable” | Enviar a editar wifi subtype fileciteturn0file0 |
| smart_lock sin backup method/código | blocker para “usable” | Enviar a Arrival rule fileciteturn0file3 |
| layoutKey=studio y existe sp.bedroom | blocker por inconsist. | Forzar “cambiar distribución” |

---

### Contrato de sincronización wizard ↔ workspace

- Wizard escribe `WizardResponse` siempre.
- Wizard actualiza entidades canónicas inmediatamente en cada paso relevante.
- Workspace nunca vuelve a pedir un dato ya capturado: lo muestra y permite editarlo en su dueño canónico.

Esto es coherente con la regla “una misma verdad no se captura dos veces”. fileciteturn0file9