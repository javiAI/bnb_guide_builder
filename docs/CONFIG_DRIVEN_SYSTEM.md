# CONFIG_DRIVEN_SYSTEM

Consolida la arquitectura config-driven y el runtime de taxonomías. Las taxonomías no son material de diseño: son runtime configuration versionada.

## Principio rector

Toda lógica de dominio configurable (taxonomías, campos, dependencias, media, renderizado) vive en configuración centralizada. Los componentes React son genéricos y consumen estas definiciones — no hardcodean opciones, orden de campos, defaults ni dependencias.

## Estructura de carpetas

```
src/config/
├── index.ts                         # Barrel export
├── schemas/
│   ├── wizard-steps.ts              # Definiciones declarativas de pasos del wizard
│   ├── section-editors.ts           # Registro de secciones del workspace
│   └── field-dependencies.ts        # Motor de dependencias basado en dynamic_field_rules
└── registries/
    ├── icon-registry.ts             # Mapeo de IDs → iconos
    ├── renderer-registry.ts         # Configuración de renderizado por target
    └── media-registry.ts            # API sobre media_requirements taxonomy

taxonomies/                           # Source of truth (16 JSON files)
├── property_types.json
├── room_types.json
├── access_methods.json
├── amenity_taxonomy.json
├── amenity_subtypes.json
├── policy_taxonomy.json
├── troubleshooting_taxonomy.json
├── messaging_touchpoints.json
├── guide_outputs.json
├── visibility_levels.json
├── media_requirements.json
├── space_types.json
├── dynamic_field_rules.json
├── automation_channels.json
├── media_asset_roles.json
└── review_reasons.json

src/lib/taxonomy-loader.ts            # Carga y helpers tipados
src/lib/types/taxonomy.ts             # Tipos TypeScript para taxonomías
```

## Capas del sistema config-driven

### 1. Taxonomías (source of truth)

Los 16 archivos JSON en `taxonomies/` son la fuente de verdad. Cada uno incluye:
- `file`, `version`, `locale` (es-ES), `units_system` (metric)
- IDs estables (e.g., `am.smart_lock`, `pt.apartment`)
- Labels en español
- Campos opcionales: `recommended`, `defaults`, `dependency_hints`, `parent_id`

**No se hardcodean opciones en componentes React.** Todo select, radio card y chip multi-select lee de la taxonomía.

### 2. Wizard step schemas (`src/config/schemas/wizard-steps.ts`)

Cada paso del wizard se define declarativamente:
```typescript
{
  step: 1,
  title: "Tipo de alojamiento",
  groups: [
    {
      id: "property_type",
      label: "Tipo de propiedad",
      fields: [
        {
          name: "propertyType",
          type: "taxonomy_radio",
          taxonomy: propertyTypes,  // ← referencia directa a la taxonomía
          required: true,
        },
      ],
    },
  ],
}
```

Tipos de campo soportados:
- `taxonomy_radio` — RadioCardGroup desde taxonomía
- `taxonomy_select` — Select dropdown desde taxonomía
- `taxonomy_chips` — Multi-select chips desde taxonomía
- `number_stepper` — Stepper numérico con min/max
- `time_select` — Selector de hora (intervalos 30 min)
- `text`, `tel`, `textarea` — Campos de texto
- `select` — Select con opciones estáticas
- `checkbox` — Boolean

### 3. Section editor registry (`src/config/schemas/section-editors.ts`)

Cada módulo del workspace se declara con:
- `key` — segmento de ruta estable
- `label`, `description` — en español
- `group` — content / outputs / operations
- `phase` — fase de implementación
- `taxonomySource` — taxonomía que alimenta el editor
- `completenessFields` — campos para evaluar progreso
- `hasList`, `hasDetail` — patrón list/detail

La navegación sidebar (`src/lib/navigation.ts`) se **deriva** de este registro. Agregar una sección aquí la añade automáticamente al sidebar.

### 4. Field dependency engine (`src/config/schemas/field-dependencies.ts`)

Consume `dynamic_field_rules.json` para resolver:
- Qué campos mostrar dado el estado actual del formulario
- Qué defaults aplicar
- Qué campos limpiar cuando ya no aplican

