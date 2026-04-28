# Liora Design Adoption Plan

Living document. Updated by each Liora branch (16A–16G) as work progresses.

---

## 1. Token contract

### 1.1 Entry point

`src/app/design-system.css` is the **single import point** for the Liora foundations in this app.
`layout.tsx` imports `globals.css` first so Tailwind preflight runs before our base rules, then `design-system.css`. This ensures `base.css` body rules (e.g. `line-height: var(--text-base-lh)`) win over Tailwind's `body { line-height: inherit }` preflight. Import order:

```
globals.css
  └─ maplibre-gl/dist/maplibre-gl.css
  └─ @tailwind base/components/utilities        (Tailwind preflight runs here)
design-system.css
  └─ design-system/foundations/styles/base.css  (primitives → semantic → components → shadcn)
  └─ design-system/foundations/styles/themes.css ([data-theme="dark"] bindings)
  └─ :root { --font-family-* bridge }            (next/font vars override primitives.css names)
  └─ src/styles/legacy-aliases.css               (compatibility shims — removed in 16G)
```

### 1.2 Tailwind integration

`tailwind.config.ts` extends `warmAnalyticalTheme` from
`design-system/foundations/tokens/tailwind.tokens.ts`.
Dark mode: `darkMode: ["class", '[data-theme="dark"]']` (Tailwind v3 attribute selector).
Generated `dark:` classes match `[data-theme="dark"]` descendants.

### 1.3 Font loading

IBM Plex Sans, IBM Plex Mono, Newsreader loaded via `next/font/google` in `layout.tsx`.
Variables `--font-sans`, `--font-serif`, `--font-mono` set on `<html>`.
`src/app/design-system.css` bridges them into the foundations names via:
```css
:root {
  --font-family-sans:  var(--font-sans);
  --font-family-serif: var(--font-serif);
  --font-family-mono:  var(--font-mono);
}
```
This block sits after the `@import` rules so the browser uses the optimised `@font-face` declarations generated at build time.

### 1.4 Dark mode infrastructure

Pre-paint inline script in `layout.tsx` `<head>` reads `localStorage.theme`
(`"light" | "dark"` or absent → system), then sets `data-theme` on `<html>` before CSS loads.
`suppressHydrationWarning` on `<html>` prevents React hydration mismatch.
Visible toggle added in **16D** (operator topbar).

---

## 2. Legacy alias registry

All aliases live in `src/styles/legacy-aliases.css`. **Ownership: 16G.**
The `liora-legacy-alias-registry.test.ts` (created in 16A) pins that every alias here
has a `@deprecated` comment and is referenced in this table.

### 2.1 Color — primary action

| Legacy var | Semantic target | Notes |
|---|---|---|
| `--color-primary-50` | `--color-action-primary-subtle` | Lightest tint → olive-50 |
| `--color-primary-100` | `--color-action-primary-subtle` | No exact mid-tint in foundations |
| `--color-primary-200` | `--color-action-primary-subtle` | No exact mid-tint in foundations |
| `--color-primary-300` | `--color-action-primary-subtle` | No exact mid-tint in foundations |
| `--color-primary-400` | `--color-action-primary-hover` | olive-700 |
| `--color-primary-500` | `--color-action-primary` | **Main action color** — olive-600 |
| `--color-primary-600` | `--color-action-primary-hover` | olive-700 |
| `--color-primary-700` | `--color-action-primary-active` | olive-800 |

### 2.2 Color — neutrals

| Legacy var | Semantic target | Notes |
|---|---|---|
| `--color-neutral-0` | `--color-background-page` | warm-25 (~warm white) |
| `--color-neutral-50` | `--color-background-surface` | warm-50 |
| `--color-neutral-100` | `--color-background-subtle` | warm-100 |
| `--color-neutral-200` | `--color-border-default` | warm-200 |
| `--color-neutral-300` | `--color-border-strong` | warm-300 |
| `--color-neutral-400` | `--color-border-emphasis` | warm-400 |
| `--color-neutral-500` | `--color-text-muted` | warm-500 |
| `--color-neutral-600` | `--color-text-secondary` | warm-600 |
| `--color-neutral-700` | `--color-text-primary` | warm-900 (no exact 700) |
| `--color-neutral-800` | `--color-text-primary` | warm-900 |
| `--color-neutral-900` | `--color-background-inverse` | warm-950 |

### 2.3 Color — status

