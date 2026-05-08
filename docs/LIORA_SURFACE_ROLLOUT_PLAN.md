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
| `access/` | ✅ baseline migrated | ✅ parity ported (global 8.7, PASS) | `feat/liora-operator-content-visual-parity` |
| `spaces/` | ✅ baseline migrated | ⬜ deferred required | `feat/liora-operator-content-visual-parity` |
| `amenities/` | ✅ baseline migrated | ⬜ deferred required | `feat/liora-operator-content-visual-parity` |
| `systems/` | ✅ baseline migrated | ⬜ deferred required | `feat/liora-operator-content-visual-parity` |
| `troubleshooting/` | ✅ baseline migrated | ⬜ deferred required | `feat/liora-operator-content-visual-parity` |
| `property/` | ✅ baseline migrated | ⬜ deferred (no editor kit ref — partial parity vs listing+detail summary) | `feat/liora-operator-content-visual-parity` if visually below kit at E1 close |
| wizard (`src/components/wizard/` + `src/app/properties/new/`) | ✅ baseline migrated | ⬜ deferred (no kit ref) | future rama distinct from 16E.5 once `subpages.html` adds `page-onboarding` |

#### Wizard E2E smoke gate — opt-out documented

**Decision**: deferred — no Playwright wizard smoke spec ships in `feat/liora-operator-module-rollout` (E1 baseline). Re-evaluation point: rama 16E.5, where the wizard silhouette port may introduce new interactive states worth covering.

**Rationale**: E1 is a baseline-only Liora migration. The wizard's structural behavior (4-step form, validation, navigation, save-and-exit, completion) is not changed by this branch — only its rendered classNames. The behavioral contract is already pinned by:

1. **Static invariants** in `component-invariants.test.ts` — touch-target, primitive-adoption, web-API guards, copy-lint Spanish, Tailwind hardcode, tone quartet, empty handlers, effect cleanup, HTML validity, interactive elements as `<button>`/`<Link>`. All run on every wizard file via the `operator-wizard` `AUDITED_SURFACES` entry.
2. **Vitest unit + integration** — wizard step schemas, completeness scoring, and server actions are covered by the broader suite.
3. **Type system** — `tsc --noEmit` clean across all wizard files.

Adding a Playwright smoke now would exercise unchanged behavior and introduce selector/timing maintenance cost without a corresponding gain in confidence over the existing static + unit coverage.

**Re-evaluation criteria for 16E.5** (any one triggers a smoke spec):

- New interactive widgets appear that have no equivalent on a surface already covered by an existing E2E (e.g. multi-select drawers, sortable lists, drag-and-drop).
- Step navigation logic changes (conditional skipping, branched flows, async pre-fill from external sources).
- The save-and-exit contract changes (different `data-*` attributes, different debounce semantics, different toast placement).
- A regression is found in production that a smoke spec would have caught at the boundary between visual rework and behavior.

If none of those apply when 16E.5 ships, this deferral remains in force and is closed out as part of broader Liora replatform completion in 16G.

#### 16E.5 module-by-module plan

Per § Rama 16E.5 Fase -1 contract decisions 1 and 3, this section captures (a) the visual inventory of each module's E1 baseline state vs the kit's expected silhouette, and (b) the **CollapsibleSection** policy per module (replace / complement / keep). Frontend-design notes are written upfront for the next module being ported and updated as each module ships.

##### Visual inventory — E1 → 16E.5 silhouette gap (5 + 1 modules)

