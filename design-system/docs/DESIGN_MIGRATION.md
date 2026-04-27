# Design Migration — Liora Replatform Field Guide

This document is read at the start of every Liora branch (16A–16G). It carries the **current state of the repo**, the **legacy → semantic mapping**, the **decisions deferred from the chore**, and the **per-branch gate checklist**.

It is a living document. Each Liora branch updates the relevant section as work progresses.

---

## 1. Current state of the repo (snapshot at chore/plan-update-liora)

### 1.1 Stack confirmed

- **Next.js**: `15.5.14` (App Router).
- **React**: `19.1.0`.
- **Tailwind CSS**: `^3.4.19` → dark mode syntax must be `darkMode: ["class", '[data-theme="dark"]']` (attribute selector as second element). Tailwind v4 CSS-first config (`@variant dark`) does not apply.
- **Fonts (today)**: `Geist` + `Geist Mono` via `next/font/google` in `src/app/layout.tsx`. To be replaced in 16A by `IBM Plex Sans` + `IBM Plex Mono` + `Newsreader` (foundations spec).
- **Radix UI (today)**: minimal — `dialog`, `toast` only. Selective expansion in 16B (Select, Tabs).
- **shadcn**: not present. NOT adopted wholesale. Per-component justification required in `LIORA_COMPONENT_MAPPING.md` if a primitive is adopted in 16B.
- **CVA / tailwind-merge / clsx / lucide-react**: not present. Added in **16B**, not 16A.
- **CSP**: no headers in `next.config.ts` (133 B file) and no meta CSP in `src/app/layout.tsx`. The 16A pre-paint inline script does NOT require a nonce.

### 1.2 Where tokens live today (legacy)

| Surface | File | LOC | Status |
|---|---|---|---|
| Global tokens | `src/app/globals.css` | 95 | Legacy, vacated in 16A |
| Guest guide CSS | `src/components/public-guide/guide.css` | 1,278 | Rewritten in 16C across 7 mandatory commits |
| Brand palette per-property (guest) | `src/config/brand-palette.ts` | — | **Permanent**. Not touched. Bridged to semantic tokens in 16C. |

### 1.3 Where tokens live going forward (Liora)

| Layer | File | Owner |
|---|---|---|
| Primitives (OKLCH + dimensions) | `design-system/foundations/tokens/primitives.css` | foundations |
| Semantic | `design-system/foundations/tokens/semantic.css` | foundations |
| Component | `design-system/foundations/tokens/components.css` | foundations |
| shadcn bridge | `design-system/foundations/tokens/shadcn.css` | foundations |
| Tailwind theme export | `design-system/foundations/tokens/tailwind.tokens.ts` (`warmAnalyticalTheme`) | foundations |
| W3C tokens (mirror) | `design-system/foundations/tokens/tokens.json` | foundations |
| Base reset + composition | `design-system/foundations/styles/base.css` (composes primitives → semantic → components → shadcn) | foundations |
| Theme infrastructure (`[data-theme="dark"]`, `[data-theme-brand="…"]`) | `design-system/foundations/styles/themes.css` | foundations |
| Wrapper (single entry point from app) | `src/app/design-system.css` (created in 16A) | app |

The wrapper imports in this order: `base.css` → `themes.css` → `legacy-aliases.css` (from `src/styles/`). Then `globals.css` loads after the wrapper in `layout.tsx` for resets that survive `base.css`.

---

## 2. Legacy → semantic mapping (registered for 16A)

These aliases are **registered legacy debt**. They are introduced in `src/styles/legacy-aliases.css` in **16A** and **fully removed in 16G** by grep gate. The `liora-legacy-alias-registry.test.ts` (created in 16A) validates that every alias listed below has an entry in `LIORA_DESIGN_ADOPTION_PLAN.md` with ownership 16G.

### 2.1 Color aliases (cerrada — adding new aliases requires a doc entry)

