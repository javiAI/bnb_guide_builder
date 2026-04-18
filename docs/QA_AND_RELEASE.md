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
5. **No `presentationType: "raw"` visible en guest**. Ningún `GuideItem` con `presentationType === "raw"` se renderiza en `audience=guest`. Es un sentinel de bug (falló el normalizador / presenter faltante) — emitido por `rawSentinelPresenter` cuando el `taxonomyKey` no está registrado ni en el allowlist (`sp.`/`am.`/`lp.`). `filterRenderableItems` lo oculta del output guest; `GuideItem.tsx` añade un guard defensivo `if (item.presentationType === "raw") return null`. **Observabilidad**: el normalizador emite **un solo** `console.warn` agregado por invocación con `{ byTaxonomyKey, byCategory }` (categoría `missing-presenter` entre otras) — basta con revisar ese log para identificar qué clave falta cubrir; los tests unitarios de la fixture adversarial disparan el sentinel en vivo (no solo la forma de tipos).

### E2E + accesibilidad (rama 10J, gate compartido por 10G/H/I)

Playwright + `@axe-core/playwright` viven como **harness compartido** desde
`chore/e2e-harness-public-guide` (10J). Características:

- **Viewports**: chromium 375 / 768 / 1280 + webkit-mobile 375 (4 projects).
- **Fixtures**: `empty`, `rich`, `adversarial` registradas en
  [src/test/fixtures/e2e/](../src/test/fixtures/e2e/). `adversarial` reutiliza
  `src/test/fixtures/adversarial-property.ts` (10F) — no se duplica.
- **Ruta dev-only**: `/g/e2e/[fixture]` montada en
  [src/app/g/e2e/[fixture]/page.tsx](../src/app/g/e2e/%5Bfixture%5D/page.tsx),
  gateada por `process.env.E2E === "1"` (responde `notFound()` fuera de E2E).
  El pipeline reproduce línea a línea el de `/g/[slug]/page.tsx`
  (`filterByAudience` → `normalizeGuideForPresentation` → `GuideRenderer`).
- **Specs**:
  - `e2e/public-guide.spec.ts` — smoke: 200 + shell.
  - `e2e/guest-leak-invariants.spec.ts` — invariantes 1–4 sobre el DOM
    renderizado (`main.innerText` como assert primario, `innerHTML` como
    check complementario para invariante 1). La invariante 5
    (`presentationType: "raw"`) sigue cubierta unitariamente porque el
    renderer colapsa esos items a `null`.
  - `e2e/axe-a11y.spec.ts` — axe-core con tags `wcag2a/aa + wcag21a/aa`,
    blocking impacts `serious|critical`. Sin downgrade de severidad.
- **Comandos**: `npm run test:e2e` (canónico — `next build && next start`,
  fiel a producción, requiere DB real) o `npm run test:e2e:dev` (`next dev`,
  iteración local + CI). Servidor en puerto 3100 para no colisionar con
  `next dev` en 3000.
- **CI**: workflow [.github/workflows/ci.yml](../.github/workflows/ci.yml)
  ejecuta dos jobs paralelos (`unit` + `e2e`) en cada PR y push a `main`.
  El job E2E corre en **modo dev** (`test:e2e:dev`) porque la pasada de
  static prerender de `next build` intenta abrir conexión Prisma contra el
  `DATABASE_URL` dummy y falla; `next dev` compila on-demand y evita el
  prerender. La cobertura del harness es idéntica en ambos modos. La
  ejecución canónica con build queda para verificación local pre-PR contra
  una DB real. El job sube `playwright-report/` siempre y `test-results/`
  en fallo (retención 7 días).

Ver [docs/FEATURES/GUEST_GUIDE_UX.md](FEATURES/GUEST_GUIDE_UX.md) "Gates de release" para la tabla completa de gates de UX.

### Pre-Liora release criteria (aplica a ramas funcionales en vuelo)

Mientras la Fase 15 (Liora Design Replatform) no esté activa — condición actual hasta entrega del paquete de diseño — el criterio de "done" visual en ramas funcionales (10G/H/I, Fase 11, Fase 12, Fase 13) se juzga así:

- **Gates bloqueantes** (siguen aplicando idénticos):
  - `npx tsc --noEmit` + `npm run lint` + `npm run test` verdes.
  - Harness E2E de 10J verde (smoke + anti-leak + axe en 4 viewports × 3 fixtures).
  - Axe-core `serious|critical = 0`.
  - Targets interactivos ≥44×44; contraste AA; focus management correcto.
  - Invariantes anti-leak de `audience=guest` (§3 arriba).
- **Gate estético congelado**:
  - No se rechaza una PR por "no sigue la paleta futura" o "el mock Liora prefiere otro spacing". Los tokens actuales (`src/config/design-tokens.ts`) y los mock-ups en `docs/FEATURES/GUEST_GUIDE_UX.md` son MVP operativo, no ground-truth congelado.
  - Sí se rechaza una PR por introducir **familias nuevas** de componentes ad-hoc para "mejorar la paleta" antes de Liora (viola regla 1 de `docs/ARCHITECTURE_OVERVIEW.md` §14: prohibición de duplicados con sufijo de versión).
- **Foco del review de UX**: comportamiento + accesibilidad + reuse de primitivos existentes + coherencia con el sistema config-driven. Polish visual final se difiere a Fase 15.

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
