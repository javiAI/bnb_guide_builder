# Design System Package

This folder contains the approved design-system foundation and visual references for the `bnb_guide_builder` migration to Liora ("Warm Analytical Minimalism").

The package has two clearly separated layers:

1. `foundations/` — the implementation source of truth (tokens, base styles, Tailwind theme, dark mode infra).
2. `references/liora-ui-kits/` — static visual references only (HTML kits for operator, messaging, guest).

Do not treat the reference UI kits as a second design system. They are useful for layout, product patterns, hierarchy and interaction direction, but production implementation must use the tokens, rules and documentation from `foundations/`.

## Folder structure

```txt
design-system/
  README.md

  foundations/
    docs/
      ACCESSIBILITY.md
      DESIGN_SYSTEM.md
      Foundation.html
      IMPLEMENTATION.md
    styles/
      base.css
      themes.css
    tokens/
      primitives.css
      semantic.css
      components.css
      shadcn.css
      tailwind.tokens.ts
      tokens.json

  references/
    liora-ui-kits/
      README.md
      REFERENCE_RULES.md
      colors_and_type.css
      assets/
        favicon.svg
        liora-app-icon.svg
        liora-monogram.svg
        liora-wordmark.svg
      ui_kits/
        operator/
          index.html
          subpages.html
          operator.css
        messaging/
          index.html
        guest/
          index.html

  docs/
    CLAUDE_CODE_USAGE.md
    DESIGN_MIGRATION.md
    LIORA_REFERENCE_MAPPING.md
```

## Consumed by

This package is **code of the app**, not design hand-off material. It is consumed at build time:

- **Next.js runtime** (from Rama 16A onwards) imports `foundations/styles/base.css` (which composes `primitives.css → semantic.css → components.css → shadcn.css`) and `foundations/styles/themes.css` via the wrapper `src/app/design-system.css`. The wrapper is the single entry point — never import deep paths from the app.
- **Tailwind CSS** consumes `foundations/tokens/tailwind.tokens.ts` (export `warmAnalyticalTheme`) from `tailwind.config.ts` as `theme.extend`. Dark mode is wired via `darkMode: ["class", '[data-theme="dark"]']` (Tailwind v3 syntax).
- **CI** runs `npm run validate:design-system` (script: [`scripts/validate-design-system.ts`](../scripts/validate-design-system.ts)) on every PR that touches `design-system/**` to verify structural integrity, dark coverage, no residues, and that the package is not being silently re-ignored by `.gitignore`.

The `references/liora-ui-kits/` layer is **never** imported at runtime. `colors_and_type.css` carries a `REFERENCE ONLY` header that the validation script enforces.

## Versioning

This package is part of the app repo and follows the normal PR/review/CI flow. New versions from design land as PRs (`chore` or `feat` depending on scope) — never as out-of-band ZIP hand-offs. The validation script + the cross-cutting tests `liora-token-coverage` and `liora-no-primitive-leak` (introduced in Rama 16A) act as the safety net for any token rename or removal.

## Migration status

Adoption across the product runtime happens in 7 sequential branches (16A–16G) defined in [`docs/MASTER_PLAN_V2.md`](../docs/MASTER_PLAN_V2.md) §FASE 16. Read [`docs/DESIGN_MIGRATION.md`](docs/DESIGN_MIGRATION.md) before starting any Liora branch — it carries the legacy → semantic mapping, decisions deferred from the chore, and the per-branch gate checklist.
