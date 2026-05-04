# Liora Surface Rollout Plan

Migration order and status for each product surface adopting the Liora foundations
(`design-system/foundations/`). Updated by each branch as surfaces are migrated.

---

## Surface inventory

| Surface | Path | Branch | Status |
|---------|------|--------|--------|
| Token infra + fonts | global (`src/app/`) | 16A | ✅ migrated |
| Core UI primitives (`src/components/ui/`) | operator surfaces | 16B | ✅ migrated |
| **Guest guide** | `/g/:slug` | **16C** | **✅ migrated** |
| Operator shell (sidebar, topbar) | `/properties/**` | 16D | ✅ migrated |
| Operator modules (wizard, editor) — **baseline** | `/properties/**` | 16E | 🟡 in progress |
| Operator content modules — **visual parity port** | `/properties/[id]/{access,spaces,amenities,systems,troubleshooting}` | 16E.5 | ⬜ pending (required follow-up) |
| Messaging + assistant | `/properties/*/messaging`, `/g/:slug` chat | 16F | ⬜ pending |
| Legacy alias removal | global | 16G | ⬜ pending |

---

## Guest guide migration detail (16C)

**Scope**: all files under `src/components/public-guide/` + `src/app/g/[slug]/`.

**Token strategy**:
- All structural tokens use foundations semantic layer (`--color-text-primary`, `--color-background-elevated`, `--radius-md`, etc.).
- Brand color uses `--guide-brand` (resolved from `--guide-brand-light` / `--guide-brand-dark` injected inline by `guide-renderer.tsx` from `brand-palette.ts`).
- Derived brand tokens (`--guide-brand-hover`, `--guide-brand-active`, `--guide-brand-fg`) defined in `.guide-root` scope in `guide.css`.
- `[data-theme="dark"] .guide-root` rebinds `--guide-brand → --guide-brand-dark`.
- Search dialog portaled to `document.body` rebinds `--guide-brand` per `[data-theme="dark"] .guide-search__dialog` (semantic tokens auto-adapt via 16A; only brand needs rebind).

**Brand themes guest — permanent architecture**:
- `src/config/brand-palette.ts` is untouched by any Liora branch (decision permanente 5).
- `getBrandPair(key).light/dark` injects inline CSS vars into the guide root on every page render.
- Guest cards (`HeroCard`, `EssentialCard`, `StandardCard`, `WarningCard` in `src/components/public-guide/ui/guide-card.tsx`) consume `var(--guide-brand)` alongside foundations semantic tokens.
- This bridge is **not legacy debt** — it is the designed coexistence pattern for multi-tenant brand theming on a shared design system.

**Guest cards created**:
- `HeroCard` — brand background + brand-fg text, large padding (`--card-padding-lg`).
- `EssentialCard` — elevated card with strong border and shadow.
- `StandardCard` — standard card with default border.
- `WarningCard` — warning status palette (`--color-status-warning-bg/text/border`).

**Files not touched** (zero functional changes):
- `src/lib/services/guide-presentation.service.ts`
- `src/config/registries/presenter-registry.ts`
- `src/config/brand-palette.ts`
- All resolvers, taxonomy loaders, `composeGuide`.

---

## Pending surfaces (16D–16G)

### 16D — Operator shell ✅

**Scope**: sidebar navigation, topbar, dark-mode toggle, properties list, login page, overview page header + cards.

**Key files migrated**:

- `src/components/layout/app-shell.tsx` — Topbar wired; `var(--surface)` → `var(--color-background-page)`
- `src/components/layout/side-nav.tsx` — full rewrite: lucide icons map, semantic tokens, `isNavItemActive()` from `navigation.ts`, 44px nav targets
- `src/components/layout/topbar.tsx` — 3-column grid (breadcrumbs | CommandBarSlot | ThemeToggle)
- `src/components/layout/command-bar-slot.tsx` — NEW, `aria-hidden` placeholder (functional command palette deferred to FUTURE.md §8.2)
- `src/components/ui/theme-toggle.tsx` — NEW, 3-state (auto/light/dark), matchMedia listener for auto mode, 44×44 target
- `src/lib/theme.ts` — NEW, canonical `THEME_STORAGE_KEY`
- `src/lib/navigation.ts` — added `isNavItemActive()` export
- `src/app/page.tsx` — properties list: all semantic tokens + minimal header with ThemeToggle
- `src/app/login/page.tsx` — full reskin: semantic tokens, Spanish copy, ThemeToggle
- `src/app/properties/[propertyId]/page.tsx` — overview header grammar (eyebrow + title + subtitle)
- `src/components/overview/` — all 4 cards: semantic token migration (`--border`/`--surface-elevated`/`--foreground`/`--color-primary-*` → foundations)
- `src/test/dark-parity.test.ts` — NEW, 4 tests: root/dark blocks exist, core groups covered, ≥80% overall parity

**Token strategy**:

- All structural tokens: foundations semantic layer only.
- No brand color usage in operator shell (neutral warm-analytical theme).
- `var(--sidebar-width)` kept as-is (defined in `design-system/foundations/tokens/components.css`).