| Legacy var (current) | Semantic target (foundations) |
|---|---|
| `--color-primary-{50,100,200,400,500,600,700}` | `--color-action-primary*` and interactive variants |
| `--color-neutral-{0,50,100,200,300,400,500,600,700,800,900}` | `--color-background-*` and `--color-text-*` semantic |
| `--color-success-{50,500,700}` | `--color-status-success-{bg,solid,text}` |
| `--color-warning-{50,500,700}` | `--color-status-warning-{bg,solid,text}` |
| `--color-danger-{50,500,700}` | `--color-status-error-{bg,solid,text}` |
| `--color-info-{50,500,700}` | `--color-status-info-{bg,solid,text}` |
| `--background` | `--color-background-page` |
| `--foreground` | `--color-text-primary` |
| `--surface` | `--color-background-surface` |
| `--surface-elevated` | `--color-background-elevated` |
| `--border` | `--color-border-default` |

### 2.2 Layout aliases

| Legacy var | Semantic target |
|---|---|
| `--sidebar-width` | `var(--width-sidebar)` (foundations: `240px`) |
| `--header-height` | `var(--height-topbar)` (foundations: `56px`) |

Each alias declared with comment `/* @deprecated removed in 16G — use <semantic> */`.

### 2.3 Decision deferred to 16A — `--font-size-*`, `--space-*`, `--radius-*`

`globals.css` lines 56–80 also declare:

- `--font-size-{xs,sm,base,lg,xl,2xl,3xl}` (7 vars).
- `--space-{1,2,3,4,5,6,8,10,12}` (9 vars).
- `--radius-{sm,md,lg,xl}` (4 vars).

Foundations exposes these as Tailwind scales (`tailwind.tokens.ts` `fontSize`, `spacing`, `borderRadius`) but **NOT as CSS vars in `:root`**.

**Decision deferred to Fase -1 of 16A** (after grep of consumer count):

- **Option A** (≥30 consumer files): add to `legacy-aliases.css` mapping each var to a foundations equivalent (e.g. `--font-size-base: 14px;` to match Tailwind `base`). Removed in 16G with the rest.
- **Option B** (<30 consumer files): migrate consumers to Tailwind utility classes (`text-xs`, `p-4`, `rounded-md`) in 16A and delete the vars from `globals.css` directly.

Action item for 16A Fase -1: run `grep -r "var(--font-size\|var(--space-\|var(--radius-)" src/ --include="*.tsx" --include="*.css" | wc -l` and pick option.

---

## 3. Sequence (16A → 16G) — gates summary

Full per-branch body in `docs/MASTER_PLAN_V2.md` §FASE 16.

### 16A `refactor/liora-token-foundation`

- **Scope**: token infra only. NO `src/components/**` re-skin. NO new component deps.
- **Gates**: `liora-token-coverage.test.ts`, `liora-no-primitive-leak.test.ts`, `liora-legacy-alias-registry.test.ts`, `liora-no-hex-in-jsx.test.ts`, `npm run validate:design-system`, all E2E baseline (`axe-a11y`, `guest-leak-invariants`, `public-guide`, `guide-search`, `hero-quick-actions`, `guide-pwa-offline`).
- **Done criterion**: 3 invariants of no-regression (no broken layout / no functional regression / no a11y regression). Geist → Plex metric drift documented with side-by-side screenshots. NOT "visually identical".
- **Pre-rama checks (Fase -1)**:
  1. Tailwind v3 vs v4 syntax → confirmed v3 (this doc §1.1).
  2. CSP → confirmed not present (this doc §1.1) — pre-paint inline script does not need nonce.
  3. Hex-guard → Vitest grep test (`liora-no-hex-in-jsx.test.ts`), NOT ESLint custom rule.
  4. Decision on `--font-size-*` / `--space-*` / `--radius-*` aliases (this doc §2.3).

### 16B `refactor/liora-core-components`

