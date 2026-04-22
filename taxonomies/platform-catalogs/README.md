# Platform catalogs — reverse coverage invariant (Rama 14A)

Estos archivos pinnean el vocabulario de Airbnb y Booking que queremos cubrir en las cinco taxonomías mappables (`amenity_taxonomy`, `property_types`, `space_types`, `access_methods`, `policy_taxonomy`).

## Por qué existen

El gate forward (`src/test/platform-mappings-coverage.test.ts`) valida que **todo ítem nuestro** esté mapeado o declarado `platform_supported:false`. Eso detecta ambigüedad interna, pero **no** detecta lagunas: si Airbnb tiene un amenity ID que nosotros no representamos, el gate forward nunca lo ve.

El gate reverse (`src/test/platform-reverse-coverage.test.ts`) hace la comprobación opuesta: **todo concepto del catálogo externo** que decidimos cubrir (`relevance: "covered"`) debe tener al menos un item de nuestra taxonomía mapeando a él. Eso cierra la dirección que faltaba.

## Tipos de archivo

### Catálogos oficiales
Representan vocabulario publicado por la plataforma (amenity IDs, enum values, PCT codes).

- `airbnb-amenities.json` — Airbnb amenity IDs (Host API + help center)
- `airbnb-property-types.json` — Airbnb `property_type_category` enum
- `airbnb-access-methods.json` — Airbnb `check_in_method` enum (5 valores)
- `booking-amenities.json` — Booking HAC (Hotel Amenity Codes, OTA 2014B)
- `booking-property-types.json` — Booking PCT codes

No se crea `booking-access-methods.json`: Booking no expone catálogo de métodos de acceso (field libre `checkin_instructions`). Las coberturas de `access_methods` para Booking se declaran en `booking-structured-fields.json` como free-text, no como catálogo.

### Coverage manifests
Representan campos estructurados del listing que decidimos soportar para serialización. No hay un catálogo externo equivalente — el manifest es **nuestra declaración** del scope de integración.

- `airbnb-structured-fields.json`
- `booking-structured-fields.json`

Los manifests tienen entries con `kind: "structured_field" | "room_counter" | "free_text"`.

## Shape común

Todos los archivos son objetos con:
```json
{
  "pinned_at": "YYYY-MM-DD",
  "source_urls": ["https://..."],
  "scope": "v1",
  "entries": [ ... ]
}
```

### Entries de catálogo oficial

```json
{
  "id": "string (external_id del platform)",
  "label_en": "string (label oficial)",
  "category": "string (grouping del platform; opcional si no existe)",
  "relevance": "covered" | "out_of_scope",
  "reason": "string (obligatorio si out_of_scope)",
  "collapsed_to": "string (opcional; id de nuestro taxonomy item al que este alias colapsa)",
  "notes": "string (opcional)"
}
```

### Entries de manifest estructurado

```json
{
  "kind": "structured_field" | "room_counter" | "free_text",
  "field": "string (si structured_field o free_text)",
  "counter": "bedrooms" | "bathrooms" | "beds" (si room_counter),
  "transform": "bool|currency|minutes|enum|number" (si structured_field),
  "target_taxonomy": "policies" | "space_types" | "access_methods",
  "semantics": "string (qué representa)",
  "relevance": "covered" | "out_of_scope",
  "reason": "string (si out_of_scope)"
}
```

## Valores normalizados de `reason`

Sólo se aceptan (enforced por el test):

- `hotel_only` — concepto propio de hoteles, no aplica a STR
- `deprecated` — retirado del catálogo por la plataforma
- `duplicate` — redundante con otra entry del mismo catálogo
- `not_relevant_to_str` — teóricamente posible en STR pero ni relevante para el huésped ni capturado por el host
- `covered_via_alias` — el concepto está cubierto porque otra entry (`collapsed_to`) lo absorbe
- `platform_not_actionable` — la plataforma lo lista pero no permite editarlo vía API (read-only o pre-configurado)

## Política `deferred`

**No existe** en el estado final de la rama. Durante el trabajo de triaje podemos mantener `relevance: "deferred"` transitoriamente, pero el test rechaza cualquier entry con ese valor antes del merge. Al cerrar la rama toda entry es `covered` o `out_of_scope` con `reason`.

## Colapsos intra-plataforma (`collapsed_to`)

Para property_types de Airbnb y Booking muchos-a-uno (p. ej. `cottage`/`chalet`/`cabin` → `pt.house`), el modelo canónico es:
- el item taxonómico (p. ej. `pt.house`) lleva **múltiples** mappings `{platform:"airbnb", kind:"external_id", external_id: "..."}` en su `source[]`, uno por alias
- el catálogo declara `collapsed_to: "pt.house"` para cada alias

El reverse test verifica que el item `collapsed_to` contenga el `external_id` declarado. Se rechazan colapsos arbitrarios: sólo `collapsed_to` aprobados por criterio editorial (alias semánticamente equivalente).

## Actualización de catálogos

- `pinned_at` fija la fecha de la snapshot.
- `source_urls[]` documenta de dónde se extrajo.
- Cuando la plataforma publica cambios (nuevo amenity ID, PCT deprecado), se actualiza el archivo pinneado y se corre el test; los nuevos `covered` que aún no tengan mapping producen fallos con el ID exacto — se cierran añadiendo items o aliases a las taxonomías.

Scope-v1 = lo verificado a la fecha de creación del archivo. Scope posteriores añaden entries y promueven `out_of_scope → covered` según la plataforma gane/pierda cobertura.