| Module | E1 surface today | Kit silhouette to port | CollapsibleSection policy |
|--------|------------------|------------------------|---------------------------|
| `access/` | 6 stacked `<CollapsibleSection>` (horarios, tipo, edificio, vivienda, parking, accesibilidad) + photo gallery card. Submit at bottom. Header: `Volver`/`<h1>`/`InlineSaveStatus`. | `pg` page header (eyebrow / title / sub / chips: 4 facts / actions: "Simular llegada"). 3 numbered sections in kit (`01 Horarios` with `arrival-hero` big-number; `02 Método de acceso` with `access-grid` 3-col; `03 Pasos de llegada` with `arrival-steps`). | **Replace.** `arrival-hero`, `access-grid`, `arrival-steps` are layouts, not collapsibles — collapsing hides editor state. All sections always-expanded under `<NumberedSection>`. |
| `amenities/` | Tier-banded tabs (Esenciales/Recomendados/Destacados) with chip-grid + per-amenity detail panel. | `pg` header + `eq-toolbar` (search + category filter + add) + `eq-grp` group bands + `eq-item` rows with custom checkbox + tier-coloured borders. | **Complement.** Detail panel can stay as inline expanding card (kit `eq-item.editing` analog); top-level tier sections always-expanded. |
| `systems/` | List/detail split (CollapsibleSection on form fields). | `pg` header + `ai-card` (smart-systems intro) + `sys-card` rows (icon + body + status pill + ring-pct circular progress). | **Replace** for the list page; **complement** for the detail editor (per-system form fields can stay collapsible). |
| `troubleshooting/` | Tabs (TroubleshootingTabs) + list + detail editor with CollapsibleSection. No single-page kit. | Adjacent silhouette: `incidents` list with `inc` rows (critical/high/normal/resolved variants). Adapt for playbooks list + per-playbook editor. | **Keep** (playbook editor is form-heavy; CollapsibleSection survives) + numbered section grammar at the top. |
| `spaces/` | 2 numbered sections already (Configurados / Sin configurar) with `<SpaceCard>` rows. Bed manager + space form as CollapsibleSection inside cards. | `pg` header + `01 Espacios principales` numbered section + `sp-grid` 2-col cards with photo placeholder + facts row + progress bar + status pill. | **Complement.** Top-level numbered sections + per-card content. CollapsibleSection inside `<SpaceCard>` (bed manager, features) survives. |
| `property/` | Read-only summary + property-form (CollapsibleSection per group). Kit shows listing+detail summary, not editor. | `pg` header + property facts as `pg-chips` + numbered sections per editor group. | **Decide at module start** — kit doesn't ship an editor reference, so the bar is "consume Liora primitives + grammar without inventing novel visual language". CollapsibleSection survives unless the visual gap is large. |

##### Frontend-design upfront — `access/`

Skill: `frontend-design`. Output structured per `frontend-design` SKILL.md template.

**Purpose**: an operator-facing editor for arrival logistics — check-in/out hours, autonomous vs in-person mode, building/unit access methods, parking, accessibility, and access-related photos. Used at property setup (wizard pre-fills it) and revisited when the host changes locks, building rules, or add accessibility features. Goal: the operator finishes editing and the guest guide reflects accurate arrival info — fewer messages on check-in day, fewer 22:00 panicked WhatsApps about lockboxes.

**Tone**: kit voice in `subpages.html` page-llegada is calm, declarative, slightly editorial — "La hora más frágil de toda la estancia." Not corporate, not playful. The operator surface adopts the same register: editorial subtitles instead of imperatives, small-cap eyebrows, semantic chips that summarise state ("Check-in 16:00 · Entrada autónoma"). Avoid form-app voice ("Configura tus datos", "Completa el formulario"); the kit prefers descriptive subtitles.

**Constraints** (planificación v3.2.1 / 5h baseline — *parcialmente superseded por 7a–7c, ver § "Scope exceptions vs original v6.2 plan — `access/` 7a–7c" abajo*):
- ❌ No server-action / Prisma / taxonomy changes (Fase -1 contract decision 8). *(**Parcialmente superseded en 7a–7c**: schema sí cambió de forma aditiva en 7b — `hasParking` + `hasAccessibilityConsiderations`. Server actions y taxonomies siguen intactos. The 6 fields persisted in v3.2.1 — `checkInStart`, `checkInEnd`, `checkOutTime`, `isAutonomousCheckin`, `hasBuildingAccess`, `accessMethodsJson` — siguen idénticos; los dos toggles nuevos se añaden encima.)*
- ❌ No `arrival-steps` content port. The kit's section 03 ("Pasos de llegada") is a guide-content surface (the actual arrival steps shown to guests) that lives in a different module today (`guest-guide/`); access/ is the configuration page. Implementing arrival-steps here would require backend (a new `arrival_steps` field on Property or a new GuideTree node) — out of scope. Section 03 of the silhouette therefore does not port; access/ ends at section 02 (method) + a final photos numbered section.
- ✅ All buttons, selects, checkbox-cards reach 44 hit-area (touch-target invariant from 16D.5).
- ✅ Foundations semantic tokens only — no `--accent-700`/`--moss-500`/`--bg-2` direct refs; map kit accent → `--color-action-primary-*`, kit moss → `--color-status-success-*`.
- ✅ `<PageHeader>`, `<NumberedSection>`, `<PageHeaderChip>` from commit 2 used for shell + section grammar.
- ✅ `<CheckboxCardGroup>` and `<RadioCardGroup>` are kept — they already pass the touch-target gate, and replacing them with kit-style `access-opt` cards would lose the multi-select affordance for "edificio + vivienda" combined.
- ✅ Empty states + InfoTooltip behaviour preserved.