| Legacy var | Semantic target | Notes |
|---|---|---|
| `--color-success-50` | `--color-status-success-bg` | |
| `--color-success-200` | `--color-status-success-border` | Mid-tint; no finer semantic exists |
| `--color-success-300` | `--color-status-success-border` | Mid-tint; no finer semantic exists |
| `--color-success-500` | `--color-status-success-solid` | |
| `--color-success-600` | `--color-status-success-icon` | |
| `--color-success-700` | `--color-status-success-text` | |
| `--color-warning-50` | `--color-status-warning-bg` | |
| `--color-warning-200` | `--color-status-warning-border` | Mid-tint; no finer semantic exists |
| `--color-warning-300` | `--color-status-warning-border` | Mid-tint; no finer semantic exists |
| `--color-warning-400` | `--color-status-warning-border` | Mid-tint; no finer semantic exists |
| `--color-warning-500` | `--color-status-warning-solid` | |
| `--color-warning-600` | `--color-status-warning-icon` | |
| `--color-warning-700` | `--color-status-warning-text` | |
| `--color-warning-800` | `--color-status-warning-text` | Darker shade; mapped to text (nearest) |
| `--color-danger-50` | `--color-status-error-bg` | |
| `--color-danger-200` | `--color-status-error-border` | Mid-tint; no finer semantic exists |
| `--color-danger-300` | `--color-status-error-border` | Mid-tint; no finer semantic exists |
| `--color-danger-500` | `--color-status-error-solid` | |
| `--color-danger-600` | `--color-status-error-icon` | |
| `--color-danger-700` | `--color-status-error-text` | |
| `--color-error-50` | `--color-status-error-bg` | Alternate `error` prefix used by some components |
| `--color-error-300` | `--color-status-error-border` | Alternate prefix |
| `--color-error-500` | `--color-status-error-solid` | Alternate prefix |
| `--color-error-600` | `--color-status-error-icon` | Alternate prefix |
| `--color-error-700` | `--color-status-error-text` | Alternate prefix |
| `--color-info-50` | `--color-status-info-bg` | |
| `--color-info-500` | `--color-status-info-solid` | |

Note: `--color-info-700` was never declared in legacy `globals.css` — no alias created.

### 2.4 Surface shortcuts

| Legacy var | Semantic target |
|---|---|
| `--background` | `--color-background-page` |
| `--foreground` | `--color-text-primary` |
| `--surface` | `--color-background-surface` |
| `--surface-elevated` | `--color-background-elevated` |
| `--border` | `--color-border-default` |

### 2.5 Layout dimensions

| Legacy var | Value in alias | Foundations target | Notes |
|---|---|---|---|
| `--sidebar-width` | `260px` (preserved) | `var(--size-sidebar)` = 240px | Delta of 20px resolved in **16D** when shell is re-skinned; keeping literal prevents layout breakage in 16A |
| `--header-height` | `var(--size-topbar)` | `--size-topbar` = 56px | Values match — mapped directly |

### 2.6 Radius

Decision from Fase -1 of 16A: **Option A** (aliases).
92 source files use `var(--radius-*)` (393 total occurrences).
Migration threshold ≥30 files → aliases in `legacy-aliases.css`, retire in 16G.

These are described as "legacy radius aliases preserving current call sites" — NOT as
equivalents to Tailwind defaults (foundations `borderRadius` scale: xs/sm/md/lg/xl/2xl/full).
Migration path in 16G: replace `var(--radius-md)` with Tailwind `rounded-md` etc. per call site.

| Legacy var | Preserved value | Tailwind migration target |
|---|---|---|
| `--radius-sm` | `0.375rem` (6px) | `rounded-sm` (5px) or `rounded-md` (8px) — per call site |
| `--radius-md` | `0.5rem` (8px) | `rounded-md` (8px) |
| `--radius-lg` | `0.75rem` (12px) | `rounded-lg` (12px) |
| `--radius-xl` | `1rem` (16px) | `rounded-xl` (16px) |

---

## 3. Brand themes guest (permanent)

`src/config/brand-palette.ts` and the `--guide-brand-light`/`--guide-brand-dark` injection
in `guide-renderer.tsx` are **permanent product architecture**, not legacy debt.

These per-property brand colors coexist with foundations:
- The `--guide-brand` CSS var is set inline on the guide root element.
- Guest cards (created in **16C**) consume `var(--guide-brand)` alongside foundations semantic tokens.
- `brand-palette.ts` is **not touched** in any Liora branch.
- The bridge between brand-palette hex values and foundations semantic tokens is
  documented in the 16C section of this plan and in `LIORA_SURFACE_ROLLOUT_PLAN.md`
  (created in 16C).

---

## 4. Per-branch status

| Branch | Status | Surfaces adopted |
|---|---|---|
| `chore/plan-update-liora` | ✅ merged | Package setup, CI gate |
| `16A refactor/liora-token-foundation` | ✅ complete | Token infra, fonts, dark mode pre-paint |
| `16B refactor/liora-core-components` | ⬜ pending | `src/components/ui/` primitives |
| `16C feat/liora-guest-guide-redesign` | ⬜ pending | `/g/:slug` surface |
| `16D feat/liora-operator-shell-redesign` | ⬜ pending | Sidebar, topbar, dark toggle |
| `16E feat/liora-operator-module-rollout` | ⬜ pending | Wizard + module surfaces |
| `16F feat/liora-messaging-assistant-redesign` | ⬜ pending | Messaging + assistant |
| `16G chore/remove-legacy-ui` | ⬜ pending | Remove aliases + legacy code |
