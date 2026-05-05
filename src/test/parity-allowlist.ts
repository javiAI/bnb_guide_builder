/**
 * Liora UI kit parity gate — audited surfaces allowlist.
 *
 * Source of truth for which surfaces the parity static test enforces. New
 * surfaces are added one at a time as they ship against the kit; once a file
 * matches an entry here, every parity invariant applies to it.
 *
 * Mapping intent vs. reality: `routes` is human reference (which kit pages map
 * here); `files` is what the static test consumes. Layout components render on
 * every operator route, so they are part of every operator-shell surface from
 * the moment the first such surface lands.
 *
 * Profile model (16D.5):
 *   - "operator" — operator-shell surfaces. Full Liora invariant suite
 *     (touch-target, primitive-adoption, command-bar slot, web API guards,
 *     copy-lint Spanish, Tailwind hardcode, tone quartet, empty handlers,
 *     effect cleanup, HTML validity, interactive elements as button/Link).
 *   - "guest" — guest public guide surfaces. Shared invariants only
 *     (no hex/rgb/oklch outside allowlist, no Tailwind named colors, web API
 *     guards, no empty handlers, HTML validity, target-size where applicable).
 *     Primitive-adoption + command-bar + operator copy-lint do NOT apply.
 *   - "shared" — primitives or layout that render on both. Same suite as
 *     "operator" minus operator-specific copy-lint when ambiguous.
 */
export type SurfaceProfile = "operator" | "guest" | "shared";

export interface AuditedSurface {
  id: string;
  routes: string[];
  files: string[];
  profile: SurfaceProfile;
}