```typescript
const deps = resolveFieldDependencies({
  "arrival.access.method": "am.smart_lock",
  "amenities.selected": ["am.wifi", "am.coffee_maker"],
});
// deps.visibleFields → Set<string> de campos a mostrar
// deps.defaults → Record<string, unknown> de defaults
```

Las dependencias viven en la taxonomía, **no** en lógica if/else en componentes.

### 5. Icon registry (`src/config/registries/icon-registry.ts`)

Mapea IDs estables a iconos. Evita switch statements en componentes.

### 6. Renderer registry (`src/config/registries/renderer-registry.ts`)

Define cómo se renderiza cada sección según el target de salida:
- `guest_guide` — guía visible al huésped
- `ai_view` — vista para el asistente AI/LLM
- `internal` — vista interna del host
- `messaging` — datos para templates de mensajes

Todos los targets consumen el **mismo modelo de dominio normalizado** (KnowledgeItem, GuideSection, MessageTemplate).

### 7. Media registry (`src/config/registries/media-registry.ts`)

API tipada sobre `media_requirements.json`. Los formularios, validaciones, previews y publishing checks usan la misma fuente.

---

## Guía: Cómo añadir un nuevo amenity

### Paso 1: Añadir a la taxonomía
Editar `taxonomies/amenity_taxonomy.json`:
```json
{
  "id": "am.new_amenity",
  "label": "Nuevo Amenity",
  "description": "Descripción del amenity",
  "recommended": false
}
```
Y añadir el ID al grupo correspondiente en `groups[].item_ids`.

### Paso 2: Añadir subtipo (si aplica)
Editar `taxonomies/amenity_subtypes.json`:
```json
{
  "amenity_id": "am.new_amenity",
  "label": "Configuración de Nuevo Amenity",
  "fields": [
    {
      "id": "new_amenity.model",
      "label": "Modelo",
      "type": "text"
    }
  ]
}
```

### Paso 3: Añadir regla de dependencia (si aplica)
Editar `taxonomies/dynamic_field_rules.json`:
```json
{
  "id": "dfr.new_amenity_selected",
  "trigger": "amenities.selected",
  "condition": { "contains": "am.new_amenity" },
  "shown_fields": ["new_amenity.model", "new_amenity.instructions"],
  "defaults": {},
  "rationale": "El nuevo amenity requiere configuración específica."
}
```

### Paso 4: Añadir requisitos de media (si aplica)
Editar `taxonomies/media_requirements.json`:
```json
{
  "id": "mr.new_amenity_photo",
  "section": "amenities",
  "entity": "new_amenity",
  "label": "Foto del nuevo amenity",
  "media_type": "photo",
  "required_level": "recommended"
}
```

### Paso 5: Añadir icono (si aplica)
Editar `src/config/registries/icon-registry.ts`, añadir en `AMENITY_GROUP_ICONS` o crear un nuevo registro.

### Resultado
- Los formularios de amenities mostrarán automáticamente el nuevo amenity
- Los campos dependientes se mostrarán/ocultarán según la regla
- Los subtypes generarán campos adicionales
- La validación de media incluirá los nuevos requisitos
- Los renderers incluirán el amenity en la guía del huésped, vista AI, etc.
- **No se modifica ningún componente React.**

---

## Guía: Cómo añadir una nueva sección al workspace

1. Añadir entrada en `src/config/schemas/section-editors.ts`
2. Crear modelo Prisma si es nueva entidad → `prisma migrate dev`
3. Crear repository en `src/lib/repositories/`
4. Crear página en `src/app/properties/[propertyId]/[key]/page.tsx`
5. Añadir icono en `src/config/registries/icon-registry.ts`
6. Añadir render config en `src/config/registries/renderer-registry.ts`

La navegación sidebar se actualiza **automáticamente** desde el registro.

---

## Guía: Cómo cambiar defaults

- **Defaults de campos del wizard:** Editar `src/config/schemas/wizard-steps.ts` → `defaultValue`
- **Defaults de dependencias:** Editar `taxonomies/dynamic_field_rules.json` → `defaults`
- **Defaults de subtypes:** Editar `taxonomies/amenity_subtypes.json` → `fields[].default`

---