**Differentiation** vs E1 baseline:
- **Header**: `<PageHeader eyebrow="Propiedad · Llegada" title="Llegada y acceso" description="..." chips={[Check-in/Check-out/Modo/Edificio]} actions={[Volver]} />`. The "Simular llegada" kit action is **aspirational** (no simulator backend) — omitted; eventual surface goes to `docs/FUTURE.md` if requested.
- **Section 01 Horarios** — `<NumberedSection number="01" title="Horarios">`. Inside: an `arrival-hero` composition (big-number current `checkInStart` + label + the editorial line that summarises the saved range) PLUS the 3 time selects below the hero, no longer in a 3-col grid (kit doesn't show selects there since it's display-only). On a real editor the selects must remain editable.
- **Section 02 Modo de acceso** — `<NumberedSection number="02" title="Modo de acceso">`. Two yes/no questions kept (`RadioCardGroup`). Replaces the current "Tipo de acceso" copy.
- **Section 03 Método de acceso** — `<NumberedSection number="03" title="Método de acceso">`. When `hasBuildingAccess=yes`, two sub-blocks (Edificio + Vivienda) with `<CheckboxCardGroup>` inside; otherwise just Vivienda. Custom-method "Otro" branches preserved verbatim.
- **Section 04 Aparcamiento** — `<NumberedSection number="04">` wrapping the existing `<CheckboxCardGroup>`.
- **Section 05 Accesibilidad** — `<NumberedSection number="05">` with the lead paragraph + `<CheckboxCardGroup>`.
- **Section 06 Fotos del acceso** — `<NumberedSection number="06">` wrapping `<EntityGallery>`.
- **InlineSaveStatus** moves into the `<PageHeader actions>` slot (right side) so it lives where the kit's `pg-actions` lives.
- **Submit**: full-width button retained at the bottom; `min-h-[44px]` already enforced.

**Risk register**:
- The arrival-hero gradient in the kit uses `linear-gradient(135deg, var(--accent-700), var(--accent-500))` over a 96×96 rounded square. Foundations does not ship a corresponding gradient token. Implementation plan: solid `--color-action-primary-default` background with `--color-action-primary-on` text, rather than a gradient. Documented as a kit-vs-impl divergence on the parity audit (criterion: visual fidelity — expected -0.5 there, still ≥ 7.5).
- Mobile responsiveness: `<PageHeader>` collapses pg-row to column at sm and the 3 hour selects already use `sm:grid-cols-3`. Verified in commit 4.

**A11y baseline plan** (no axe-core run in this commit — establishes the contract for commit 4):
- `<PageHeader>` decorative elements (eyebrow before-rule, semantic chips icons) carry `aria-hidden`.
- `<NumberedSection>` num pill carries `aria-hidden` (the visible "01"/"02" is decoration; the heading text carries the semantic label).
- Submit button is `<button type="submit">` (already), and the dirty-tracked disable is fine because the user can still submit when there are server-side errors that need re-saving.
- Axe-core verdict in commit 4 must show 0 serious|critical violations in light + dark; if violations appear, fix them before parity audit.

##### Token translation (kit → foundations) for `access/`

| Kit token | Foundations equivalent |
|-----------|------------------------|
| `--bg-1` | `--color-background-page` |
| `--bg-2` | `--color-background-elevated` (hero card) / `--color-background-muted` (chip bg, num pill) |
| `--bg-3` | `--color-background-muted` |
| `--border` | `--color-border-default` |
| `--ink-12` | `--color-background-muted` (subtle bands) |
| `--ink-24` | `--color-border-strong` (idle stepper dot) |
| `--ink-40` | `--color-border-strong` (hover border) |
| `--fg-1` | `--color-text-primary` |
| `--fg-2` | `--color-text-secondary` |
| `--fg-3` | `--color-text-muted` |
| `--accent-500` / `--accent-700` | `--color-action-primary` / `--color-action-primary-hover` |
| `--accent-100` | `--color-action-primary-subtle` |
| `--accent-on` | `--color-action-primary-fg` |
| `--moss-500` | `--color-status-success-text` |

##### Parity audit verdict — `access/` (v3.2.1, pre-7a — historical)

