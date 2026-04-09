# Tourist Guide App Full-Stack Kit v3

## Cómo ejecutar la aplicación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL de PostgreSQL

# Generar el cliente Prisma y aplicar migraciones
npx prisma generate
npx prisma migrate dev

# Iniciar en desarrollo
npm run dev
```

### Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (http://localhost:3000) |
| `npm run build` | Build de producción |
| `npm run lint` | Linter (ESLint) |
| `npm run typecheck` | Verificación de tipos (TypeScript) |
| `npm run test` | Tests (Vitest) |
| `npm run test:watch` | Tests en modo watch |

### Validadores del bundle

```bash
python3 scripts/validate_bundle.py
python3 scripts/validate_prompt_references.py
python3 scripts/validate_metric_units.py
python3 scripts/validate_screen_inventory.py
python3 scripts/validate_taxonomy_runtime.py
python3 scripts/validate_phase_bundle.py
```

---

Paquete full-stack completo para implementar la aplicación de guías inteligentes para alojamientos turísticos sin depender de nuevas decisiones humanas durante la ejecución, salvo conflictos reales con el código existente.

`version_3` combina:

- la dirección de producto, IA, taxonomías y UX de `version_2`
- la base técnica ya validada del repositorio actual
- los gaps cerrados en datos, contratos, assistant, media, mensajería, publishing, seguridad, QA y release

## Principio de autoridad

Cuando exista solape entre el kit anterior y el repositorio:

- producto, IA, rutas canónicas y UX: manda `version_2`
- labels internas, IDs y código: en inglés estable
- labels visibles en UI: siempre en español
- backend, visibilidad, seguridad, retrieval y release gates: se reaprovecha y endurece la base del repositorio actual

## Resultado esperado

El bundle define:

- visión de producto
- arquitectura del sistema
- modelo de datos canónico
- contratos API
- taxonomías y motor de reglas
- rutas y screen inventory
- prompts de implementación por fase
- skills por dominio
- validadores del bundle
- checklist de aceptación y release

## Orden obligatorio de uso

1. `AGENTS.md` o `CLAUDE.md`
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
12. el prompt de fase activo

## Estructura

- `docs/`: especificación full-stack y reconciliación con el repo
- `taxonomies/`: catálogos, reglas y configuración runtime
- `prompts/`: ejecución por fases sin ambigüedad
- `skills/`: workflows por dominio
- `scripts/`: validadores del bundle
- `checks/`: criterios de aceptación y release gates
- `screen_map.json`: mapa estructurado de pantallas
- `screen_inventory.json`: inventario de pantallas
- `component_inventory.json`: inventario de componentes

## Fases de implementación

1. Foundation and repo alignment
2. Canonical data model and runtime loaders
3. Property creation wizard and workspace shell
4. Core editor sections
5. Taxonomies, dynamic rules, and media prompts
6. Knowledge base, guide surfaces, and publishing
7. Assistant and retrieval
8. Messaging and automation
9. Ops, analytics, settings, activity, and media library
10. QA, hardening, release, and cutover

## Validadores

Ejecutar desde `version_3`:

```bash
python3 scripts/validate_bundle.py
python3 scripts/validate_prompt_references.py
python3 scripts/validate_metric_units.py
python3 scripts/validate_screen_inventory.py
python3 scripts/validate_taxonomy_runtime.py
python3 scripts/validate_phase_bundle.py
```

## Regla de autonomía

Un agente que trabaje con este kit no debe pedir más dirección humana si:

- la fase activa está clara
- los docs de la fase están completos
- no hay contradicción material con el código real

Solo se detiene si:

- descubre una incompatibilidad estructural no cubierta en `docs/REPOSITORY_APPLICATION_GUIDE.md`
- aparece un riesgo de seguridad o visibilidad
- una migración de datos exige decisión humana irreversible
