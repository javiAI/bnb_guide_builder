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

### 8. Presenter registry (`src/config/registries/presenter-registry.ts`)

Frontera **modelo ↔ huésped** (estable desde 10F). Traduce `GuideItem` (modelo interno: enums, JSON, claves taxonómicas) a un shape de presentación consumible directamente por el renderer (`displayValue`, `displayFields`, `presentationType`, `presentationWarnings`).

- **Resolución** (5 pasos, `getPresenter(taxonomyKey)`):
  1. `null`/`undefined`/`""` → `genericTextPresenter` (items derivados sin taxonomía).
  2. Exact match en `EXACT_PRESENTERS`.
  3. Longest-prefix match en `PREFIX_PRESENTERS` (sorted por longitud).
  4. Prefijo en `FALLBACK_ALLOWED_PREFIXES` (`sp.`, `am.`, `lp.`) → `genericTextPresenter`. Intencional: el resolver ya sustituye `taxonomyLabel` en `value` antes del normalizador, así que pasar por texto plano es correcto. `listFallbackAllowedPrefixes()` se exporta para el test de cobertura — añadir un prefijo requiere actualizar la aserción.
  5. Sin match → `rawSentinelPresenter` (emite `presentationType: "raw"` + warning `missing-presenter taxonomyKey=...`; el huésped ve shape vacío, operadores ven el value raw para triage).
- Presenters activos:
  - Prefix `pol.` → `policyPresenter` (normas de casa, políticas).
  - Prefix `fee.` → `policyPresenter` (tarifas, mismo shape que pol).
  - Prefix `ct.` → `contactPresenter` (contactos; genera `href: "tel:+..."` / `mailto:...`).
  - Allowlist `sp.` / `am.` / `lp.` → `genericTextPresenter` (fallback explícito).
  - Sin match → `rawSentinelPresenter` (sentinel; el item se filtra del output guest vía `filterRenderableItems`).
- Coverage guard: `src/test/presenter-coverage.test.ts` verifica 100% sobre taxonomías cubiertas, invariancia del allowlist y que prefijos desconocidos rutean al sentinel.
- Un presenter jamás consulta DB ni muta input. Toma `(item, context)` → `{ displayValue, displayFields, presentationType, warnings[] }`. Corre dentro del normalizador puro `normalizeGuideForPresentation(tree, audience)`.
- Añadir soporte para una nueva taxonomía visible al huésped: (1) ampliar entries en la taxonomía con `guestLabel` / `guestDescription` / `icon`, (2) registrar presenter por `taxonomyKey` exacto o por prefijo en el array apropiado del registry, (3) `presenter-coverage.test.ts` verde.
- El renderer consume **siempre** `displayValue` / `displayFields`, nunca `value` / `fields` raw. El normalizador es la única fuente de verdad de presentación.
- Red defensiva: el normalizador aplica `sanitizeGuestFields` sobre todos los fields en `audience=guest`, descartando los cuyo label está en `INTERNAL_FIELD_LABEL_DENYLIST` (exportado del service), cuyo value empieza por `{`/`[` (raw JSON), o matchea `TAXONOMY_KEY_PATTERN`. Garantiza las 5 invariantes de [QA_AND_RELEASE.md §3](QA_AND_RELEASE.md) aun si un presenter falla.
- **Observabilidad agregada**: el normalizador hila un `WarningAggregator` por toda la recursión y emite **un solo** `console.warn` al final por invocación, con metadata `{ byTaxonomyKey, byCategory }` (categorías: `missing-presenter`, `raw-json`, `taxonomy-key`, `internal-label`, `other`). No loggear por item — rompe el agregado. `expandObject` en `policyPresenter` propaga su propio array de warnings para que drops dentro de JSON anidado (p.ej. `hidden_key: "rm.*"` dentro de `pol.pets`) también entren en el agregado.

### 9. Quick-action registry (`src/config/registries/quick-action-registry.ts`)

Frontera **tree normalizado ↔ botones operativos del hero** (rama 10G). Declara las 5 acciones universales disponibles en el hero (`gs.essentials`) y las resuelve contra el `GuideTree` ya normalizado.

- **Acciones activas**: `wifi_copy`, `call_host`, `whatsapp_host`, `maps_open`, `access_how`. Cada una declara `id`, `label`, `ariaLabel`, `kind` (`copy | tel | whatsapp | maps | anchor`), opcional `toastOnSuccess`, y un `resolve(tree)` puro.
- **Degradación grácil**: si `resolve` retorna `null` (dato ausente — p.ej. sin contraseña Wi-Fi, sin teléfono de anfitrión), la acción se omite del render. Nunca se muestra un botón "roto".
- **Wiring por sección**: `quickActionKeys: string[]` en `guide_sections.json` por sección (hoy solo `gs.essentials`). El Zod del loader lo parsea; al cargar el módulo, `validateSectionReferences()` verifica que cada clave exista y no se duplique dentro de la misma sección — fallo loud en boot si falta.
- **Boot validation**: `validateRegistry()` chequea cada entrada con Zod strict (`id === key`, `kind ∈ QUICK_ACTION_KINDS`, `kind === "copy"` ⇒ `toastOnSuccess` requerido). Registro corrupto = error de arranque.
- **Añadir una nueva quick action** (ejemplo: `whatsapp_cohost`):
  1. Declarar el objeto `QuickAction` en `quick-action-registry.ts` (id, label, ariaLabel, kind, resolve contra el tree).
  2. Registrarlo en `QUICK_ACTIONS`.
  3. Listarlo en `quickActionKeys` de la sección correspondiente en `taxonomies/guide_sections.json`.
  4. Si el `kind` es nuevo: extender `QUICK_ACTION_KINDS` y añadir la rama en `hrefFor()` de `quick-action-button.tsx` (o un handler específico si no es un link). Targets ≥44×44 es invariante: no bajar tamaño en CSS.