- **Scope**: 12 primitives re-skin + 7 new (Button, Input, Select, Textarea, Card global, Tabs, Icon). CVA + lucide + tailwind-merge + clsx adopted here.
- **Gate**: classification table mandatory in PR description (`reused`/`reskinned`/`rewritten`/`deleted`/`new` per primitive). axe-core 0 serious/critical. `LIORA_COMPONENT_MAPPING.md` populated.
- **Hard rule**: `primary-cta.tsx` marked `deprecated` (alias to `Button variant="primary"`); removed in 16G.
- **Hard rule**: guest-only cards (`HeroCard`/`EssentialCard`/`StandardCard`/`WarningCard`) live in 16C, NOT here.

### 16C `feat/liora-guest-guide-redesign`

- **Scope**: `/g/:slug` re-skin + guide-card.tsx (guest-only) + `guide.css` rewrite (~1,278 LOC).
- **Mandatory commit structure (7 commits, no single-commit PR)**:
  1. class/token skeleton.
  2. layout shell (renderer + brand-header + toc + grid).
  3. hero + quick actions.
  4. cards/sections (section-card + EssentialCard/StandardCard + guide-item).
  5. search/reporter/install nudge.
  6. local/emergency/media (+ WarningCard).
  7. cleanup + tests (delete orphan selectors, update E2E + unit selectors, Lighthouse snapshot).
- **Gate**: `e2e/axe-a11y.spec.ts` + `e2e/guest-leak-invariants.spec.ts` + `e2e/guide-search.spec.ts` + `e2e/hero-quick-actions.spec.ts` + `e2e/guide-pwa-offline.spec.ts` green in light + dark × 4 viewports. `__SW_VERSION__` bumps. Brand themes work in 8 curated palettes × light + dark.
- **Hard rule**: `src/config/brand-palette.ts` is **permanent** — not touched. The bridge `--guide-brand` ↔ semantic tokens is documented in `LIORA_DESIGN_ADOPTION_PLAN.md` as permanent, not as debt.
- **Base visual = v2** (`ui_kits/guest/index.html`). v1 was deleted from the package in `chore/plan-update-liora`. Reincorporating v1 elements requires "Excepciones v1" block in PR description.

### 16D `feat/liora-operator-shell-redesign`

- **Scope**: sidebar + topbar + dark mode toggle (visible) + command bar **visual slot only**.
- **Hard rule**: command palette FUNCTIONAL is a future branch (`feat/operator-command-palette` in `docs/FUTURE.md`). 16D ships a non-interactive placeholder.
- **Gate**: `dark-parity.test.ts` green. axe-core 0 serious/critical in light + dark. Toggle persistent + no FOUC.

### 16E `feat/liora-operator-module-rollout`

- **Scope**: wizard + content + ops + outputs modules in 3 sequential sub-PRs (E1, E2, E3) on the same branch.
- **Partition gate**: if cumulative diff after E2 exceeds **80 files OR 5,000 LOC net**, split into real branches (`feat/liora-operator-modules-content` / `-ops` / `-outputs`).
- **Per sub-PR gate**: `/simplify` run + own classification table + `npx tsc --noEmit` + `vitest run` + axe-core green + diff stats in PR description.

### 16F `feat/liora-messaging-assistant-redesign`

- **Mandatory classification block in PR description** for `ui_kits/messaging/index.html` mock — every visual element labelled `existing` / `derivable` / `aspirational`. Aspirational items NOT implemented; each goes to `docs/FUTURE.md` or to a named future branch.
- **Hard rule**: NO changes to `/api/assistant-conversations/*` API, NO changes to `src/lib/services/assistant/*` pipeline, NO migrations.
- **Hard rule**: AI message bubbles use accent foundations, NOT cool blue-grey from the kit.

### 16G `chore/remove-legacy-ui`

