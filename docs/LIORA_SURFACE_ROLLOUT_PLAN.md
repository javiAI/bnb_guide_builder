# Liora Surface Rollout Plan

Migration order and status for each product surface adopting the Liora foundations
(`design-system/foundations/`). Updated by each branch as surfaces are migrated.

---

## Surface inventory

| Surface | Path | Branch | Status |
|---------|------|--------|--------|
| Token infra + fonts | global (`src/app/`) | 16A | ✅ migrated |
| Core UI primitives (`src/components/ui/`) | operator surfaces | 16B | ✅ migrated |
| **Guest guide** (16C reskin — superseded by 16H rewrite) | `/g/:slug` | **16C** | ✅ migrated (pending 16H clean rewrite) |
| Operator shell (sidebar, topbar) | `/properties/**` | 16D | ✅ migrated |
| Governance (primitives + invariants + closure template) | `src/test/` | 16D.5 | ✅ merged (#99) |
| Operator content modules — **baseline migration** | `/properties/**` | 16E (E1) | ✅ baseline done (superseded by 16E.5/16E.6) |
| Operator content modules — **visual parity port** | `/properties/[id]/{access,spaces,amenities,systems,policies,contacts}` | 16E.5 + 16E.6 | ✅ ported (spaces 9.0/amenities 8.9/systems 9.0/policies 8.7/contacts 9.1; access cockpit 16E.6; property waiver) — PRs #102,#106,#107–#113 |
| Operator shell foundation (⌘K, rail, nav IA, autosave) | `/properties/**` | 16F.5 + 16F.6 | ✅ merged (#116, #118) |
| Messaging (template authoring, automations, drafts) | `/properties/*/messaging` | 16F | ✅ ported (#108, 8.9) |
| Assistant `/ai` (chat + knowledge) | `/properties/*/ai` | 16F | ⬜ pending |
| **Content tab polish** (visual/UX/standardization, one branch per tab) | `/properties/[id]/{overview,property,access,spaces,systems,amenities,local-guide,troubleshooting,policies,contacts}` | **16I** | 🔜 planned (10 branches; see § 16I below) |
| Output/ops surfaces (knowledge, ops, media, analytics, reservations, incidents, settings, publishing, activity) | `/properties/**` | post-16I | ⬜ unaudited (deferred) |
| Legacy alias removal | global | 16G | ⬜ pending |
| Guest guide clean rewrite (definitive bundle) | `/g/:slug` | 16H | ⬜ pending |

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

### 16F.5 — Operator shell foundation ✅ (`feat/liora-operator-shell-foundation`, PR #116 merged `b0acf89`; + 16F.6 editor autosave #118 `549c053`)

**Scope**: the *common shell* anticipated in the 16E.5/16F consolidation note — closes the deferred shell work from 16D (command palette, right rail, header heterogeneity). **Adds functionality** (not "0 functional"): persistent collapse, real ⌘K, real notifications, nav-level route unification.

**Key pieces**:

- `src/components/layout/module-container.tsx` — NEW: single operator page container (shared sticky `<PageHeader>` + body); width/gutters owned by AppShell `<main>` via `--content-max` (1200px, new token in primitives + components).
- `src/components/ui/page-header.tsx` — `sticky` (default true): column-aligned bg + border under the topbar, robust when nested in a form.
- `src/lib/navigation.ts` + `src/config/schemas/section-editors.ts` — IA reorg into **3 visible value-chain groups** (CONTENIDO · SALIDAS · OPERACIONES; the `assistant` group is empty/filtered — see below), curated `NAV_ORDER` + auto-append fallback, `hideFromNav`. Content order: Resumen · Propiedad · Acceso · **Espacios · Sistemas · Equipamiento** · Guía local · Soluciones · Normas · Contactos. `troubleshooting`→**"Soluciones"**, `publishing`→**"Guía del huésped"** (group label "Salidas"), `messaging`→Operaciones; `ai`/`knowledge`/`guest-guide`/`activity` = `hideFromNav`.
- `src/styles/shell.css` + `src/lib/shell-prefs.ts` + `src/components/layout/shell-chrome.tsx` — collapse + **resize** of both panels. Width in inline CSS vars on `<html>` (pre-paint + toggles + resizer); attributes govern only visibility. `DrawerTab` = centered edge pull-tab (same system both sides: nav→icon-rail 56px, rail→hidden 0); `PanelResizeHandle` = `role="separator"` drag + keyboard + double-click reset.
- `src/components/layout/command-palette.tsx` + `src/lib/services/operator-search.service.ts` + `src/lib/actions/operator-search.actions.ts` — NEW: ⌘K **comprehensive search** (Radix Dialog + fuse.js, no new dep) over a per-property index (sections + contacts + spaces + systems + equipamiento + guía local + soluciones + policy concepts), deep-linking to each section. Replaces the 16D `command-bar-slot.tsx` (deleted).
- `src/components/layout/assistant-launcher.tsx` — NEW: the Asistente IA + Base de conocimiento live in a **right-side drawer** (Radix Dialog, ⌘J), out of the nav. `AssistantChat` + a link to `/knowledge`.
- `src/components/layout/notifications-popover.tsx` + `src/lib/services/operator-notifications.service.ts` — NEW: real feed (publish blockers + open incidents), read-only. `src/lib/use-dismiss.ts` — shared click-outside+Escape hook for the non-modal dropdowns.
- `topbar.tsx` — `AssistantLauncher` + `CommandPalette` + `NotificationsPopover`; removed global "Publicar"; "Vista huésped" conditional. `publishing-rail.tsx` — "Vista huésped" link, "Atajos" removed. `publishing/page.tsx` folds `<GuidePreview>`; `guest-guide/page.tsx` migrated + conserved as the preview surface (out of nav).

**Audit scope**: layout components (`src/components/layout/**`) + overview + troubleshooting are auto-audited (`operator-overview`) and pass `component-invariants` + `parity-static`. Legacy ad-hoc pages (knowledge/ai/ops/media/analytics/reservations/incidents/local-guide/settings) got header/shell consistency only — full per-module body parity deferred (not in `AUDITED_SURFACES`). `AssistantChat` (`src/components/assistant/`) is not in audited globs. `CURRENT_LIORA_PHASE` → `"16F.5"`.

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
- `src/app/properties/[propertyId]/policies/` — kit reference `page-normas` exists; **no 16E E1 baseline** (was absent from AUDITED_SURFACES + EXPECTED_OPERATOR_SCOPE_PATTERNS), so the dedicated branch `feat/liora-policies-visual-parity` ships E2-baseline + silhouette together. ✅ ported.

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
| `access/` | ✅ baseline migrated | ✅ **cockpit port (16E.6, #106)** — media-backed arrival cockpit | `feat/liora-access-parking-map-autodiscovery` (16E.6) |
| `spaces/` | ✅ baseline migrated | ✅ **parity ported (global 9.0, PASS, #113)** | `feat/liora-spaces-visual-parity` |
| `amenities/` | ✅ baseline migrated | ✅ **parity ported (global 8.9, PASS, #107)** | `feat/liora-amenities-visual-parity` |
| `systems/` | ✅ baseline migrated | ✅ parity ported (global 9.0, PASS, #109) | `feat/liora-systems-visual-parity` |
| `troubleshooting/` | ✅ baseline migrated | ⬜ **NOT ported** — baseline-only, no full silhouette port (kit `page-averias` has no 1:1 editor/registry ref). **Scheduled in 16I** (`feat/liora-16I-8-troubleshooting-parity`). | 16I |
| `property/` | ✅ baseline migrated | 🟡 partial — waiver (kit `page-propiedades` is listing+detail, no editor form; #112). **Polish + own silhouette in 16I** (`feat/liora-16I-2-property-polish`). | 16I |
| `policies/` | ⬜ no E1 baseline (shipped in parity branch) | ✅ parity ported (global 8.7, PASS, #110) | `feat/liora-policies-visual-parity` |
| `contacts/` | ⬜ no E1 baseline (shipped in parity branch) | ✅ parity ported (global 9.1, PASS, #111) | `feat/liora-contacts-visual-parity` |
| `local-guide/` | 🟡 tokens-only (16F.6) | ⬜ **NOT ported** — only legacy→semantic token migration in 16F.6; never audited (absent from `AUDITED_SURFACES`). **Full port + audit in 16I** (`feat/liora-16I-7-local-guide-parity`, kit `page-guialocal`). | 16I |
| wizard (`src/components/wizard/` + `src/app/properties/new/`) | ✅ baseline migrated | ⬜ deferred (no kit ref) | future rama once `subpages.html` adds `page-onboarding` |

##### Parity audit verdict — `policies/` (`feat/liora-policies-visual-parity`)

**Kit reference**: `ui_kits/operator/subpages.html` § `page-normas`. **Verdict: PASS** — global **8.7**, every criterion ≥ 7.5, zero blockers. Audited with the real `/liora-ui-kit-parity` skill against rendered screenshots (authenticated session), light + dark at 1440/1024/375 + expanded sub-form state; axe-core run across all conditional branches in both themes = **0 serious/critical**. Screenshots captured to `/tmp/liora-policies-parity/` for the session (kit-normas + real-{1440,1024,375}-{light,dark} + real-1440-light-expanded; not committed).

| Criterion | Score | Note |
|-----------|-------|------|
| Layout silhouette | 9.0 | Shell + single-column numbered sections match the kit archetype at all three viewports. |
| Visual hierarchy | 8.5 | eyebrow → title → sub → rule → 01–04 sections match; each rule now led by an accent icon badge like the kit's `.rn-ic`; chip-strip omitted (see divergence). |
| Density / spacing | 8.5 | Section gutters (mb-8) + field rhythm (space-y-6) + icon-badge gap align with the kit. |
| Component fidelity | 8.0 | Per-rule **icon-led circular badge** now matches the kit's `.rn-ic`/`.rule-ic` anatomy via the canonical `<IconBadge tone="primary" size="md">` (was a flat 15px inline glyph). Controls diverge (radio/checkbox/toggle editors vs the kit's tri-state display cards — see divergence). |
| Token fidelity | 9.5 | 100% semantic tokens; 0 hex/rgb/oklch; 0 primitive leaks. Switch knob uses `bg-white` (accepted switch convention, not a token leak). |
| Interaction / state | 8.5 | hover/active/selected (olive-subtle)/disabled/loading/empty/error all present with correct tokens; inline link permanently underlined (a11y + affordance). |
| Dark mode | 9.0 | Coherent in dark, no FOUC, axe-clean; IconBadge accent-subtle renders cleanly; every semantic token has a `[data-theme="dark"]` binding. |

**Documented divergences from the kit** (approved Fase -1 decisions — not drift):

1. **Chip-strip omitted** (kit shows "N definidas / N sin decidir"). The binary policy data model has no honest mapping to a decided/undecided count. Header = eyebrow + title + description + rule, no chips.
2. **Tri-state rule cards not adopted.** The kit's `page-normas` is a read-mostly *display* mock with yes/no/maybe per rule; the real model is an *editor* with multi-option radios, toggles, sub-forms (fees, time ranges, instructions). Per zero-functional-change, the existing controls (`RadioCardGroup`, `CheckboxCardGroup`, `NumberStepper`, switch) are preserved inside always-expanded `NumberedSection`s (Option B). This is the residual ceiling on the component-fidelity score (8.0) — the divergence is data-model-driven and documented, not unaddressed drift. The icon-led anatomy that the kit *does* share with an editor (a tinted Lucide badge per rule) is now matched via `<IconBadge>`.

**Accessibility hardening shipped on this branch** (surfaced by the expanded-state axe run, not present in the prior self-audit): native `<select>`/`<input>`/`<textarea>` controls (quiet-hours times, smoking area, event approval, pet fee, pet/service notes, cleaning + extra-guest amounts) were wrapped in `<label>` to give each an accessible name (fixed `label` + `select-name` criticals); the "Máximo de huéspedes" hint moved `--color-text-subtle` (2.81:1, fails AA) → `--color-text-muted` (passes); the "Editar en Propiedad" inline link is now permanently underlined (fixes `link-in-text-block`). Result: axe-core 0 serious/critical in light **and** dark across every conditional branch.

**Shared-primitive fix** (✅ resolved here, post-review): `InfoTooltip` triggers rendered at 16×16 (`<span role="button">`). Raised by Copilot on PR #110; fixed in the shared primitive (covers `property/` + `spaces/` + wizard + `policies/` atomically) via the new `recipe-icon-btn-16` slop recipe → 44 hit area with the 16×16 visual preserved, registered in the touch-target governance lists (`hasDocumentedSlop` inset cap widened −12→−14). The prior deferral note in `docs/FUTURE.md` is now marked resolved. Separate, still-deferred concern: the static walker only inspects `<button>/<a>/<Link>`, not `role="button"` spans (CLAUDE.md § static-analysis gate honestidad).

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

##### `systems/` — 16E.5 visual parity port (`feat/liora-systems-visual-parity`)

Kit reference: `design-system/references/liora-ui-kits/ui_kits/operator/subpages.html` § `page-sistemas`.

**Silhouette ported** (list `page.tsx` + `_components/`): `<PageHeader>` (eyebrow `Propiedad · Sistemas` / title `Sistemas de la casa` / editorial subtitle / status pill in `actions` / 3 `<PageHeaderChip>`) → NON-AI tip card (replaces the kit `ai-card`, Q5) → three completeness `<NumberedSection>`s (`01 Configurados` / `02 Incompletos` / `03 Por configurar`, numbered over the visible set, hidden when empty except Por configurar per Q7) → `sys-card` rows (`<SystemRow>`: IconBadge + title + group chip + description + meta + status pill + ring-pct) and dashed `<RecommendedRow>` with per-row quick-add (Q6). Detail `[systemId]` ported to the generic operator card grammar (back `<TextLink>` + `<PageHeader>` with IconBadge title + `<Card variant="overview">` sections with `<SectionEyebrow>`, semantic coverage table).

**Decisions applied** (Fase -1 Q1–Q8): completeness status `Configurado/Incompleto/Vacío` → success/warning/muted (Q1); top-level grouping by completeness, taxonomy group kept as a muted chip per row (Q2); ONE batched `mediaAssignment` query joined to `mediaAsset.mimeType` for photos+videos, header "con vídeo" chip dropped, per-row video count kept (Q3); subtypeless systems render "✓ Activo" instead of a ring (Q4); tip card is NON-AI and does not duplicate chip counts (Q5); recommended quick-add + `<details>` fallback selector (Q6); sections hidden at count 0 except Por configurar (Q7); **open-incidents counter implemented** via one `Incident` groupBy on `targetType="system"` + active status (Q8 — `Incident.targetId = PropertySystem.id`, derivable, no schema change). Lucide icon registry `src/lib/icons/system-icons.ts` (pinned by `system-icon-coverage.test.ts`).

| Criterion | Score | Notes |
|-----------|------:|-------|
| 1. Layout silhouette | 9.0 | Header → tip → 3 numbered sections → sys-card rows matches `page-sistemas`. Adapted publish-state (Publicados/Borrador/Sin empezar) to completeness (Configurados/Incompletos/Por configurar) — domain-correct, no per-system publish state exists. Group chip added per Q2; the kit `section-action` "Usa plantillas" omitted (templates aspirational). |
| 2. Visual hierarchy | 9.0 | IconBadge → title + group/internal chips → description → meta row; state column (status pill over ring/Activo). PageHeader chips + status pill summarise state, consistent with operator shell tones. |
| 3. Density / spacing | 8.5 | `p-4` cards, `gap-2.5` between rows, `gap-3.5` intra-row, `gap-5` detail card stack. Within the kit's comfortable card density. |
| 4. Component fidelity | 8.5 | Canonical primitives (`PageHeader`/`PageHeaderChip`/`NumberedSection`/`IconBadge`/`Card variant="overview"`/`SectionEyebrow`/`TextLink`). `SystemRing` is a faithful semantic-token port of the kit `ring-pct`. Status pills + recommended quick-add (kit "Empezar" idiom) faithful. Trailing ArrowRight follows the operator overview row idiom. |
| 5. Token fidelity | 10 | Zero hex/rgb/oklch (parity-static green), zero primitive leaks, zero Tailwind named colors. All semantic `--color-*` / `--radius-*`. SVG ring strokes use `var(--color-progress-track)` + status solids. |
| 6. Interaction / state fidelity | 9.0 | Hover (border-strong + interactive-hover), focus-visible rings, disabled, pending (`Añadiendo…`/`Guardando…`), error (status-error-text). `<details>` fallback collapsible + per-row quick-add verified in-browser. |
| 7. Dark mode | 9.0 | All tokens semantic → `html[data-theme]` auto-applies. `dark-parity.test.ts` green; list + detail dark screenshots axe-0, verified visually. |

**Global**: (9.0 + 9.0 + 8.5 + 8.5 + 10 + 9.0 + 9.0) / 7 = **9.0**.

**Verdict**: **PASS** — global 9.0 ≥ 8.5, every criterion ≥ 7.5, zero blockers.

**Blocker check** (all clear): no hex/rgb/oklch in audited JSX; no primitive token leaks; no forbidden suffixes; all clickables ≥44 hit area (rows `min-h-[44px]`, add/submit/delete `min-h-[44px]`, selects `min-h-[44px]`, IconBadge md 44); selects carry `aria-label` (baseline `select-name` critical cleared); axe `serious|critical = 0` in light + dark on list and detail; HTML validity (rows are leaf `<Link>`s, no nested interactive); operator surface (no guest leak). Zero schema/functional change.

**Test coverage**: `system-icon-coverage.test.ts` (5 — icon keys === taxonomy ids + page grammar `<PageHeader>`/`<NumberedSection>`); `component-invariants.test.ts`, `parity-static.test.ts`, `liora-page-grammar.test.ts`, `dark-parity.test.ts`, `liora-no-hex-in-jsx.test.ts`, `liora-no-tailwind-named-color.test.ts`, `liora-no-primitive-leak.test.ts` — all green. Full suite: 207 files / 2111 tests pass, `tsc --noEmit` clean.

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
- Plain-button dot row when `1 < slides.length ≤ MAX_VISIBLE_DOTS` (5): each dot is a `<button>` at 24×24 visual + `recipe-carousel-dot-24` slop (`::before { inset: -10px }` → 44×44 hit on fine pointers; `@media (pointer: coarse)` collapses to 44×44 visual). Tight `gap-1` keeps the strip narrow (~144 px) so it doesn't dominate the 245 px cover; per-target 44×44 (WCAG 2.5.5) preserved, controlled overlap between adjacent `::before` rectangles bounded by E2E. `aria-current="true"` on active, `aria-label="Mostrar <slide title>"`, ArrowLeft/Right + Home/End nav with wrap. Container marked `data-carousel-indicator="dots"`. **No `role="tab"` / `aria-selected`** — independent media indicators, not a tabs pattern.
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
- Interactive indicators when `slides.length > 1`. **Two modes** switched at `MAX_VISIBLE_DOTS = 5` (see `src/components/ui/media-carousel.tsx`):
  - **Dot row** (1 < N ≤ 5): plain `<button>` controls at **24×24 visual** + `recipe-carousel-dot-24` slop (`::before { inset: -10px }` → 44×44 hit on fine pointers; coarse pointer collapses to 44×44 visual via `min-h:44px` + `min-w:44px` + `::before inset:0`). Inner active indicator is a 1 px tall span — chip stays subtle against the cover image. `aria-current="true"` on active, keyboard nav (ArrowLeft/Right + Home/End with wrap). Container marked `data-carousel-indicator="dots"`. **No `role="tab"` / `role="tablist"` / `aria-selected`** — dots are independent media indicators, not a tabs pattern.
    - **Tight pairing — `gap-1` between dots**: the strip is intentionally narrow (≈ 144 px at 5 slides) so it does not dominate the 245 px chip cover. Per-target WCAG 2.5.5 (44×44) is preserved by the recipe's slop on fine pointers and by `min-h/min-w` on coarse. Adjacent `::before` rectangles overlap by ~16 px on fine pointers at the midpoint between dots — the ambiguous zone resolves to the rightmost `::before` via DOM order. The Playwright spec bounds overlap to `≤ 20 px` and asserts `0 px` on coarse pointers.
    - **Mandatory clearance — `bottom-3`**: the dot row sits 12 px from the cover's bottom edge so the `-10 px` slop is not clipped by the `overflow-hidden` ancestor (`bottom-2` would clip the bottom 2 px of the hit area).
  - **Compact strip** (N > 5): `<button aria-label="Slide anterior">` ← `<span aria-live="polite" data-carousel-counter>{N}/{M}</span>` → `<button aria-label="Slide siguiente">`. Arrows use `recipe-icon-btn-32` (32 visual + `::before { inset: -6px }` → 44 hit on fine pointers; 44 visual on coarse). Safe here because the two arrows are separated by the counter — the expanded slop rectangles cannot overlap. Counter announces position to assistive tech. Wrap-around on both arrows (prev from first → last, next from last → first). Keyboard reach to any slide: repeated arrow press, ArrowLeft/Right cycles, Home/End jumps to first/last. Container marked `data-carousel-indicator="compact"`.
  - **Why the switch at 5**: even the narrow `gap-1` strip would clip or wrap above 5 slides without shrinking the per-dot visual below 24 (target-size regression). The compact strip's fixed width is independent of slide count, so a card adopting this primitive will never overflow regardless of how many slides accumulate.
  - **Why slop + controlled overlap, not visual 44 and no-overlap**: a 44 px chip dominates the cover (a third of the 140 px collapsed media area). The original `gap-5` (20 px) no-overlap rule made the strip ≈ 212 px wide — visually too dominant for the 245 px cockpit column. Relaxing to `gap-1` keeps the per-target 44 hit area intact (WCAG 2.5.5 satisfied per dot) and introduces only bounded overlap in the ambiguous mid-zone where click intent is itself ambiguous. Two slop recipes are documented in CLAUDE.md § "Touch-target invariant" and enforced by `component-invariants.test.ts`: `recipe-carousel-dot-24` for dots (overlap bound enforced by E2E); `recipe-icon-btn-32` for icon buttons that sit alone or are well-separated (compact arrows here). The retired `recipe-dot-24` had a different contract (no documented slop, never reached 44 reliably) and is forbidden — the new recipe is named differently on purpose so a static-analysis grep cannot accept the retired contract by mistake.
  - **Reusable contract** for `spaces/` and any future media-backed entity surface that consumes `<MediaCarousel>`: don't fork the indicator pattern, don't hardcode a different threshold, don't move the dot row closer than 10 px to the overflow-hidden bottom, and don't let any per-target hit rectangle drop below 44×44. Gap is a free parameter governed by the column width × overlap-bound trade-off: `gap-1` (4 px) for tight cockpit columns; `gap-5` (20 px) for wider hosts where no-overlap is preferred. `MAX_VISIBLE_DOTS` and the per-target 44 invariant are the only hard constraints.
- Body button below: header (icon-badge + title + status pill) + method-tile strip (with HoverCard popover for overflow) + sr-only photo/video count.
- Inline upload affordance (only when `slides.length === 0`): `+ Añade portada` button overlaid on the gradient placeholder. Image-only (`accept=".jpg,.jpeg,.png,.webp,.avif,.gif"`); on success, the new asset is assigned with `usageKey: access.<cockpitId>` so it shows up only in that subsystem's carousel. Map (`.map` suffix) and video uploads remain deferred to the expanded gallery / future per-method UI.
- Shared `<MediaCarousel>` primitive across collapsed (`variant="collapsed"`, 140px, click-through to expand) and active (`variant="active"`, 240px, display-only) — the active branch does not duplicate slide rendering. The collapse/expand triggers themselves remain in the surrounding card structure, not the carousel.

**Media classification** (long-term convention, no caption fallback):
- `kind: "map"` if `usageKey.endsWith(".map")`.
- `kind: "image"` if `mimeType.startsWith("image/")` AND NOT `.map`.
- `kind: "video"` if `mimeType.startsWith("video/")` AND NOT `.map`.
- `caption` is **never** used for kind classification (caption is editorial text).

**Slide ordering within a subsystem**: canonical order `image → video → map → live-map` (matches `<MediaCarousel>` and `page.tsx`); within each kind by `[sortOrder asc, createdAt asc]`. The first slide is the carousel default.

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
- **16E.6 closure note (PR #106)**: the rama expanded beyond its planned scope (orchestrator-approved, no penalty). Final patterns pinned for downstream consumers — promote to `CLAUDE.md` when a second surface adopts them:
  - **Slide order canonical**: `image → video → map → live-map` in `<MediaCarousel>`. Any new synthetic slide type appended after `live-map`. Lightbox indices stay in sync with the strip; click-to-collapse is invariant.
  - **Root overlay copy**: cover slide is labeled `"Principal"` (never `"Portada"` — the kit-era term is deprecated for this surface).
  - **Arrival cockpit modes**: 4 entries — `parking | train | bus | airport` (intercity-only). Last-mile (`metro`, `urban_bus`, `taxi`, `walk`) is delegated to the directional Maps deep link from the arrival point to the property; no per-mode toggles, no discovery pipeline. Canonical set in `arrivalModeEnabledSchema`; do not hardcode iteration arrays. Re-introducing `taxi` as a first-class mode is tracked in `docs/FUTURE.md` § 20.
  - **`LocalPlace.rateJson` shape**: array of tiers `[{ amount, currency, per, note? }]`. Zod source at `src/lib/schemas/rate-tier.schema.ts`; `RateTier` / `RateTierPer` types derived via `z.infer`.
  - **JSONB cache merges**: any per-key cache sharded across concurrent writers uses atomic merge — `UPDATE ... SET col = COALESCE(col, '{}'::jsonb) || ${delta}::jsonb WHERE id = ? AND workspace_id = ?` via `$executeRaw`. Fire-and-forget read-modify-write is forbidden when ≥2 origins can write.
  - **Provider calls in server actions**: ownership validation FIRST; provider resolver INSIDE the try/catch (it throws sync `PoiProviderConfigError`/`PoiProviderUnavailableError`); rate-limit on the provider call uses bucket `"expensive"` (10/60s), not `"mutate"`.
  - **Tri-state opt-out chips**: `Boolean?` columns with three states (null/false/true) need an explicit sentinel chip in the taxonomy (`ax.no_accessibility`, mirroring `pk.no_parking` / `ba.no_building`) — UI uses `toggleMutexList`, save path branches null/false/true on the sentinel-only / positives / empty cases. Reload hydrates the sentinel back when the column equals `false`.
  - **`<MediaCarousel>` indicator contract**: `MAX_VISIBLE_DOTS = 5` is the sole switching threshold (constant in `src/components/ui/media-carousel.tsx`).
    - **Dot row (1 < N ≤ 5)** — `data-carousel-indicator="dots"`. Each dot is a plain `<button>` at **24×24 visual** + `recipe-carousel-dot-24` slop: `::before { inset: -10px }` → **≥44×44 effective hit area** on fine pointers. On `pointer: coarse` the recipe collapses to **≥44×44 visual** (`min-h: 44px` + `min-w: 44px`) with `::before { inset: 0 }` — no overlap. Strip uses `gap-1` between dots and sits at `bottom-3` (12 px clearance from the cover's `overflow-hidden` bottom so the `-10 px` slop is not clipped). Adjacent `::before` rectangles are permitted to overlap on fine pointers in the ambiguous mid-zone, **bounded to ≤20 px and verified by the Playwright E2E** (`e2e/media-carousel-overflow.spec.ts`); the ambiguous zone resolves to the rightmost `::before` via DOM order. `aria-current="true"` on the active dot; keyboard nav ArrowLeft/Right + Home/End with wrap. **No `role="tab"` / `role="tablist"` / `aria-selected`** — independent media indicators, not a tabs pattern.
    - **Compact strip (N > 5)** — `data-carousel-indicator="compact"`. `<button aria-label="Slide anterior">` ← `<span aria-live="polite" data-carousel-counter>{N}/{M}</span>` → `<button aria-label="Slide siguiente">`. Arrows use `recipe-icon-btn-32` (32 visual + `::before { inset: -6px }` → 44 hit on fine; 44 visual on coarse). Both arrows wrap (prev from first → last, next from last → first); Home/End jump to first/last.
    - **Forbidden**: `recipe-dot-24` (the retired contract — no documented slop, never reached 44 reliably). `recipe-carousel-dot-24` is the current canonical recipe and must **not** be removed; word-boundary regex `/\brecipe-dot-24\b/` in `component-invariants.test.ts` prevents false-positive matches against `recipe-carousel-dot-24`.
    - **Reusable for `spaces/` and any future media-backed surface**: do not fork the threshold; gap is a free parameter governed by the column-width × overlap-bound trade-off (`gap-1` typical for narrow cockpit columns; `gap-5` available for wider hosts where no-overlap is preferred). Only `MAX_VISIBLE_DOTS` and the per-target 44 invariant are hard constraints.
  - **`eagerFirstSlide` discipline**: `<MediaCarousel>` defaults to `loading="lazy"` on the first slide. The cockpit 1×4 row would otherwise fire N eager fetches on mount. The opt-in (`eagerFirstSlide={true}`) is granted to **exactly one** call site — the building card's collapsed cover (the LCP-priority surface in the initial viewport). Enforced by `component-invariants.test.ts` ("opt-in is granted to at most one call site globally, exactly one on the access surface"). New surfaces inherit the same one-opt-in-per-row discipline.
- Video UPLOAD UI deferred to the expanded gallery — collapsed view shows a placeholder Video icon when a video slide is the active one.
- Auto-cycle / hover-cycle deferred (paging is purely manual via dots).
- Video poster server-side extraction deferred (placeholder Video icon when `posterUrl` absent).

**A11y contract** (binding for any future implementation): interactive dots are plain `<button>` controls, keyboard-accessible, the active dot is marked with `aria-current="true"`. No tablist/tab semantics unless a future implementation adopts full tabs behavior (with the wiring it implies — roving tabindex, `aria-controls` to a panel, `aria-orientation`).

**Extraction status**: APPROVED pattern, **not yet extracted** to `src/components/ui/`. Lives inline in `src/app/properties/[propertyId]/access/_components/subsystem-card.tsx` as the only implementation today. Extraction trigger: when a second surface (probable: `spaces/`) adopts this anatomy. Extraction spec lives in plan v6.2 § Sub-step H — do **not** extract speculatively before a second adopter exists.

##### Contacts — 16E.5 parity port (`contacts/`)

**Kit ref**: `subpages.html #page-contactos`. **Profile**: operator. **Branch**: `feat/liora-contacts-visual-parity`. **Status**: ✅ parity ported.

**Files touched**:
- `src/app/properties/[propertyId]/contacts/contacts-form.tsx` — rewritten: `PageHeader` (eyebrow / title / verbatim subtitle / count chips / "Añadir contacto" CTA), `NumberedSection` per non-empty contact group (01/02/… in taxonomy file order — empty groups omitted), responsive `cn-grid`, controlled create form with scroll-to-form + autofocus (B1).
- `src/app/properties/[propertyId]/contacts/_components/contact-card.tsx` — NEW: read card (toned avatar, name, role line, mono phone) + inline full-width edit form (same fields/server action as before), `Pencil` `IconButton` toggle, emergency card variant.
- `src/app/properties/[propertyId]/contacts/_components/contact-quick-actions.tsx` — NEW: `cn-actions` row of `ButtonLink size="md"` (Llamar primary; WhatsApp/Email/Ir secondary), anchors derived per-field and omitted when absent (A1).
- `src/app/properties/[propertyId]/contacts/_components/styles.ts` — NEW: shared `FIELD`/`FIELD_PH`/`PRIMARY_BTN` className contracts.
- `src/lib/icons/contact-icons.ts` + `src/test/contact-icon-coverage.test.ts` — NEW: `ct.*` → Lucide avatar icon registry + per-group tone (C1), coverage-pinned to `contact_types.json`.
- `src/components/ui/delete-confirmation-button.tsx` — shared primitive fix piggybacked: trigger adopts the canonical 32px icon-button shell (`recipe-icon-btn-32 grid h-8 w-8`) so its slop reaches a true 44 hit area.
- `src/test/parity-allowlist.ts` — `operator-contacts` added to `AUDITED_SURFACES` + `EXPECTED_OPERATOR_SCOPE_PATTERNS`. No new exceptions.

**Primitives adopted**: `PageHeader`, `PageHeaderChip`, `NumberedSection`, `ButtonLink`, `IconButton`, foundations semantic tokens throughout.

**Decisions honored**: A1 (quick actions), B1 (header CTA opens + scrolls + focuses the create form; dashed inline trigger removed), C1 (avatar icon registry), D1 (dynamic numbering by non-empty groups in file order), verbatim editorial subtitle.

**Deviation (flagged)**: `CollapsibleSection` is **not** used in `contacts/` — the kit's always-visible bottom quick-actions row cannot be hosted by its header-only API without nested card chrome, so each contact is a purpose-built read-card with an inline edit form. Consequently the pre-approved *CollapsibleSection chevron* micro-fix was **deferred** (editing a shared primitive this branch no longer consumes would be out-of-scope contamination). The *DeleteConfirmationButton* micro-fix was applied (still used in the edit form).

**UI Kit Parity (7 criteria, 1–10, verdict = worst-of)**:

| Criterion | Score | Notes |
|-----------|-------|-------|
| Layout silhouette | 9.0 | pg header + numbered sections + cn-grid of cn-cards reproduced; edit affordances additive |
| Visual hierarchy | 9.0 | eyebrow→title→subtitle→chips→CTA; name→role→phone→actions |
| Density / spacing | 8.5 | card p-4 / gap-3 faithful; 44-hit action buttons taller than kit (~30px), occasional action wrap on narrow cards |
| Component fidelity | 8.5 | avatar (initials/icon, toned), bold role, mono phone, action buttons; buttons enlarged for touch-target |
| Token fidelity | 9.5 | foundations semantic tokens only; accent→action-primary, clay→status-error, moss→status-success |
| Interaction / state | 9.0 | hover border-strong, edit toggle, derived quick-action links, create scroll+focus, emergency variant |
| Dark mode | 9.0 | full parity incl. emergency gradient; axe 0 serious/critical light + dark |

**Verdict: 8.5 (PASS)** — global ≥8.5, every criterion ≥7.5, 0 blockers (no silhouette mismatch, no token violations, no a11y degradation). axe-core `serious|critical = 0` in light + dark. Screenshots (before/after/preview × light/dark): `design-system/tmp/contacts/` (gitignored — local evidence).

### 16F — Messaging + assistant

Surfaces: messaging thread UI, AI assistant chat widget (operator + guest).
Key files: `src/components/messaging/`, `src/components/public-guide/guide-search.tsx` (semantic assistant panel).

### 16I — Content tab polish 🔜 (planned 2026-06-02)

#### 16I — Carta de estandarización de contenido (2026-06-12, vinculante para 16I-5…10)

El estándar forjado en **Acceso + Espacios** es la verdad; el kit HTML aporta solo silueta (desviaciones = waivers en el parity report). Toda pestaña de contenido cumple TODO lo siguiente:

**Anatomía de página**: `PageHeader` (eyebrow `Propiedad · <Pestaña>` → título → descripción de 1 línea → chips de datos reales) + `NumberedSection` (fórmula: `01` contenido existente · `02` añadir · `03` config/extras solo si existe). Sin `ModuleContainer` a pelo, sin `<h2>` manuales. Empty state = IconBadge circular + h2 + copy de 1-2 líneas (plantilla: el de Espacios).

**Colecciones de entidades**: cockpit cards `EntityMediaCard` + `useCockpitAccordion` + `recipe-entity-card-grid` (1/2/4, nunca 3) cuando la entidad tiene media o ficha rica (espacios, métodos de acceso, sistemas, lugares, playbooks, contactos — con `media` opcional: sin cover ⇒ header compacto IconBadge+título+status). Catálogos masivos de toggles (Equipamiento, ~90 filas) NO son cockpit: filas con `ToggleChip`/`Switch` + detalle como reveal indentado. Editores profundos conservan ruta propia (detalle de sistema, playbook) pero con la misma anatomía.

**Inputs**: chips como única moneda — `ToggleChip` (+`CHIP_*_CLASS`), enums como chips single-select, multiselects con check, **cero `<select>`** (excepción única: quick-add discreto estilo "+ Añadir cama…"), `InlineStepper` para enteros, `<Field*>`/`fieldControlClass` para texto (44px + focus ring), `Switch` para on/off con estado visible. Reveals condicionales **indentados bajo el bloque de su disparador**. Escape hatches `_other_tags` ("Añadir otro…" inline) donde quepan ítems libres. Opciones SIEMPRE de taxonomía — cero listas hardcodeadas.

**Alta de entidades**: one-click vía `AddEntityChips` (chips por tipo, grupos Obligatorios/Recomendados/Otros cuando aplique, nombre auto-derivado server-side "Etiqueta N", spinner en el chip, errores visibles). Donde el alta exige búsqueda (lugares con autocomplete) el paso `02` mantiene UN solo control primario, sin campos prematuros (las notas viven en el editor, no en el alta).

**Edición**: autosave SIEMPRE — `onSubmit={autoSaveSubmit(action)}` (jamás `<form action=` en forms auto-guardados), `useFormAutoSave` (+`watch` para payloads estado→JSON; `usePortalFormRef` si el form monta en portal), cierre con "Listo"/colapso + `flush()`, `AutoSaveStatus` como único feedback. Renombrar = `InlineEditText` en el título. Borrar = `DeleteConfirmationButton`. `required` HTML prohibido en forms incrementales (asterisco visual).

**Estado**: vocabulario canónico `EntityCardStatusPill status=` (check/dot/dashed — `entity-card-status.test.ts`); semántica por entidad definida en su dossier con `missing-signals` y hover "Falta: …" (sin porcentajes inventados). Cabeceras "X de Y listos" cuando haya colección.

**Detalles**: `Tooltip` canónico (nunca `title=`), `InfoTooltip` solo si el label es ambiguo, `operatorHint` para fronteras entre pestañas ("la lavadora se configura en Equipamiento"), targets ≥44 (recipes registrados), labels es-ES / ids EN, tokens semánticos (0 hex), Lucide only, copy sobrio sin imperativos hacia el huésped.

**Gates por pestaña**: tsc + invariantes + axe 0 (light/dark, datos reales) + live Playwright del flujo completo (añadir → editar con autosave sin revert cross-reload → borrar → hover de estado) + `/liora-ui-kit-parity` ≥8.5 (o subir baseline) + AUDITED_SURFACES same-commit.


**Goal**: take each of the 10 operator **content** tabs from "parity floor met" to "perfected experience" — better visuals, UX, component coherence, and primitive standardization. Spec: `MASTER_PLAN_V2.md § FASE 16I`. **One branch per tab, sequential**, each its own PR + user approval before merge (all touch `parity-allowlist.ts` + shared primitives → not parallelizable). `CURRENT_LIORA_PHASE` → `"16I"`.

**Scope**: primarily visual/UX/standardization. **Minor taxonomy/DB changes are permitted per tab** when a polish genuinely needs them (explicit exception to the Liora 0-functional contract — requires a mini Fase -1 + migration note in that branch's PR). Each tab re-runs `/liora-ui-kit-parity` aiming to **raise** the already-ported scores, not just maintain ≥8.5.

| # | Branch | Tab | Today | 16I work |
|---|--------|-----|-------|----------|
| 1 | `feat/liora-16I-1-overview-polish` | Resumen | audited (16D) | UX refinement, primitive standardization (low) |
| 2 | `feat/liora-16I-2-property-polish` | Propiedad | baseline + waiver | UX + own silhouette (no editor kit ref) |
| 3 | `feat/liora-16I-3-access-polish` | Acceso | cockpit (16E.6) | refinement on cockpit |
| 4 | `feat/liora-16I-4-spaces-polish` | Espacios | parity 9.0 | ✅ **DONE (2026-06-12, parity 9.4, axe 0, PR abierta)** — EntityMediaCard/accordion extraídos (§23 ejecutado), editor lean v3, autosave de raíz, alta one-click, estado canónico, en-suite include, coherencia 20 estancias (§22 plano sigue diferido) |
| 5 | `feat/liora-16I-5-systems-polish` | Sistemas | parity 9.0 | refinement (§21 meta deferred) |
| 6 | `feat/liora-16I-6-amenities-polish` | Equipamiento | parity 8.9 | refinement (§24 tri-state, §18.2 split deferred) |
| 7 | `feat/liora-16I-7-local-guide-parity` | Guía local | tokens-only, **unaudited** | **full port + audit** (kit `page-guialocal`) — HIGH |
| 8 | `feat/liora-16I-8-troubleshooting-parity` | Soluciones | baseline, no port | **full UX port + audit** (kit `page-averias` partial) — HIGH |
| 9 | `feat/liora-16I-9-policies-polish` | Normas | parity 8.7 | refinement |
| 10 | `feat/liora-16I-10-contacts-polish` | Contactos | parity 9.1 | refinement |

**Per-branch gate**: Fase -1 → `/frontend-design` → implement → `/liora-ui-kit-parity` (raise score) → `/simplify` → axe 0 serious/critical light+dark + `component-invariants`/`parity-static`/`dark-parity` green → add/refresh `AUDITED_SURFACES` entry (`profile: "operator"`) in the same commit → PR → **user approval** → merge. Branches 7 & 8 add their surfaces to `AUDITED_SURFACES` + `EXPECTED_OPERATOR_SCOPE_PATTERNS` for the first time (local-guide, and a full troubleshooting port).

### 16G — Legacy alias removal

Removes `src/styles/legacy-aliases.css` (46 vars added in 16A as compatibility shims).
Gate: all 16D/E/F/I surfaces must be migrated first. `liora-legacy-alias-registry.test.ts` tracks remaining aliases.
