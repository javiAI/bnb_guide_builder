# QA_EVALS_AND_RELEASE

## 1. Required test layers

- unit
- integration
- e2e smoke
- assistant evals
- visibility regression

## 2. Phase release gates

Cada fase requiere:

- lint green
- typecheck green
- tests relevantes green
- validadores del bundle green
- docs actualizadas

## 3. Final release gates

- no labels visibles en inglés
- no unidades imperiales
- no visibilidad incorrecta
- no secret leakage
- guest guide publishable
- assistant con citations y gating
- messaging preview y automations válidos
- media y review queue funcionales

## 4. Expected commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:smoke
npm run eval:assistant
python3 scripts/validate_bundle.py
python3 scripts/validate_prompt_references.py
python3 scripts/validate_metric_units.py
python3 scripts/validate_screen_inventory.py
python3 scripts/validate_taxonomy_runtime.py
python3 scripts/validate_phase_bundle.py
```
