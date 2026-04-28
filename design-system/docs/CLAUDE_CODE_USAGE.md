# Claude Code Usage

Claude Code must treat this package as follows:

1. Use `foundations/` as the implementation source of truth.
2. Use `references/liora-ui-kits/` only as visual reference.
3. Preserve existing application business logic.
4. Do not paste static HTML into React components.
5. Rebuild visual patterns as reusable React components.
6. Use semantic/component tokens, not primitive tokens directly.
7. Do not introduce hardcoded colors, spacing, radii or shadows.
8. Do not import `colors_and_type.css` into production.
9. Do not use Inter from the reference kit as the production font (production is IBM Plex Sans + Mono + Newsreader).
10. Do not implement everything in one branch.

## Mapping to Fase 16 (Liora replatform)

Adoption across the product runtime is split into 7 sequential branches. Read the full body of each in `docs/MASTER_PLAN_V2.md` §FASE 16 before starting:

- **16A `refactor/liora-token-foundation`** — install token infra, swap Geist → IBM Plex, pre-paint dark mode script, register legacy aliases. Wrapper: `src/app/design-system.css`. No `src/components/**` changes.
- **16B `refactor/liora-core-components`** — re-skin 12 primitives in `src/components/ui/` + create Button/Input/Select/Textarea/Card/Tabs/Icon. Adopt CVA + lucide-react. Selective shadcn (justified per component in `LIORA_COMPONENT_MAPPING.md`).
- **16C `feat/liora-guest-guide-redesign`** — `/g/:slug` adopts primitives + creates guest-only cards (`HeroCard`/`EssentialCard`/`StandardCard`/`WarningCard`) + rewrites `guide.css` (~1,278 LOC) in 7 mandatory commits. Brand themes per-property preserved.
- **16D `feat/liora-operator-shell-redesign`** — sidebar + topbar + dark mode toggle (visible). Command bar = visual placeholder only (functional palette is a future branch).
- **16E `feat/liora-operator-module-rollout`** — wizard + content + ops + outputs modules in 3 sequential sub-PRs (E1/E2/E3). Hard partition gate: 80 files OR 5k LOC net → split into real branches.
- **16F `feat/liora-messaging-assistant-redesign`** — messaging + assistant console. Mandatory existing/derivable/aspirational classification of the `ui_kits/messaging/index.html` mock in PR description.
- **16G `chore/remove-legacy-ui`** — remove legacy aliases + `primary-cta.tsx` + `globals.css` legacy blocks + grep gate enforcement. Closes Fase 16.

## Hard rules (invariant across all 7 branches)

- `audience=guest` never sees enums, JSON, taxonomy keys, internal labels.
- Suffixes `*V2`, `New*`, `Better*`, `*Old`, `legacy-*` are forbidden (see `ARCHITECTURE_OVERVIEW.md` §14).
- axe-core `serious|critical = 0` invariant.
- 44×44 touch targets invariant.
- Components consume semantic/component tokens, never primitives.
- Cards: global (`src/components/ui/card.tsx`) and guest (`src/components/public-guide/ui/guide-card.tsx`) are separate — promotion requires a dedicated future branch.
- shadcn is NOT adopted wholesale. Per-component justification in `LIORA_COMPONENT_MAPPING.md`.

Read `DESIGN_MIGRATION.md` before starting any Liora branch.