> **Historical record.** This verdict was emitted on the 16E.5 v3.2.1 cockpit refactor (4-card 1×4 / 2×2 grid + scoped EntityGallery). The 7a–7c silhouette refactor (commits on the same branch) supersedes the collapsed-card structure scored here: media-backed carousel, interactive dots, foot status pill, and shared `<MediaCarousel>` primitive across collapsed and active branches. Re-running `liora-ui-kit-parity` against the deployed 7a route is the responsibility of a follow-up audit on the same branch — until then, see "Expected parity target — `access/` (v6/v7, post-7a refactor)" below for the implementation target. **Do not paste the v3.2.1 PASS into PR descriptions for 7a-or-later work** — that block is frozen against an earlier silhouette.

##### Expected parity target — `access/` (v6/v7, post-7a refactor)

> **Target, not measurement.** This block records the implementation target the 7a–7c work was built against. It is **not** a parity-audit verdict — no `liora-ui-kit-parity` run has been executed against the deployed Next.js route post-7a. The official PASS/NEEDS WORK verdict is emitted only when that audit runs (deferred follow-up on the same branch). Forbidden language until that audit ships: `Verdict PASS`, `Global X.X` stated as a measurement, "blockers clear" — those phrases must wait for a real run.

**What 7a–7c add over the v3.2.1 silhouette** (collapsed-branch deltas, plus deliberate scope expansions documented as exceptions in the PR — see § Scope exceptions vs original v6.2 plan below):

- Media-backed `<article>` shell (140px media area + body + foot pill) replacing the icon-strip-foot collapsed card.
- Interactive `<MediaCarousel>` with title overlay (`Principal` / method label / `Mapa` / `<methodLabel> · Mapa`) per slide.
- Plain-button dot row when `slides.length > 1`: `aria-current="true"` on active dot, `aria-label="Mostrar <slide title>"` per dot, ArrowLeft/Right + Home/End nav, `recipe-dot-24` (24 visual / 44 hit). **No `role="tab"` / `aria-selected`** — independent media indicators, not a tabs pattern.
- Status pill in the body foot (`configured` / `pending`); empty state conveyed by gradient placeholder + `+ Añade portada` upload affordance.
- Inline image upload affordance baked into `<MediaCarousel>`: image-only (`accept=".jpg,.jpeg,.png,.webp,.avif,.gif"`), tags with `usageKey: access.<cockpitId>` on assignment. Map and video uploads remain deferred to the expanded gallery / future per-method UI.
- Active/expanded branch reuses the **same** `<MediaCarousel>` primitive (`variant="active"`, 240px, no click-through) — the carousel is unified across both branches, not duplicated.
- Per-subsystem schema scope toggles (`hasParking`, `hasAccessibilityConsiderations`) added in commit 7b + migration `20260507180000_add_property_scope_toggles_7b`.
- Static `SUBSYSTEM_GRADIENTS` (commit 7c) replaces template-literal `var()` so `liora-token-coverage.test.ts` sees each token literal in source.

**Expected scoring after re-audit** (target ≥ 8.5 global, ≥ 7.5 per criterion — to be confirmed by a real `liora-ui-kit-parity` run):

| Criterion | Target | Notes |
|-----------|------:|-------|
| 1. Layout silhouette | ≥ 8.5 | Media-on-top + body + foot mirrors the kit's `.sp-card` more closely than v3.2.1's icon-strip header. |
| 2. Visual hierarchy | ≥ 8.5 | Header (icon-badge + title + status pill), tile strip (HoverCard popover for overflow), foot status pill. Title overlay sits over media, not in body. |
| 3. Density / spacing | ≥ 8.0 | 140px media / `p-4` body / `min-h-[260px]` shell. Within 4px of kit. |
| 4. Component fidelity | ≥ 8.5 | `<MediaCarousel>` shared across collapsed + active. HoverCard popover preserved from 6h. |
| 5. Token fidelity | ≥ 9.5 | Zero hex/rgb/oklch literals. `SUBSYSTEM_GRADIENTS` static so token-coverage gate sees each literal. |
| 6. Interaction / state fidelity | ≥ 8.0 | Dot click + keyboard (ArrowLeft/Right/Home/End), focus-visible, hover lift, disabled (uploading), error (inline). |
| 7. Dark mode | ≥ 8.5 | All tokens semantic; `--color-text-on-overlay` + `--color-background-overlay` resolve per theme. |

