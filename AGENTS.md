# AGENTS.md

## Lectura obligatoria al empezar

1. `README.md`
2. `docs/MASTER_IMPLEMENTATION_SPEC.md`
3. `docs/IMPLEMENTATION_PLAN.md`
4. `docs/REPOSITORY_APPLICATION_GUIDE.md`
5. `docs/SYSTEM_ARCHITECTURE.md`
6. `docs/DATA_MODEL_AND_PERSISTENCE.md`
7. `docs/API_CONTRACTS.md`
8. `docs/SECURITY_VISIBILITY_AND_AUDIT.md`
9. `docs/QA_EVALS_AND_RELEASE.md`
10. todos los JSON de `taxonomies/`
11. `skills/orchestrator/SKILL.md`

## Reglas no negociables

- ante solape entre spec previa y repo actual, manda `version_2`, ya reconciliada en `version_3`
- labels visibles al usuario: español
- nombres internos, IDs, keys, enums y código: inglés estable
- sistema métrico
- no introducir taxonomías nuevas fuera de `taxonomies/` sin dejarlo explícito en docs y validadores
- no hardcodear catálogos que ya existan en `taxonomies/`
- no mezclar `public`, `booked_guest`, `internal`, `secret`
- `secret` nunca entra en retrieval general, guide pública, preview guest ni drafts de mensajes por defecto
- una misma verdad de negocio debe tener un único write owner
- los cambios de fase deben incluir código, tests, docs y validación

## Fuente de verdad por capa

- taxonomías y reglas declarativas: `taxonomies/*.json`
- contratos de producto y rutas: `docs/MASTER_IMPLEMENTATION_SPEC.md`
- arquitectura técnica: `docs/SYSTEM_ARCHITECTURE.md`
- datos y persistencia: `docs/DATA_MODEL_AND_PERSISTENCE.md`
- contratos externos: `docs/API_CONTRACTS.md`
- fase activa: prompt correspondiente en `prompts/`

## Ejecución autónoma

Cuando el usuario diga `continúa`, `sigue`, `next phase` o equivalente:

1. leer `prompts/ORDER.md`
2. detectar la siguiente fase incompleta
3. leer el prompt de esa fase
4. leer la skill de fase y las docs referenciadas
5. implementar solo esa fase
6. ejecutar validadores de fase y bundle
7. actualizar checklist y estado
8. detenerse al final de la fase

## Fases

1. `01_ADOPT_AND_ALIGN_FOUNDATION.md`
2. `02_IMPLEMENT_CANONICAL_DATA_MODEL.md`
3. `03_IMPLEMENT_CREATION_WIZARD_AND_SHELL.md`
4. `04_IMPLEMENT_CORE_EDITOR_SECTIONS.md`
5. `05_IMPLEMENT_TAXONOMIES_RULES_AND_MEDIA.md`
6. `06_IMPLEMENT_KNOWLEDGE_GUIDE_AND_PUBLISHING.md`
7. `07_IMPLEMENT_ASSISTANT.md`
8. `08_IMPLEMENT_MESSAGING_AUTOMATION.md`
9. `09_IMPLEMENT_OPS_ANALYTICS_SETTINGS.md`
10. `10_QA_HARDEN_RELEASE.md`

## Gate de salida por fase

Una fase solo está cerrada si:

- el alcance coincide exactamente con el prompt de fase
- lint, typecheck y tests relevantes están en verde
- los validadores del bundle siguen pasando
- docs, taxonomías y contratos siguen alineados
- no hay regresión de visibilidad ni secretos

## Skills requeridas

Siempre cargar:

- `skills/orchestrator/SKILL.md`

Y además la skill o skills nombradas por el prompt de fase.