## Guía: Cómo cambiar visibilidad

- **Visibilidad de secciones en outputs:** Editar `src/config/registries/renderer-registry.ts` → `maxVisibility` y `targets`
- **Visibilidad de knowledge items:** Controlada por el campo `visibility` en el modelo KnowledgeItem (valores del taxonomy `visibility_levels.json`)

---

## Guía: Dónde viven las reglas de dependencia

Todas en `taxonomies/dynamic_field_rules.json`. El motor en `src/config/schemas/field-dependencies.ts` las evalúa. Los componentes llaman a `resolveFieldDependencies(formState)` para saber qué mostrar.

---

## Estado actual de config-driven por fase

| Componente | Config-driven | Parcialmente | Notas |
|---|---|---|---|
| Taxonomías (16 JSON) | ✅ | | Source of truth |
| Taxonomy loader | ✅ | | Helpers tipados |
| Wizard step schemas | ✅ | | 4 pasos declarativos |
| Section editor registry | ✅ | | 14 secciones |
| Navegación sidebar | ✅ | | Derivada del registro |
| Field dependency engine | ✅ | | 14 reglas |
| Icon registry | ✅ | | Secciones + taxonomías |
| Renderer registry | ✅ | | 7 configs |
| Media registry | ✅ | | API sobre taxonomy |
| Wizard pages (React) | | ✅ | Consumen taxonomías, pendiente schema-driven rendering |
| Section editor pages | | ✅ | Placeholder, Fase 4+ |
| Guide renderer | | | Fase 5 |
| AI/LLM retrieval | | | Fase 5 |
| Messaging integration | | | Fase 6 |

**Regla para fases futuras:** Cada editor, renderer y integración **debe** consumir la configuración centralizada. No se permite hardcodear opciones, campos o dependencias en componentes React.

---

## Loader contract

Cada taxonomía debe:

- Incluir `file`, `version`, `locale` (es-ES), `units_system` (metric)
- Exponer `items` o `groups` (según aplique)
- Usar IDs estables prefijados (`am.*`, `pt.*`, `sys.*`, `sp.*`, `ax.*`, …)
- Mostrar labels en español

El loader (`src/lib/taxonomy-loader.ts`) devuelve helpers tipados: `getAmenityDestination`, `isAmenityConfigurable`, `getAmenityScopePolicy`, `findAmenityItem`, etc.

---

## Dynamic field rule contract

Cada regla en `dynamic_field_rules.json` tiene:

- `id`
- `trigger` — campo o path que dispara
- `condition` — operadores `equals`, `in`, `gt`, `exists`, `containsAny`, `allOf`, `anyOf`, `not`
- `shown_fields` — qué campos mostrar
- `defaults` — valores por defecto cuando aplica
- `rationale` — por qué existe la regla

El motor declarativo (`src/lib/conditional-engine/`):

- No duplica lógica en componentes
- Evalúa condiciones
- Aplica defaults
- Limpia campos ocultos que ya no aplican
- Detecta ciclos en `requiresAmenities` / `requiresSystems` a build-time

---

## Mandatory taxonomies

El sistema requiere estas taxonomías en `taxonomies/` (ver listado actualizado en el repo):

- `property_types.json`
- `property_environments.json`
- `room_types.json` / `space_types.json`
- `space_features.json`
- `space_availability_rules.json`
- `access_methods.json`
- `accessibility_features.json`
- `parking_options.json`
- `amenity_taxonomy.json`
- `amenity_subtypes.json`
- `amenity_destinations_summary.json` (generado)
- `system_taxonomy.json`
- `system_subtypes.json`
- `policy_taxonomy.json`
- `troubleshooting_taxonomy.json`
- `messaging_touchpoints.json`
- `guide_outputs.json`
- `visibility_levels.json`
- `media_requirements.json`
- `media_asset_roles.json`
- `dynamic_field_rules.json`
- `automation_channels.json`
- `review_reasons.json`
- `contact_roles.json`

---

## UI rule

Si existe taxonomía, la UI debe ofrecer:

- select-only
- radio cards
- chip multi-select
- `Other / custom` **solo** si la taxonomía lo incluye

Nunca un input de texto libre cuando hay taxonomía aplicable.