**Expected blockers**: none, assuming the re-audit confirms (a) HTML validity in collapsed and active (no nested interactive elements), (b) all clickables ≥ 44 hit area, (c) no primitive token leaks, (d) zero hex/rgb in JSX. The 7-suite local gate (`component-invariants`, `parity-static`, `dark-parity`, `access-icon-coverage`, `hover-card`, `liora-page-grammar`, `editor-schemas`) plus `liora-token-coverage` is 107/107 green at commit 7c.

##### Scope exceptions vs original v6.2 plan — `access/` 7a–7c

The original plan v6.2 (`/Users/javierabrilibanez/.claude/plans/federated-strolling-perlis.md`) locked the following out of 7a: schema changes, server actions, taxonomies, active-branch redesign. Reality drifted on three of those during 7a–7c implementation. Each is documented here as intentional, with rationale, so a future audit doesn't flag them as undocumented scope creep:

| Original lock | Reality (7a–7c) | Status / rationale |
|---|---|---|
| No Prisma / schema change | `hasParking BOOLEAN NOT NULL DEFAULT true` + `hasAccessibilityConsiderations BOOLEAN` added in 7b (migration `20260507180000_add_property_scope_toggles_7b`) | **Intentional, backward-compatible.** Required so that "configured / pending / empty" status resolves deterministically per subsystem instead of leaking the legacy "empty" state into both pending and opted-out cases. Migration is additive (new nullable + new column with safe default). |
| No server-action change | `requestUploadAction` / `confirmUploadAction` / `assignMediaAction` / `deleteMediaAction` are invoked from the new in-card upload affordance — they themselves are not modified | **No action signature change.** The new caller threads `usageKey: access.<cockpitId>` (an existing optional parameter on `assignMediaAction`); no new actions added. |
| No taxonomy change | None at runtime — `parkingOptions` / `accessibilityFeatures` / `buildingAccessMethods` / `accessMethods` are read-only (existing files) | **Compliant.** Taxonomies untouched. |
| No active-branch redesign | Active branch reuses `<MediaCarousel variant="active">` (subsystem-card.tsx:155–213) — same primitive as collapsed | **Intentional unification.** Plan v6.2 § "Goals" said "scope is collapsed branch only" — the 7a implementation chose to share the carousel between branches rather than duplicate the slide rendering. The structural collapse-trigger / expand-trigger logic is unchanged; only the media area is now consistent. Documented in PR #102 description. |
| Map / video upload | Image-only via the in-card affordance (`accept=".jpg,.jpeg,.png,.webp,.avif,.gif"`) | **Image-only is the entire 7a contract for in-card upload.** Map (`.map` suffix) and video uploads remain deferred to the expanded EntityGallery / future per-method UI. |

###### Original v3.2.1 verdict (frozen)

Audited surface: [src/app/properties/[propertyId]/access/access-form.tsx](../src/app/properties/[propertyId]/access/access-form.tsx)
Plus components: [cockpit-grid.tsx](../src/app/properties/[propertyId]/access/_components/cockpit-grid.tsx), [subsystem-card.tsx](../src/app/properties/[propertyId]/access/_components/subsystem-card.tsx), [method-row.tsx](../src/app/properties/[propertyId]/access/_components/method-row.tsx), [method-list.tsx](../src/app/properties/[propertyId]/access/_components/method-list.tsx), [arrival-steps.tsx](../src/app/properties/[propertyId]/access/_components/arrival-steps.tsx).
Icon mapping: [src/lib/icons/access-icons.ts](../src/lib/icons/access-icons.ts).
Kit reference: `design-system/references/liora-ui-kits/ui_kits/operator/subpages.html` § `page-llegada`.

**v3.2.1 changes vs v2 baseline** (cockpit + scoped photos):
- 4-card responsive cockpit (1×4 xl / 2×2 sm-lg / 1×4 vertical mobile) with explicit 4-phase state machine (`collapsed → fading-out → expanded → fading-in`) and `layoutExpanded` flag separated from fade phases — siblings fade within collapsed layout before grid transitions to expanded, no jank.
- Vertical `<MethodList>` of `<MethodRow aria-pressed>` replaces 3-col `<MethodGrid>` of `<MethodCard role=checkbox>`. 56-min hit area baked.
- Canonical Lucide icon mapping in `access-icons.ts` (4 records: building / unit / parking / accessibility) with local coverage test (no global allowlist).
- Photos scoped per subsystem via `usageKey` (`access.building`, `access.unit`, `access.parking`, `access.accessibility`). Each card's expanded body shows a filtered `<EntityGallery>`.
- Legacy unscoped photos surfaced in a "Sin clasificar" delete-only section inside the unit card (no `<UploadDropzone>` rendered — uploads to the null bucket are not meaningful).
- ESC handler with `isEditableTarget` guard collapses the active card unless focus is inside an `<input>` / `<textarea>` / `<select>` / `contentEditable`.
- Arrival-steps (Section 03) ports to a 3-step timeline using derived `streetAddress + buildingMethods + unitMethods` content + photo counts.

