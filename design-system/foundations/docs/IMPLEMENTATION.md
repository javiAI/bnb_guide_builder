# Implementation Guide

## 1. Install
Copy `design-system/` into your repo. Import `foundations/styles/base.css` once at the application root, or use your app-level wrapper stylesheet (e.g. `src/app/design-system.css`) as the single entry point.

```tsx
// app/layout.tsx (Next.js App Router)
import "@/design-system/foundations/styles/base.css";
```

`base.css` composes `primitives.css → semantic.css → components.css → shadcn.css`.

## 2. Fonts
Use `next/font` (preferred) or self-hosted files. Token files declare names only — they don't load fonts.

```tsx
import { IBM_Plex_Sans, IBM_Plex_Mono, Newsreader } from "next/font/google";

const sans  = IBM_Plex_Sans({ subsets:["latin"], weight:["400","500","600"], variable:"--font-sans" });
const serif = Newsreader({ subsets:["latin"], weight:["400","500","600"], style:["normal","italic"], variable:"--font-serif" });
const mono  = IBM_Plex_Mono({ subsets:["latin"], weight:["400","500","600"], variable:"--font-mono" });

// Map next/font CSS variables onto our token names in globals.css:
// :root {
//   --font-family-sans:  var(--font-sans);
//   --font-family-serif: var(--font-serif);
//   --font-family-mono:  var(--font-mono);
// }

export default function Root({ children }) {
  return <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>{children}</html>;
}
```

## 3. Tailwind
```ts
// tailwind.config.ts
import warmAnalyticalTheme from "./design-system/foundations/tokens/tailwind.tokens";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", "[data-theme=\"dark\"]"],
  theme: { extend: warmAnalyticalTheme },
};
```

```tsx
<button className="bg-action-primary text-action-primaryFg h-btn-md rounded-sm px-3 transition duration-fast">
  Save changes
</button>
```

## 4. shadcn/ui
`tokens/shadcn.css` already bridges every shadcn variable. Drop shadcn components in unmodified — they will adopt the system.

```bash
npx shadcn@latest add button card dialog
```

Note: shadcn `--accent` maps to a neutral interactive surface (not terracotta). For brand emphasis, use `--color-accent-default` directly in your own components.

## 5. Theming
Toggle dark mode by setting `data-theme="dark"` on `<html>`. Avoid FOUC with an inline pre-paint script:

```html
<script>
  (function () {
    var t = localStorage.getItem("theme") || "auto";
    var dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  })();
</script>
```

Per-product themes: scope inside `[data-theme-brand="…"]` and override semantic tokens only.

## 6. Density
```tsx
<table data-density="compact">      {/* 32px rows */}
<table data-density="comfortable">  {/* 44px rows */}
```
Components read `data-density` and switch row height tokens.

## 7. Charts
```ts
const palette = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];
```
Reserve status colors (`--color-chart-positive`, `-negative`, `-threshold`) for semantic series only.

---

## 8. Token-extension protocol

Adding tokens is a contract change. Follow this sequence; never skip a step.

1. **Primitive** — add the raw OKLCH/dimension to `tokens/primitives.css` only if no existing primitive fits. Re-use beats invention.
2. **Semantic** — bind a semantic token to the primitive in `tokens/semantic.css`. Name it after its **role** (`--color-action-warning`), not its color (`--color-orange-500`).
3. **Dark mode** — every new semantic token must have a dark-mode value in `[data-theme="dark"]`. No exceptions.
4. **Component** (if component-specific) — add a `--{component}-{property}` token in `tokens/components.css` that points at the semantic.
5. **Mirror** — update `tokens.json` (W3C) and `tokens/tailwind.tokens.ts`.
6. **Document** — add the rule and rationale to `DESIGN_SYSTEM.md`.
7. **Test** — light + dark contrast verified against the AA matrix.

Components must not reference primitives directly. The rule is enforced via lint (see §10).

---

## 9. Governance

### Roles
- **Maintainers** (1–3 designers + 1 engineer) own primitives + semantic layer. All PRs to `tokens/primitives.css` and `tokens/semantic.css` require maintainer approval.
- **Contributors** can propose new component tokens via PR; maintainer review required.
- **Consumers** (product teams) consume tokens — never patch them locally.

### Versioning (semver)
- **Patch** — primitive value tweak that preserves contrast (e.g. olive-600 lightness +1%).
- **Minor** — new semantic or component token; new variant of an existing component.
- **Major** — renamed/removed token, changed token mapping, breaking shadcn bridge change.

Every release ships:
- `CHANGELOG.md` entry with before/after token values.
- Codemod (jscodeshift) for renames/removals.
- Visual regression diff (Chromatic or equivalent) for affected components.

### Deprecation
1. Mark token deprecated in `DESIGN_SYSTEM.md` and add `/* @deprecated use … */` comment.
2. Ship codemod the same release.
3. Remove no earlier than next major release.

### Cadence
- Token PRs reviewed within 2 business days.
- Quarterly audit: contrast ratios, unused tokens, primitive drift.

---

## 10. Validation

### Lint
- **Stylelint** rule: disallow hex/rgb/oklch literals outside `tokens/primitives.css`. Custom plugin pattern: `/^(#|rgb\(|oklch\()/` triggers an error.
- **Stylelint** rule: disallow primitive variable references (`--warm-*`, `--olive-*`, `--terra-*`, `--info-*`, `--gray-*`, `--success-*`, `--warning-*`, `--error-*`) outside `tokens/primitives.css` and `tokens/semantic.css`. Components must consume semantic tokens only — `components.css` is checked too.
- **Stylelint** rule: disallow undefined `var(--…)` references — every CSS variable used must be defined somewhere in `tokens/` or `styles/`.
- **ESLint** rule (custom): forbid inline `style={{ color: '#…' }}`; require `var(--…)` references.

### CI checks
- `tokens-diff.test.ts` — fails if `tokens.json` and `tailwind.tokens.ts` and `semantic.css` disagree on any token name. Single-source-of-truth check.
- `dark-parity.test.ts` — fails if any semantic token defined in `:root` is missing in `[data-theme="dark"]`.
- `contrast.test.ts` — fails if any pair in the AA matrix drops below 4.5 (text) or 3.0 (large/icon).
- `axe.test.ts` — runs axe-core on every Storybook story; fails on any violation.

### Visual regression
- Chromatic on every PR; diff threshold tuned per component.
- Focus screenshots include light + dark + forced-colors.

### Definition of Done (per component)
- [ ] All states: rest, hover, active, focus-visible, disabled, loading.
- [ ] Light + dark variants render correctly.
- [ ] Storybook a11y addon passes.
- [ ] Keyboard-only walkthrough passes.
- [ ] VoiceOver/NVDA announces correctly.
- [ ] Tokens consumed only at the component-token layer (no primitive leaks).
- [ ] Documented in `DESIGN_SYSTEM.md` with usage + don'ts.
