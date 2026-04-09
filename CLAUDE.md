# CLAUDE.md

Implementa exactamente el paquete `version_3`.

## Orden de lectura

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
11. `docs/CONFIG_DRIVEN_ARCHITECTURE.md`
12. `taxonomies/*.json`
13. `skills/orchestrator/SKILL.md`
14. skill de la fase activa
15. prompt de la fase activa

## Reglas

- no improvisar producto fuera de la spec
- elegir siempre el criterio reconciliado de `version_3`
- labels visibles: español
- IDs, código, nombres internos y enums: inglés
- sistema métrico
- secretos segregados y auditados
- no mezclar guest, AI, internal y sensitive
- no saltar de fase sin validación explícita
- arquitectura config-driven: taxonomías, campos, dependencias, media y renderizado viven en configuración centralizada (`src/config/` y `taxonomies/`), no hardcodeados en componentes React
- añadir amenity, policy, access method o sección = editar config/taxonomía, no tocar UI