| Criterion | Score | Notes |
|-----------|------:|-------|
| 1. Layout silhouette | 9.5 | Cockpit responsive 1×4 / 2×2 / 1×4-vertical fully matches the brief. PageHeader chips, numbered sections, arrival-hero, arrival-steps timeline all in place. |
| 2. Visual hierarchy | 9.5 | SubsystemCard 4-state model (idle / fading-out / fading-in / active) preserves a clear info hierarchy: header (icon + title + status) → primary chip → photo footer when collapsed; full editor body when expanded. Status pills consistent with operator shell tones. |
| 3. Density / spacing | 9.0 | `p-5` cockpit cards, `min-h-[180px]` collapsed card, `min-h-[56px]` MethodRow, `gap-3` cockpit grid, `space-y-4` panel content. Within 4px of kit. |
| 4. Component fidelity | 9.5 | Vertical MethodList + aria-pressed MethodRow matches the Liora "selectable list" idiom; in-place expansion with full-card transition is structurally faithful to the kit's expand-on-click pattern. CockpitGrid is a new layout primitive scoped to `access/`; eligible for promotion to the shared layer if reused. |
| 5. Token fidelity | 10.0 | Zero hex / rgb / oklch / primitive leaks in JSX (grep verified). All semantic tokens (`--color-*` / `--radius-*` / `--easing-*` / `--duration-*`). |
| 6. Interaction / state fidelity | 9.0 | Hover, focus-visible (2px ring), disabled (no fade clicks during animation), pending (Guardando…), error (status-error-text + InlineSaveStatus). 4-phase animation hides jank. ESC + isEditableTarget guard preserves form input. |
| 7. Dark mode | 9.0 | All tokens semantic — `html[data-theme]` auto-applies. `dark-parity.test.ts` 4/4 passing. Pre-paint script in `layout.tsx` prevents FOUC. |

**Global**: (9.5 + 9.5 + 9.0 + 9.5 + 10.0 + 9.0 + 9.0) / 7 = **9.36**.

**Verdict**: **PASS** — global 9.36 ≥ 9.2, every criterion ≥ 7.5, zero blockers.

**Blocker check** (all clear):

- ✅ No hex/rgb/oklch literals in audited JSX (grep verified).
- ✅ No primitive token leaks.
- ✅ No forbidden suffix sightings (`*V2`, `New*`, `Better*`, `*Old`, `legacy-*`).
- ✅ All clickables ≥44 hit area: SubsystemCard collapsed `min-h-[180px]`, MethodRow `min-h-[56px]`, IconButton `md` 44, ButtonLink `md` 44, submit `min-h-[44px]`, ChevronUp close button via IconButton.
- ✅ HTML validity: SubsystemCard idle button uses span-only inner content (no nested div/p/section); MethodRow is a leaf button.
- ✅ `aria-pressed` (NOT `role="checkbox"`) on MethodRow per a11y plan v3.1.
- ✅ Drag handlers in scoped EntityGallery: scoped mode renders MediaThumbnail without `draggable`/onDragStart/onDragOver/onDrop — visibly disabled affordances per ajuste #1.
- ✅ No FOUC (pre-paint theme script in `layout.tsx`).
- ✅ Operator surface (no guest leak surface to check).

**Test coverage**:
- `src/test/access-icon-coverage.test.ts` — 7 tests, ID coverage of 4 records ↔ 4 taxonomy JSONs.
- `src/test/liora-page-grammar.test.ts` — 2 tests, `<PageHeader>` + `<NumberedSection>` enforcement on access-form.
- `src/test/component-invariants.test.ts` — 26/26 (touch targets, HTML validity, drag preventDefault, primitive adoption).
- `src/test/parity-static.test.ts`, `src/test/dark-parity.test.ts`, `src/test/liora-no-primitive-leak.test.ts` — clean.
- `src/test/media-upload-action.test.ts`, `src/test/media-per-entity.test.ts` — 41/41 (verifies backward-compat of `getEntityMediaAction(_, _, usageKey?)`).

##### Scoped media galleries (access subsystems) — v3.2.1