- **Scope**: barrido final. Remove `src/styles/legacy-aliases.css`, `primary-cta.tsx`, all aliases listed in §2 above, orphan selectors, `globals.css` legacy blocks, `docs/liora_design_system/` if any residue (already removed in `chore/plan-update-liora`).
- **Gate**: bundle size ≤ baseline. `liora-legacy-alias-registry.test.ts` shows empty registry. Grep gate green for forbidden suffixes + legacy primitives outside `design-system/`.

---

## 4. Permanent decisions (do NOT revisit)

These were closed in `chore/plan-update-liora` Fase -1 and apply to all 7 Liora branches:

1. Path canonical: `design-system/` (kebab, tracked in Git).
2. Foundations is the only source of palette. Kits provide layout/hierarchy only — their cool blue-grey accent is discarded.
3. Dark mode is global via `html[data-theme]`. 16A installs infra (pre-paint script, semantic dark bindings) without visible toggle. 16D adds visible toggle in operator topbar (`light | dark | auto`, `localStorage.theme`). Guest inherits via the global toggle; falls back to `prefers-color-scheme` on `auto`.
4. shadcn is NOT adopted wholesale. Per-component justification required.
5. Brand themes per-property (`src/config/brand-palette.ts` + `--guide-brand-light/dark` injection in `guide-renderer.tsx`) are **permanent architecture** — not touched in 16G.
6. Cards globales (`src/components/ui/card.tsx`) ≠ cards guest (`src/components/public-guide/ui/guide-card.tsx`). Promotion requires a dedicated future branch.
7. Command palette functional NOT in scope of Fase 16. 16D ships a visual placeholder only.
8. Hard rules from `ARCHITECTURE_OVERVIEW.md` §14 + CLAUDE.md "Replatform de diseño (Liora)" apply. Forbidden suffixes (`*V2`, `New*`, `Better*`, `*Old`, `legacy-*`). axe-core `serious|critical = 0`. Targets ≥44×44. Components consume semantic/component tokens.
9. Zero functional changes: composition pipeline (`composeGuide → filterByAudience → normalizeGuideForPresentation`), registries, taxonomies, server actions, routes and APIs remain intact across the 7 branches.
10. Guest base visual = v2 of `ui_kits/guest/index.html`. v1 (`index_v1.html`) was deleted from the package in this chore.
11. Nothing is "deferred" without destination. Every deferred item lands in (a) `docs/FUTURE.md` with a trigger, (b) a named future branch, or (c) an architectural decision in the relevant ADOPTION_PLAN doc.

---

## 5. Validation script

`scripts/validate-design-system.ts` runs as a CI gate on every PR that touches `design-system/**`. It checks:

1. Required structure exists (`foundations/{docs,styles,tokens}/`, `references/liora-ui-kits/`).
2. Mandatory files present and non-empty (`DESIGN_SYSTEM.md`, `IMPLEMENTATION.md`, `ACCESSIBILITY.md`, `Foundation.html`, `base.css`, `themes.css`, `primitives.css`, `semantic.css`, `components.css`, `shadcn.css`, `tailwind.tokens.ts`, `tokens.json`).
3. `tokens.json` parses as JSON, no `success.300` / `warning.300` legacy keys, every `var(--…)` referenced in foundations CSS exists in `tokens.json`.
4. `tailwind.tokens.ts` exports `warmAnalyticalTheme` and all CSS-var refs match `tokens.json`.
5. Dark coverage: every semantic token in `:root` of `themes.css` has a binding in `[data-theme="dark"]`.
6. `references/liora-ui-kits/colors_and_type.css` starts with the `REFERENCE ONLY` header.
7. No residues: `.DS_Store`, `__MACOSX`, `index_v1.html` not present anywhere in `design-system/`.
8. **Gitignore hardening**: for each of 3 sample paths (`design-system/`, `design-system/foundations/tokens/tokens.json`, `design-system/references/liora-ui-kits/REFERENCE_RULES.md`), `git check-ignore <path>` must exit non-zero (path NOT ignored). Detects any glob that would silently re-ignore the package.

Run locally: `npm run validate:design-system`.
