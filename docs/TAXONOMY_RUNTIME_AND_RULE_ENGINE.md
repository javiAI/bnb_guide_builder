# TAXONOMY_RUNTIME_AND_RULE_ENGINE

## 1. Runtime principle

Las taxonomías no son material de diseño. Son runtime configuration versionada.

## 2. Loader contract

Cada taxonomía debe:

- incluir `file`, `version`, `locale`, `units_system`
- exponer `items` o `groups`
- usar IDs estables
- mostrar labels en español

## 3. Dynamic field rule contract

Cada regla tiene:

- `id`
- `trigger`
- `condition`
- `shown_fields`
- `defaults`
- `rationale`

El motor declarativo:

- no duplica lógica en componentes
- evalúa condiciones simples
- aplica defaults
- limpia campos ocultos que ya no aplican

## 4. Required taxonomies

- `property_types.json`
- `room_types.json`
- `policy_taxonomy.json`
- `access_methods.json`
- `amenity_taxonomy.json`
- `amenity_subtypes.json`
- `troubleshooting_taxonomy.json`
- `messaging_touchpoints.json`
- `guide_outputs.json`
- `visibility_levels.json`
- `media_requirements.json`
- `space_types.json`
- `dynamic_field_rules.json`
- `automation_channels.json`
- `media_asset_roles.json`
- `review_reasons.json`

## 5. UI rule

Si existe taxonomía, la UI debe ofrecer:

- select-only
- radio cards
- chip multi-select
- `Other / custom` solo si la taxonomía lo incluye