export const AUDITED_SURFACES: ReadonlyArray<AuditedSurface> = [
  {
    id: "operator-overview",
    routes: ["/properties/[propertyId]"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/page.tsx",
      "src/app/properties/[propertyId]/layout.tsx",
      "src/components/overview/**/*.tsx",
      "src/components/layout/**/*.tsx",
    ],
  },
  {
    id: "operator-entry",
    routes: ["/", "/login"],
    profile: "operator",
    files: [
      "src/app/page.tsx",
      "src/app/login/page.tsx",
    ],
  },
  {
    // Primitives + tone helper. Audit scope = the primitives themselves, so
    // invariants like Tailwind hardcode, tone quartet, web API guards, copy
    // lint and HTML validity run on them. `primitive-adoption` is narrowly
    // scoped to `src/components/overview/**` and therefore never iterates
    // these files — primitives can render their own shell (e.g. card.tsx
    // applies `recipe-card-shell` for variant="overview") without false
    // positives. The orphan-import heuristic already exempts primitive
    // sources by path prefix.
    id: "shared-primitives",
    routes: ["(rendered on every operator + guest surface as imported)"],
    profile: "shared",
    files: [
      "src/components/ui/theme-toggle.tsx",
      "src/components/ui/card.tsx",
      "src/components/ui/section-eyebrow.tsx",
      "src/components/ui/icon-badge.tsx",
      "src/components/ui/text-link.tsx",
      "src/components/ui/timeline-list.tsx",
      "src/components/ui/icon-button.tsx",
      "src/components/ui/icon-button-link.tsx",
      "src/components/ui/button-link.tsx",
      "src/lib/tone.ts",
    ],
  },
  {
    // 16E shared upfront — utility components consumed across multiple
    // operator content modules (amenity-detail-panel, space-card,
    // access-form, local-guide create form, media-page-client). Migrated
    // first so subsequent module migrations do not need to revisit them.
    // No UI Kit reference (these are infra, not pages) — design contract
    // is "consume Liora tokens + primitives, no novel visual language".
    id: "shared-media-and-place-autocomplete",
    routes: ["(rendered inside operator content modules as imported)"],
    profile: "shared",
    files: [
      "src/components/media/media-thumbnail.tsx",
      "src/components/media/upload-dropzone.tsx",
      "src/components/media/entity-gallery.tsx",
      "src/components/local-guide/place-autocomplete.tsx",
    ],
  },
  {
    // 16E wizard / onboarding — operator-facing 4-step property creation
    // flow. NO UI kit reference exists in
    // `design-system/references/liora-ui-kits/ui_kits/operator/subpages.html`
    // (see MASTER_PLAN_V2.md § rama 16E "Surfaces sin kit-ref"). Baseline
    // Liora invariants only: tokens, primitives where they fit, touch-target,
    // no Tailwind named-palette, no HTML entity glyphs, web API guards,
    // copy Spanish. Full UI Kit Parity audit deferred to a future rama
    // once the wizard kit page lands in subpages.html (then frontend-design
    // → impl → liora-ui-kit-parity → webapp-testing).
    id: "operator-wizard",
    routes: [
      "/properties/new/welcome",
      "/properties/new/step-1",
      "/properties/new/step-2",
      "/properties/new/step-3",
      "/properties/new/step-4",
      "/properties/new/review",
    ],
    profile: "operator",
    files: [
      "src/components/wizard/**/*.tsx",
      "src/app/properties/new/**/*.tsx",
    ],
  },
  {
    // 16E content modules — property datos básicos editor. The kit
    // `subpages.html` page-propiedades shows a property listing + read-only
    // detail summary (`<dl>` with Tipo/Dirección/Ciudad/Capacidad/etc.) but
    // NO editor form reference. Treated under the same deferred kit-design
    // policy as wizard: baseline Liora invariants only (tokens, primitives
    // where they fit, touch-target, no Tailwind named-palette, no HTML entity
    // glyphs, web API guards, copy Spanish). Full UI Kit Parity audit deferred
    // until a `page-propiedad-edit` or equivalent kit page lands in
    // subpages.html. See MASTER_PLAN_V2.md § rama 16E "Surfaces sin kit-ref".
    id: "operator-property",
    routes: ["/properties/[propertyId]/property"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/property/**/*.tsx",
    ],
  },
  {
    // 16E content modules — access (llegada y check-in). Kit reference exists
    // (`page-llegada` in subpages.html) with rich visual silhouette:
    // arrival-hero big-number timestamp, access-grid 3-col method cards,
    // arrival-steps vertical list with per-step meta chips. **E1 ships
    // baseline-only** (semantic tokens, a11y, glyph fixes, primitives where
    // they fit) — the structural form layout (`CollapsibleSection`-based) is
    // preserved. Full UI Kit visual silhouette port is **deferred to required
    // follow-up rama 16E.5** (`feat/liora-operator-content-visual-parity`)
    // per LIORA_SURFACE_ROLLOUT_PLAN.md § "Deferred visual parity — required
    // follow-up". Acceptance gate (≥8.5 global / ≥7.5 per criterion +
    // screenshots) applies to 16E.5, not E1.
    id: "operator-access",
    routes: ["/properties/[propertyId]/access"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/access/**/*.tsx",
    ],
  },
  {
    // 16E content modules — spaces (espacios y camas). Kit reference exists
    // (`page-espacios` in subpages.html) with rich visual silhouette: section
    // numbering (01/02/03), per-space hero rows with meta chips, capacity
    // readouts as dedicated cards, bed config as collapsible structured
    // panels. **E1 ships baseline-only** (semantic warning/error/success
    // tokens, a11y, 44 hit-targets on submits, replace Tailwind named-palette
    // amber/red with semantic status tokens). Inline quantity steppers
    // (h-6/h-7) are kept since they pass the gate and a redesign to either
    // visual 44 or `recipe-icon-btn-32` slop requires layout rework that maps
    // 1:1 to the kit. Inline SVG glyphs (pencil, chevron, gear, trash, alert,
    // arrow) are kept as-is — Lucide migration on these dialogs is structural
    // and ships in 16E.5 alongside the silhouette port. Full UI Kit visual
    // silhouette port is **deferred to required follow-up rama 16E.5**
    // (`feat/liora-operator-content-visual-parity`) per
    // LIORA_SURFACE_ROLLOUT_PLAN.md § "Deferred visual parity — required
    // follow-up". Acceptance gate (≥8.5 global / ≥7.5 per criterion +
    // screenshots) applies to 16E.5, not E1.
    id: "operator-spaces",
    routes: ["/properties/[propertyId]/spaces"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/spaces/**/*.tsx",
    ],
  },
  {
    // 16E content modules — amenities (equipamiento). Kit reference exists
    // (`page-equipamiento` in subpages.html) with rich visual silhouette:
    // tier headers (Esenciales/Recomendados/Destacados) as banded sections,
    // chip-grid with category-colored borders and tonal active states, derived
    // amenities as a distinct read-only band, per-amenity detail panel as a
    // dedicated card with structured field rows. **E1 ships baseline-only**
    // (semantic error/warning tokens, a11y, 44 hit-targets on submits + chips
    // + the custom-amenity "+" submit, primitives where they fit). The
    // structural chip-grid + tier layout is preserved. Inline SVG glyphs (close
    // X, chevrons ▲▼) are kept as-is — Lucide migration is structural and
    // ships in 16E.5 alongside the silhouette port. Full UI Kit visual
    // silhouette port is **deferred to required follow-up rama 16E.5**
    // (`feat/liora-operator-content-visual-parity`) per
    // LIORA_SURFACE_ROLLOUT_PLAN.md § "Deferred visual parity — required
    // follow-up". Acceptance gate (≥8.5 global / ≥7.5 per criterion +
    // screenshots) applies to 16E.5, not E1.
    id: "operator-amenities",
    routes: ["/properties/[propertyId]/amenities"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/amenities/**/*.tsx",
    ],
  },
  {
    // 16E content modules — systems (sistemas: clima, agua, electricidad,
    // conectividad). Kit reference exists (`page-sistemas` in subpages.html)
    // with rich visual silhouette: per-group banded sections, system rows
    // as detailed cards with status pills + meta chips, coverage matrix as
    // a structured table with tonal cells. **E1 ships baseline-only**
    // (semantic error/success tokens replacing `--color-error-*` and
    // `--color-success-*` legacy aliases, 44 hit-targets on submits and
    // delete button, primitives where they fit). The structural list +
    // detail-form layout is preserved. Glyphs (← back arrow, → call-to-
    // action arrow, ★ recommended marker) are kept as-is — Lucide migration
    // is structural and ships in 16E.5 alongside the silhouette port. Full
    // UI Kit visual silhouette port is **deferred to required follow-up
    // rama 16E.5** (`feat/liora-operator-content-visual-parity`) per
    // LIORA_SURFACE_ROLLOUT_PLAN.md § "Deferred visual parity — required
    // follow-up". Acceptance gate (≥8.5 global / ≥7.5 per criterion +
    // screenshots) applies to 16E.5, not E1.
    id: "operator-systems",
    routes: [
      "/properties/[propertyId]/systems",
      "/properties/[propertyId]/systems/[systemId]",
    ],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/systems/**/*.tsx",
    ],
  },
  {
    // 16E content modules — troubleshooting (incidencias: playbooks +
    // ocurrencias). NO single-page kit reference exists in subpages.html for
    // a playbook editor or incident registry — `page-troubleshooting` is a
    // surface conceptually adjacent to system detail but the UI Kit does
    // not ship distinct silhouettes for the playbook list, the playbook
    // editor form, the incident registry table, or the incident row
    // actions. **E1 ships baseline-only** (semantic error tokens replacing
    // `--color-danger-*` legacy aliases, 44 hit-targets on submits + filter
    // + row actions, primitives where they fit). Tab-row navigation
    // (TroubleshootingTabs) and inline list-row patterns are preserved.
    // Glyphs (← back arrow, severity badges) are kept as-is. Full UI Kit
    // visual silhouette port is **deferred to required follow-up rama
    // 16E.5** (`feat/liora-operator-content-visual-parity`) per
    // LIORA_SURFACE_ROLLOUT_PLAN.md § "Deferred visual parity — required
    // follow-up". Acceptance gate (≥8.5 global / ≥7.5 per criterion +
    // screenshots) applies to 16E.5, not E1.
    id: "operator-troubleshooting",
    routes: [
      "/properties/[propertyId]/troubleshooting",
      "/properties/[propertyId]/troubleshooting/[playbookKey]",
      "/properties/[propertyId]/troubleshooting/incidents",
    ],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/troubleshooting/**/*.tsx",
    ],
  },
];

