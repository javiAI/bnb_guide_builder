# 00_START_HERE

Lee y aplica en este orden:

1. `README.md`
2. `AGENTS.md`
3. `docs/MASTER_IMPLEMENTATION_SPEC.md`
4. `docs/IMPLEMENTATION_PLAN.md`
5. `docs/REPOSITORY_APPLICATION_GUIDE.md`
6. `docs/SYSTEM_ARCHITECTURE.md`
7. `docs/DATA_MODEL_AND_PERSISTENCE.md`
8. `docs/API_CONTRACTS.md`
9. `docs/SECURITY_VISIBILITY_AND_AUDIT.md`
10. `docs/QA_EVALS_AND_RELEASE.md`
11. todos los JSON de `taxonomies/`
12. `skills/orchestrator/SKILL.md`

Después:

- genera checklist local de implementación
- detecta conflictos con el repo actual
- clasifica reutilizable / refactor / descartable
- ejecuta:
  - `python3 scripts/validate_bundle.py`
  - `python3 scripts/validate_prompt_references.py`
  - `python3 scripts/validate_metric_units.py`
  - `python3 scripts/validate_screen_inventory.py`
  - `python3 scripts/validate_taxonomy_runtime.py`
  - `python3 scripts/validate_phase_bundle.py`