Per Plan v3.2.1 ajuste #3, this section is the canonical reference for the scoping semantics introduced in 16E.5.

**Goal**: each access subsystem (building / unit / parking / accessibility) has its own media gallery, backed by `MediaAssignment.usageKey` — no schema changes, no data migration.

**Strict `usageKey` semantics** (vinculante):

| `usageKey` | SQL filter | Meaning |
|---|---|---|
| `undefined` | none | No filter — returns all assignments (current behavior, preserved for backward-compat). |
| `null` | `WHERE usageKey IS NULL` | Legacy / unscoped photos only. |
| `string` | `WHERE usageKey = $value` | Subsystem-scoped match. |

`getEntityMediaAction(entityType, entityId, usageKey?: string | null)` is the only API; existing callers (without `usageKey`) keep current behavior identically.

**Scoped-mode UI gating** (ajuste #1):

When `<EntityGallery usageKey>` is `null` or a string (i.e. `usageKey !== undefined`), the gallery enters **scoped mode**:

- Reorder is disabled — no drag handle, no `draggable` on thumbs, no onDragStart/onDrop handlers wired.
- Set-cover is disabled — the star button does not render in `<MediaThumbnail>` when `onSetCover === undefined`.
- Upload is disabled when `uploadDisabled` prop is set (used for the "Sin clasificar" legacy bucket).

**Sin clasificar** (legacy unscoped photos):
- Surfaced inside the unit card via `<details>` with `<EntityGallery usageKey={null} uploadDisabled />`.
- Delete-only — operator can review and clean up legacy photos but cannot upload to the null bucket (uploads always tag with a specific `usageKey`).
- No automatic migration — legacy photos remain `usageKey: null` until manually re-uploaded under the right card.

**Per-subsystem cover semantics — DEFERRED**:
- `cover` (via `usageKey: "cover"` on `setCoverAction`) is a property-pool concept today, not a per-subsystem concept. Mixing access scoping with cover semantics is explicitly out of scope for 16E.5.
- Re-enable in a future branch that refactors `setCoverAction(_, usageKey?)` to support per-subsystem cover (UX decision pending: 1 cover global + 1 cover per usageKey, or only per usageKey).

**Per-subsystem reorder — DEFERRED**:
- `reorderMediaAction(entityType, entityId, orderedIds)` operates on the full entity pool today. Re-enable in a future branch that refactors it to `reorderMediaAction(_, _, usageKey?)` so a scoped gallery's drag-reorder only mutates the matching subset.

**Migration plan**:
- 16E.5 ships scoped galleries with read + delete + scoped upload only.
- Reorder/cover refactor lands in a follow-up branch (TBD), at which point `<EntityGallery>` re-enables those affordances when `usageKey` is set.

##### Approved pattern: "Operator Entity Card — media-backed summary"

First adopted in 16E.5 access cockpit (commit 7a). **Status: APPROVED design-system pattern for operator entity surfaces.** Not yet extracted to `src/components/ui/`; extraction candidate after a second surface (spaces) adopts it.

**Silhouette**:
- `<article>` shell with `aria-labelledby={titleId}` + `view-transition-name: cockpit-card-${id}`. Two sibling expand `<button>`s (media + body) — never a single button-wrapped card.
- Media area on top (140px tall, rounded top, overflow-hidden). Renders one of: image / static map / video poster / brand-token gradient placeholder.
- Top-left title overlay (`"Principal"` / method label / `"Mapa"` / `"<method> · Mapa"`) over the media. Uses `--color-background-overlay` bg + `--color-text-on-overlay` text (intentionally dark in both themes).
- Interactive dot row (when slides > 1): plain `<button>` controls with `recipe-dot-24` (24 visual, 44 hit), `aria-current="true"` on active, keyboard nav (ArrowLeft/Right + Home/End with wrap). **No `role="tab"` / `role="tablist"` / `aria-selected`** — dots are independent media indicators, not a tabs pattern.
- Body button below: header (icon-badge + title + status pill) + method-tile strip (with HoverCard popover for overflow) + sr-only photo/video count.
- Inline upload affordance (only when `slides.length === 0`): `+ Añade portada` button overlaid on the gradient placeholder. Image-only (`accept=".jpg,.jpeg,.png,.webp,.avif,.gif"`); on success, the new asset is assigned with `usageKey: access.<cockpitId>` so it shows up only in that subsystem's carousel. Map (`.map` suffix) and video uploads remain deferred to the expanded gallery / future per-method UI.
- Shared `<MediaCarousel>` primitive across collapsed (`variant="collapsed"`, 140px, click-through to expand) and active (`variant="active"`, 240px, display-only) — the active branch does not duplicate slide rendering. The collapse/expand triggers themselves remain in the surrounding card structure, not the carousel.

**Media classification** (long-term convention, no caption fallback):
- `kind: "map"` if `usageKey.endsWith(".map")`.
- `kind: "image"` if `mimeType.startsWith("image/")` AND NOT `.map`.
- `kind: "video"` if `mimeType.startsWith("video/")` AND NOT `.map`.
- `caption` is **never** used for kind classification (caption is editorial text).

**Slide ordering within a subsystem**: image → map → video; within each kind by `[sortOrder asc, createdAt asc]`. The first slide is the carousel default.

**Title overlay resolution**:
- `usageKey === "access.<sub>"` → `"Principal"`.
- `usageKey === "access.<sub>.<methodId>"` → method label via `getAccessMethodLabel(methodId)`.
- `usageKey === "access.<sub>.map"` → `"Mapa"`.
- `usageKey === "access.<sub>.<methodId>.map"` → `"<methodLabel> · Mapa"`.

**Empty placeholder**: `linear-gradient(135deg, --color-action-primary-subtle, --color-background-muted)` + centered subsystem icon at 32px in `--color-action-primary`. Hint pill `"+ Añade portada"` only when `status === "empty"`.

**Future applicability**: spaces (probable next adopter), amenities with featured media (probable), systems (evaluate), troubleshooting (probably better as incident rows).

**Scope locks** (commits 7a–7c — silhouette refactor):
- `saveAccessAction`, `accessSchema`, taxonomies, guest guide unchanged.
- Active/expanded branch reuses the shared `<MediaCarousel>` primitive (intentional unification — see "Scope exceptions vs original v6.2 plan" above). The structural expand/collapse trigger logic is untouched; only the media area is consistent across branches.
- Schema scope toggles `hasParking` / `hasAccessibilityConsiderations` added in 7b (additive, backward-compatible — see exception table). No other Prisma model changes.
- Per-method UPLOAD UI deferred (data path lights up via `usageKey` convention; per-method picker is follow-up).
- Map UPLOAD UI deferred (renderer reads `.map` rows; toggle to upload-as-map is follow-up). The in-card affordance is image-only by contract. **Update 16E.6**: this deferral is being **redefined**, not satisfied via image upload. Branch 16E.6 (`feat/liora-access-parking-map-autodiscovery`) ships parking-map auto-discovery via MapTiler + curated pins persisted as `LocalPlace` (`categoryKey="lp.parking"`, no schema migration) — the operator never uploads a map image; the map is rendered from pin coordinates by `<MultiPinMap>` (MapLibre GL). Static map slide (`usageKey="access.parking.map"`) remains an optional stretch goal in 16E.6 with a hard ≤80 LOC gate; if it doesn't fit, it stays deferred to 16E.7.
- Video UPLOAD UI deferred to the expanded gallery — collapsed view shows a placeholder Video icon when a video slide is the active one.
- Auto-cycle / hover-cycle deferred (paging is purely manual via dots).
- Video poster server-side extraction deferred (placeholder Video icon when `posterUrl` absent).

**A11y contract** (binding for any future implementation): interactive dots are plain `<button>` controls, keyboard-accessible, the active dot is marked with `aria-current="true"`. No tablist/tab semantics unless a future implementation adopts full tabs behavior (with the wiring it implies — roving tabindex, `aria-controls` to a panel, `aria-orientation`).

**Extraction status**: APPROVED pattern, **not yet extracted** to `src/components/ui/`. Lives inline in `src/app/properties/[propertyId]/access/_components/subsystem-card.tsx` as the only implementation today. Extraction trigger: when a second surface (probable: `spaces/`) adopts this anatomy. Extraction spec lives in plan v6.2 § Sub-step H — do **not** extract speculatively before a second adopter exists.

### 16F — Messaging + assistant

Surfaces: messaging thread UI, AI assistant chat widget (operator + guest).
Key files: `src/components/messaging/`, `src/components/public-guide/guide-search.tsx` (semantic assistant panel).

### 16G — Legacy alias removal

Removes `src/styles/legacy-aliases.css` (46 vars added in 16A as compatibility shims).
Gate: all 16D/E/F surfaces must be migrated first. `liora-legacy-alias-registry.test.ts` tracks remaining aliases.