/**
 * Patterns the orphan check uses to verify the audit scope is honest. A file
 * matching one of these patterns must satisfy one of:
 *
 *   (a) covered by some `AUDITED_SURFACES.files` glob (audit-and-done), OR
 *   (b) listed in `ORPHAN_AUDIT_PENDING_EXCEPTIONS` with an explicit
 *       `removeBy` deadline (the deadline lives on the exception entry, not
 *       on the pattern itself — patterns are scope, exceptions are debt).
 *
 * Adding a pattern here declares "this scope SHOULD be audited"; the deadline
 * for any specific file in that scope is whatever its `ORPHAN_AUDIT_PENDING_EXCEPTIONS`
 * entry says (or "now" if the file is matched but not yet exempted).
 *
 * Today (post-16D.5), every pattern listed below is fully covered by an
 * `AUDITED_SURFACES` entry — `ORPHAN_AUDIT_PENDING_EXCEPTIONS` is empty.
 * 16E/F will extend this list with the inner property subpages (the
 * `src/app/properties/[propertyId]/<section>/...` glob) AND add matching
 * `ORPHAN_AUDIT_PENDING_EXCEPTIONS` entries pinned to that rama for any
 * file that lands before its surface ships — the orphan check then forces
 * either the audit or a CR-visible deadline extension.
 */