- **Fuente de datos**: `resolve` consulta el tree ya normalizado — consume `displayValue` / `displayFields`, **nunca** `value` / `fields` raw. Si tu acción necesita un dato nuevo, propágalo upstream (resolver o presenter) antes de leerlo aquí.
- **No se trackean clicks**: el hero no emite métricas ni `sendBeacon`. Añadir tracking es una decisión de producto posterior a 10G.

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

Los valores válidos para `type` están centralizados en `src/config/registries/field-type-registry.ts` (`SubtypeFieldType`): `boolean`, `text`, `text_optional`, `sensitive_text`, `password`, `markdown_short`, `textarea`, `enum`, `enum_optional`, `number`, `number_optional`, `date`, `time_range_optional`, `number_list_optional`. Un `type` desconocido en taxonomía hace que `getFieldType()` lance en boot (fallo loud, no silent fallback a texto). Añadir un tipo nuevo = una entrada en el registry + su renderer en `field-type-renderers.tsx`; los tests de cobertura y extensión (`src/test/field-type-coverage.test.ts`, `src/test/field-type-renderers.test.tsx`) fuerzan paridad entre ambos mapas.

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
| Presenter registry | ✅ | | Guest humanization (10F) |
| Quick-action registry | ✅ | | Hero actions (10G) |
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
- `completeness_rules.json` — pesos/umbrales del scoring de completitud. Parseada con Zod en el loader; reglas accesibles vía `getCompletenessRule(sectionKey)` (throw si la sección no existe).
- `guide_sections.json` — declaración de secciones del Guide rendering engine (rama 9A). Campos: `id`, `label`, `order`, `maxVisibility`, `sortBy` (`taxonomy_order | recommended_first | alpha | explicit_order`), `emptyCtaDeepLink`, `resolverKey`, `includesMedia`, `isHero?`, `isAggregator?`, `sourceResolverKeys?`, `journeyStage?`, `emptyCopy?` (audience **internal**), `emptyCopyGuest?` (audience **guest**; añadido en 10F), `hideWhenEmptyForGuest?` (añadido en 10F), `quickActionKeys?` (array de IDs del `quick-action-registry`; añadido en 10G). Parseada y validada con Zod en el loader; `loadGuideSections()` falla en boot si un `resolverKey` no está en `GUIDE_RESOLVER_KEYS` o si hay `id`/`resolverKey` duplicados. Los getters `getGuideSectionConfig(sectionId)` y `getGuideSectionByResolverKey(key)` devuelven `undefined` si la clave no existe.
- `policy_taxonomy.json`, `contact_roles.json`, `amenity_taxonomy.json` — a partir de 10F cada entry **debe** declarar `guestLabel`, `guestDescription`, `icon`, `heroEligible`, `quickActionEligible`, `guestCriticality` (valores concretos — defaults Zod `heroEligible: false`, `guestCriticality: "normal"`). `src/test/presenter-coverage.test.ts` falla si una clave no tiene presenter registrado.

---

## Guide rendering engine — resiliencia (rama 9A)

El servicio `GuideRenderingService.composeGuide(propertyId, audience)` produce un `GuideTree` tipado desde entidades canónicas. El compromiso arquitectónico es que **cambios en taxonomías y entidades no requieren tocar el motor**:

| Cambio | ¿Requiere código? | Mecanismo |
|---|---|---|
| Añadir/borrar `Space`, `AmenityInstance`, `Contact`, etc. | No | Iteración sobre colecciones de la entidad |
| Nuevo tipo en taxonomía (`am.X`, `sp.Y`, `sys.Z`) | No | Labels y metadata desde `taxonomy-loader` |
| Deprecar una taxonomy key con instancias vivas | No | Fallback: `GuideItem { deprecated: true, rawKey }` — no throw |
| Nuevo campo en un subtype | No | Iteración sobre `subtype.fields[]` + formateo vía `field-type-registry` |
| Cambiar `type` de un campo | No | El registry resuelve el nuevo formatter |
| Nueva sección del guide | Sí (1 entrada + 1 resolver) | Añadir a `guide_sections.json` + handler en el servicio; `guide-sections-coverage.test.ts` falla si desemparejados |
| Quitar sección entera | No (borrar entrada) | El test de cobertura detecta resolvers huérfanos |
| Nuevo `VisibilityLevel` en `visibility_levels.json` | Sí (1 entrada en `src/lib/visibility.ts`) | `filterByAudience` delega en `canAudienceSee` de `visibility.ts`; añadir un nivel requiere actualizar `VISIBILITY_ORDER` allí |
| Reordenar secciones | No | Campo `order` en `guide_sections.json` |
| Humanizar una key taxonómica al huésped (rama 10F) | No código, sí config | Añadir `guestLabel`/`guestDescription`/`icon` en la taxonomía; registrar presenter por key o prefijo en `presenter-registry.ts`; `presenter-coverage.test.ts` falla si falta |
| Añadir sección con empty state humano al huésped (10F) | No | `emptyCopyGuest` en `guide_sections.json`; `hideWhenEmptyForGuest: true` oculta en audience guest cuando vacía |
| Añadir una quick action al hero (rama 10G) | Sí (1 entrada en registry + 1 key en `guide_sections.json`) | Declarar `QuickAction` en `quick-action-registry.ts`; listar su id en `quickActionKeys` de la sección; `validateSectionReferences()` en boot falla si la clave no existe o se duplica. Si `resolve` retorna `null`, el botón se omite (graceful degradation) |
| Subir `GUIDE_TREE_SCHEMA_VERSION` (10F pasa v2 → v3) | Sí (bump constante) | Renderer acepta snapshots pre-v3 con log `snapshotPreV3` + normalización al servir |

**Invariantes garantizadas por tests**:

- `guide-no-hardcoded-ids.test.ts`: el servicio no contiene comparaciones `=== "am.*"`, `=== "sp.*"`, `=== "sys.*"`, `=== "pol.*"`. Cero IDs hardcoded.
- `guide-sections-coverage.test.ts`: toda sección declarada tiene resolver; todo resolver está declarado.
- `guide-rendering-resilience.test.ts`: keys deprecadas, types desconocidos y entidades ausentes degradan a `GuideItem` marcado, nunca lanzan.
- `guest-leak-invariants.test.ts` (10F): en `audience=guest`, enforce el set canónico de 5 invariantes documentado en [QA_AND_RELEASE.md §3 "Anti-leak gates"](QA_AND_RELEASE.md) — (1) no JSON crudo (no `{` / `[` / `"json":`), (2) no claves taxonómicas (regex `^[a-z]+(_[a-z]+)*\.[a-z_]+$`), (3) no `emptyCopy` editorial del host, (4) no labels de la deny-list (`"Slot"`, `"Propiedad"`, `"Config JSON"`...), (5) no items con `presentationType: "raw"` renderizados.
- `presenter-coverage.test.ts` (10F): para cada key de `policy_taxonomy` / `contact_roles` / `amenity_taxonomy` existe un presenter registrado o está en allowlist explícita.

**Regla dura para futuras ramas**: cualquier feature que añada lógica de dominio al guide engine debe apoyarse en taxonomía y registry, no en switch statements sobre IDs.

---

## UI rule

Si existe taxonomía, la UI debe ofrecer:

- select-only
- radio cards
- chip multi-select
- `Other / custom` **solo** si la taxonomía lo incluye

Nunca un input de texto libre cuando hay taxonomía aplicable.

### Punto de inyección del replatform visual

El sistema config-driven está diseñado para sobrevivir a un replatform visual integral (Fase 15 Liora) sin tocar taxonomías, engines ni resolvers. El punto de inyección es triple:

- **Tokens** — `src/config/design-tokens.ts` es la única fuente de declaración de variables CSS. Cambiar skin = swap de tokens + re-skin de primitivos.
- **Registries** — `renderer-registry`, `presenter-registry`, `media-registry` mapean `resolverKey`/`taxonomyKey`/`mimeType` a renderers/presenters. Un nuevo skin sustituye el renderer React, **nunca** la clave taxonómica ni el presenter de salida.
- **Primitivos compartidos** — hoy los primitivos viven en `src/components/ui/` (kebab-case: `collapsible-section.tsx`, `primary-cta.tsx`, `radio-card-group.tsx`, `checkbox-card-group.tsx`, `info-tooltip.tsx`, `number-stepper.tsx`, `badge.tsx`, `banner.tsx`, `tooltip.tsx`, `delete-confirmation-button.tsx`, `inline-save-status.tsx`, `location-map.tsx`) y los renderers guest en `src/components/public-guide/` (`guide-renderer.tsx`, `section-card.tsx`, `guide-item.tsx`, etc.). Los nombres spec de `docs/FEATURES/GUEST_GUIDE_UX.md` (`HeroCard`, `EssentialCard`, `StandardCard`, `WarningCard`) son placeholders a materializar por composición en rama 15A/B. Estos cambian de look en un replatform; sus consumidores (section editors, guide renderers) no cambian.

Reglas anti-legacy que protegen esta frontera: ver `docs/ARCHITECTURE_OVERVIEW.md` §14.
