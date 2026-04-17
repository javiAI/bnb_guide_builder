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

### Anti-leak gates (rama 10F — `audience=guest`)

Estos gates se aplican cada vez que se publique una `GuideVersion` o se sirva `/g/:slug` con `audience=guest`. Desde 10F están **blindados unitariamente** por `src/test/guest-leak-invariants.test.ts` (tree + markdown + html) sobre la fixture adversarial `src/test/fixtures/adversarial-property.ts`:

1. **No raw JSON en guest**. Ningún `GuideItemField.value` ni `displayValue` visible en `audience=guest` empieza por `{` o `[`, ni contiene la sustring literal `"json":`. El snapshot publicado de una `GuideVersion` pasa por `normalizeGuideForPresentation` antes de persistirse (`publishGuideVersionAction`). Snapshots pre-v3 se re-normalizan al servir (`snapshotPreV3` log).
2. **No enum leaks en guest**. Ningún `displayValue` / `displayFields.value` en `audience=guest` coincide con `TAXONOMY_KEY_PATTERN = /^[a-z]+(_[a-z]+)*\.[a-z_]+$/` (ej: `rm.smoking_outdoor_only`, `ct.host`, `am.wifi`).
3. **No copy editorial del host en guest**. `section.emptyCopy` nunca aparece en un tree con `audience=guest`; solo `emptyCopyGuest` cuando está declarado. Si la sección no tiene `emptyCopyGuest`, se oculta (`hideWhenEmptyForGuest: true`) o emite un empty state neutro.
4. **No labels internos en guest**. Ningún `displayValue` / `label` ni field en `audience=guest` está en `INTERNAL_FIELD_LABEL_DENYLIST` (`"Slot"`, `"Config JSON"`, `"Raw"`, `"Propiedad"`), exportado desde `src/lib/services/guide-presentation.service.ts` como `ReadonlySet<string>`. El test importa el set directamente; el normalizador aplica `sanitizeGuestFields` como red defensiva.
5. **No `presentationType: "raw"` visible en guest**. Ningún `GuideItem` con `presentationType === "raw"` se renderiza en `audience=guest`. Es un sentinel de bug (falló el normalizador / presenter faltante) — el renderer lo oculta y emite log `missing-presenter`. `GuideItem.tsx` añade un guard defensivo `if (item.presentationType === "raw") return null`.

### E2E + accesibilidad (rama 10J, gate compartido por 10G/H/I)

Playwright + `@axe-core/playwright` se introducen como **harness compartido** en la rama `chore/e2e-harness-public-guide` (10J). Una vez mergeada:

- **Viewports**: mobile 375, tablet 768, desktop 1280 (y webkit-mobile 375 como secundario).
- **Fixtures**: `property-empty`, `property-rich`, `property-adversarial` (reutiliza `src/test/fixtures/adversarial-property.ts` de 10F).
- **Gates bloqueantes en CI**: (a) regex anti-leak sobre DOM renderizado — JSON crudo, taxonomy keys; (b) axe-core `serious` / `critical` = 0.
- **Comando**: `npm run test:e2e`.

Ver [docs/FEATURES/GUEST_GUIDE_UX.md](FEATURES/GUEST_GUIDE_UX.md) "Gates de release" para la tabla completa de gates de UX.

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