export const EXPECTED_OPERATOR_SCOPE_PATTERNS: ReadonlyArray<string> = [
  "src/app/page.tsx",
  "src/app/login/page.tsx",
  "src/app/properties/[propertyId]/layout.tsx",
  "src/app/properties/[propertyId]/page.tsx",
  "src/app/properties/[propertyId]/property/**/*.tsx",
  "src/app/properties/[propertyId]/access/**/*.tsx",
  "src/app/properties/[propertyId]/spaces/**/*.tsx",
  "src/app/properties/[propertyId]/amenities/**/*.tsx",
  "src/app/properties/[propertyId]/systems/**/*.tsx",
  "src/app/properties/[propertyId]/troubleshooting/**/*.tsx",
  "src/components/overview/**/*.tsx",
  "src/components/layout/**/*.tsx",
  "src/components/ui/theme-toggle.tsx",
  "src/components/media/**/*.tsx",
  "src/components/local-guide/place-autocomplete.tsx",
];

/**
 * Liora-touched signal heuristic: any .tsx file importing one of these
 * primitives is "Liora-migrated" and must be in `AUDITED_SURFACES` (any
 * profile) or explicitly listed in `ORPHAN_AUDIT_PENDING_EXCEPTIONS`.
 *
 * Catches the case where a future rama migrates a subpage to use a primitive
 * but forgets to extend `AUDITED_SURFACES` in the same commit.
 */
export const LIORA_PRIMITIVE_IMPORT_PATHS: ReadonlyArray<string> = [
  "@/components/ui/card",
  "@/components/ui/section-eyebrow",
  "@/components/ui/icon-badge",
  "@/components/ui/text-link",
  "@/components/ui/timeline-list",
  "@/components/ui/icon-button",
  "@/components/ui/icon-button-link",
  "@/components/ui/button-link",
  "@/lib/tone",
];

/**
 * Documented hex exceptions for third-party brand SVGs. Allowlisted per
 * (file, hex) pair: a stray hex literal in a different file still fails the
 * gate, but the same hex elsewhere in the same file is accepted (a new
 * occurrence is a CR red flag, not a CI failure). New exceptions require a
 * doc entry per `liora-ui-kit-parity` § Hard rules.
 */
export const HEX_EXCEPTIONS: ReadonlyArray<{ file: string; hex: string }> = [
  { file: "src/app/login/page.tsx", hex: "#4285F4" },
  { file: "src/app/login/page.tsx", hex: "#34A853" },
  { file: "src/app/login/page.tsx", hex: "#FBBC05" },
  { file: "src/app/login/page.tsx", hex: "#EA4335" },
];

/**
 * Pre-existing forbidden-suffix violations grandfathered into the gate. The
 * old bash check missed these due to a regex bug; the vitest gate exposes
 * them. Each entry must be resolved (rename in place — see CLAUDE.md
 * "no parallel versions" rule) before being deleted from this list.
 *
 * Rule: append-only with intent. Either ship the rename and remove the entry,
 * or fail the gate. Never extend a deadline by editing here.
 */
export const FORBIDDEN_SUFFIX_LEGACY: ReadonlyArray<{
  file: string;
  identifier: string;
  reason: string;
}> = [];

/**
 * Liora replatform phase identifiers used by exception entries to declare
 * when an exception is expected to be removed. `never` is reserved for
 * structural exceptions that are not on the rollout path (e.g. third-party
 * brand SVGs); every other value is a hard deadline for cleanup.
 *
 * The order in `LIORA_PHASE_ORDER` is the timeline. The phase-expiration
 * gate (`component-invariants.test.ts` § governance shape) compares
 * `removeBy` against `CURRENT_LIORA_PHASE` and fails if `removeBy` is in
 * the past — i.e. a previous rama promised to remove the exception and
 * shipped without doing so.
 */
