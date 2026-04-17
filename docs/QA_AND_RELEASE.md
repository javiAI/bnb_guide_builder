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

### Anti-leak gates (rama 10F en adelante — `audience=guest`)

Estos gates se aplican cada vez que se publique una `GuideVersion` o se sirva `/g/:slug` con `audience=guest`. Enforced por `src/test/guest-leak-invariants.test.ts` + Playwright sobre fixture adversarial:

1. **No raw JSON en guest**. Ningún `GuideItemField.value` ni `displayValue` visible en `audience=guest` empieza por `{` o `[`, ni contiene la sustring literal `"json":`. El snapshot publicado de una `GuideVersion` se chequea al publicar; `/g/:slug` se chequea en integración.
2. **No enum leaks en guest**. Ningún `displayValue` / `displayFields.value` en `audience=guest` coincide con el patrón de clave taxonómica `^[a-z]+(_[a-z]+)*\.[a-z_]+$` (ej: `rm.smoking_outdoor_only`, `ct.host`, `am.wifi`).
3. **No copy editorial del host en guest**. `section.emptyCopy` nunca aparece en un tree con `audience=guest`; solo `emptyCopyGuest` cuando está declarado. Si la sección no tiene `emptyCopyGuest`, se oculta (`hideWhenEmptyForGuest: true`) o emite un empty state neutro.
4. **No labels internos en guest**. Ningún `displayValue` / `label` en `audience=guest` está en la deny-list mantenida en `src/test/guest-leak-invariants.ts` (`"Slot"`, `"Propiedad"`, `"Config JSON"`, `"Raw"`, etc.). La deny-list crece cuando QA detecta un leak nuevo.

Complementariamente: **accesibilidad AA** (axe-core 0 violations serious/critical) y **gates visuales** Playwright en 3 viewports (`375x667`, `768x1024`, `1280x800`) son obligatorios desde 10F — ver [docs/FEATURES/GUEST_GUIDE_UX.md](FEATURES/GUEST_GUIDE_UX.md) "Gates de release".

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