### 16E — Operator modules

Surfaces: property wizard (all steps), property editor, space editor.
Key files: `src/components/wizard/`, `src/components/overview/`.

**E1 status (in progress)**: baseline migration only — semantic tokens, primitives where they fit, touch-target ≥44, glyph fixes, AUDITED_SURFACES governance. Structural form layout (`CollapsibleSection`-based) is preserved when reworking it would require UX redesign. **The full UI Kit visual silhouette port is deferred to required follow-up rama 16E.5** — see § "Deferred visual parity — required follow-up" per module below.

**Modules migrated to baseline in E1** (status updated as commits land):

- `src/components/wizard/` + `src/app/properties/new/**/*.tsx` (welcome, step-1..4, review) — no kit reference exists.
- `src/app/properties/[propertyId]/property/` — only listing+detail summary in kit, no editor reference.
- `src/app/properties/[propertyId]/access/` — kit reference `page-llegada` exists; visual silhouette deferred to 16E.5.
- `src/app/properties/[propertyId]/spaces/` — kit reference `page-espacios` exists; visual silhouette deferred to 16E.5.
- `src/app/properties/[propertyId]/amenities/` — kit reference `page-equipamiento` exists; visual silhouette deferred to 16E.5.
- `src/app/properties/[propertyId]/systems/` — kit reference `page-sistemas` exists; visual silhouette deferred to 16E.5.
- `src/app/properties/[propertyId]/troubleshooting/` — kit reference `page-averias` exists; visual silhouette deferred to 16E.5.

#### Deferred visual parity — required follow-up

**Status**: required next follow-up, not optional polish.
**Reason**: E1 applied baseline token/a11y migration only; full UI Kit silhouette requires UX/layout restructuring beyond a token swap (the `CollapsibleSection` form pattern does not map 1:1 to `arrival-hero`, `access-grid`, `arrival-steps`, hero rows, section numbering, chip strips, etc.).
**Required branch**: `feat/liora-operator-content-visual-parity` (rama 16E.5 — spec in `docs/MASTER_PLAN_V2.md` § rama 16E.5).
**Reference assets**: `design-system/references/liora-ui-kits/ui_kits/operator/subpages.html` per module + matching CSS in `operator.css`.
**Expected changes per module**:

- Hero/header treatment where the kit shows it (e.g. `arrival-hero` big-number timestamp on access/).
- Section rhythm and numbering (01/02/03 prefixes).
- Grid/card layout parity (e.g. `access-grid` 3-column method cards on access/).
- Status/meta chips (e.g. eyebrow row chips: check-in time, autonomous flag).
- Richer empty states aligned with kit voice.
- CTA placement parity (action buttons on the right of the page header).
- Screenshot evidence in `eval-artifacts/16E.5/<module>/` (Liora vs implementation, light + dark).

**Acceptance gate** (required, blocking):

- ✅ UI Kit Parity ≥ 8.5 global, ≥ 7.5 per criterion (skill `liora-ui-kit-parity` 7-criterios).
- ✅ Screenshots referenced in PR description.
- ✅ Zero functional/server-action changes (baseline E1 logic preserved).
- ✅ `component-invariants.test.ts`, `parity-static.test.ts`, `dark-parity.test.ts` green.
- ✅ axe-core `serious|critical = 0` light + dark per surface.

**Per-module deferred parity table** (updated by 16E.5 as each module ports):

| Module | E1 baseline status | UI Kit Parity status | Follow-up branch |
|--------|--------------------|----------------------|------------------|
| `access/` | ✅ baseline migrated | ⬜ deferred required | `feat/liora-operator-content-visual-parity` |
| `spaces/` | ✅ baseline migrated | ⬜ deferred required | `feat/liora-operator-content-visual-parity` |
| `amenities/` | ✅ baseline migrated | ⬜ deferred required | `feat/liora-operator-content-visual-parity` |
| `systems/` | ✅ baseline migrated | ⬜ deferred required | `feat/liora-operator-content-visual-parity` |
| `troubleshooting/` | ✅ baseline migrated | ⬜ deferred required | `feat/liora-operator-content-visual-parity` |
| `property/` | ✅ baseline migrated | ⬜ deferred (no editor kit ref — partial parity vs listing+detail summary) | `feat/liora-operator-content-visual-parity` if visually below kit at E1 close |
| wizard (`src/components/wizard/` + `src/app/properties/new/`) | ✅ baseline migrated | ⬜ deferred (no kit ref) | future rama distinct from 16E.5 once `subpages.html` adds `page-onboarding` |

### 16F — Messaging + assistant

Surfaces: messaging thread UI, AI assistant chat widget (operator + guest).
Key files: `src/components/messaging/`, `src/components/public-guide/guide-search.tsx` (semantic assistant panel).

### 16G — Legacy alias removal

Removes `src/styles/legacy-aliases.css` (46 vars added in 16A as compatibility shims).
Gate: all 16D/E/F surfaces must be migrated first. `liora-legacy-alias-registry.test.ts` tracks remaining aliases.