export type LioraPhase = "16D.5" | "16E" | "16E.5" | "16F" | "16G";
export type RemoveBy = LioraPhase | "never";

export const LIORA_PHASE_ORDER: ReadonlyArray<LioraPhase> = [
  "16D.5",
  "16E",
  "16E.5",
  "16F",
  "16G",
] as const;

/** Active Liora phase the allowlist is being audited against. */
export const CURRENT_LIORA_PHASE: LioraPhase = "16E";

export interface ExceptionEntry {
  file: string;
  reason: string;
  owner?: string;
  removeBy: RemoveBy;
}

/**
 * Touch-target violations grandfathered into the gate. Each entry must reach
 * a 44×44 hit area (visual ≥44 OR `recipe-icon-btn-32` slop) before being
 * deleted from this list. Empty after commit 4 of this branch — every
 * audited button-shaped clickable now reaches 44 (visual or slop).
 */
export const TOUCH_TARGET_EXCEPTIONS: ReadonlyArray<ExceptionEntry> = [];

/**
 * Web API guard exceptions (localStorage/matchMedia/etc. accessed outside an
 * effect/SSR guard). Empty by default — every audited surface must guard.
 */
export const WEB_API_GUARD_EXCEPTIONS: ReadonlyArray<ExceptionEntry> = [];

/**
 * Copy-lint exceptions (English placeholder strings in operator surfaces).
 * Empty by default — operator copy is Spanish.
 */
export const COPY_LINT_EXCEPTIONS: ReadonlyArray<ExceptionEntry> = [];

/**
 * Empty-handler placeholders. `onClick={() => {}}` is normally a bug; entries
 * here document intentional no-op stubs (e.g. command-bar slot before 16E).
 */
export const EMPTY_HANDLER_PLACEHOLDERS: ReadonlyArray<ExceptionEntry> = [];

/**
 * Effect-cleanup exceptions for `useEffect` blocks that intentionally lack a
 * cleanup return (e.g. one-shot setup). Empty by default.
 */
export const EFFECT_CLEANUP_EXCEPTIONS: ReadonlyArray<ExceptionEntry> = [];

/**
 * Primitive-adoption exceptions: overview/operator card files whose root
 * element matches the canonical overview shell (flex h-full flex-col +
 * rounded-lg + border-default + bg-elevated + p-4) but still uses a raw
 * `<div>` instead of `<Card variant="overview">`. Empty after commit 3 of
 * this branch — every overview card matching the canonical shell now uses
 * `<Card variant="overview">`. Cards with non-canonical shells (overflow
 * containers, grid layouts, p-5 hero) are not required to migrate.
 */
export const PRIMITIVE_ADOPTION_EXCEPTIONS: ReadonlyArray<ExceptionEntry> = [];

/**
 * `<ButtonLink size="sm">` exceptions on operator/shared surfaces.
 *
 * Policy: `ButtonLink` does NOT bake `recipe-icon-btn-32` for size=sm
 * (slop on a text-bearing button breaks the visual affordance — see
 * `design-system/docs/touch-targets.md`). On audited operator/shared
 * surfaces the static check fails on any `<ButtonLink ... size="sm" ...>`
 * occurrence; the exception list is the only escape hatch.
 */
export const BUTTON_LINK_SIZE_SM_EXCEPTIONS: ReadonlyArray<ExceptionEntry> = [];

/**
 * Files that match `EXPECTED_OPERATOR_SCOPE_PATTERNS` (or the Liora-import
 * heuristic) but are not yet covered by `AUDITED_SURFACES`. Entries here are
 * a forward commitment: each file must be either (a) audited by the rama in
 * `removeBy`, or (b) the rama must extend the deadline with a CR-visible
 * commit (which is itself a signal — the rama did not finish what it said
 * it would).
 *
 * Empty today: every expected-scope path is fully covered, and no .tsx
 * outside `AUDITED_SURFACES` imports a Liora primitive.
 */
export const ORPHAN_AUDIT_PENDING_EXCEPTIONS: ReadonlyArray<ExceptionEntry> = [];
