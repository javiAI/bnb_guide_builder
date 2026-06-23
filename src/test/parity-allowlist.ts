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
      "src/components/ui/page-header.tsx",
      "src/components/ui/page-header-fade.tsx",
      "src/components/ui/numbered-section.tsx",
      "src/components/ui/page-header-chip.tsx",
      "src/components/ui/field.tsx",
      "src/components/ui/hover-card.tsx",
      // 16I-4 — entity cockpit card primitives (extracted from the Access
      // cockpit; adopted by Access + Spaces, designed for future surfaces).
      "src/components/ui/entity-media-card.tsx",
      "src/components/ui/entity-card-accordion.tsx",
      // 16I-5…10 consolidation (PR 0) — canonical controls + the shared
      // subtype-field renderer registry (chips/Switch/fieldControlClass),
      // consumed by Sistemas + Equipamiento detail editors.
      "src/components/ui/add-entity-chips.tsx",
      "src/components/ui/switch.tsx",
      "src/components/ui/inline-stepper.tsx",
      "src/config/registries/field-type-renderers.tsx",
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
    // 16E.6 shared UI primitives — utility components introduced for the
    // arrival cockpit ("Cómo llegar") and reused across operator content
    // modules: `media-carousel` (parking detail panel + arrival options),
    // `banner` (configuration notices on access page + future surfaces),
    // `location-map` (manual pin map on parking/arrival sections), and
    // `tooltip` (Radix-based helper used across operator surfaces).
    // Tracked as `shared` so the baseline Liora invariants run on them
    // (tokens, hardcodes, web API guards, target-size, tone quartet)
    // without forcing operator-specific copy-lint or primitive-adoption.
    id: "shared-ui-carousel-banner-map-tooltip",
    routes: ["(rendered inside operator content modules as imported)"],
    profile: "shared",
    files: [
      "src/components/ui/media-carousel.tsx",
      "src/components/ui/banner.tsx",
      "src/components/ui/location-map.tsx",
      "src/components/ui/tooltip.tsx",
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
    // 16E content modules — spaces (espacios y camas). Kit reference
    // `page-espacios` in subpages.html: header (eyebrow → title → desc →
    // actions → chips → rule), numbered sections (01 principales / 02 añadir /
    // 03 archivados, conditional), and an auto-fill card grid of per-space
    // tiles (cover + photo-count badge, name, meta facts, progress + status
    // pill). **Visual parity port landed on this branch**
    // (`feat/liora-spaces-visual-parity`): the real `/liora-ui-kit-parity`
    // audit passes — global 9.0, every criterion ≥ 7.5, 0 blockers (3-col
    // auto-fill grid matching the kit's minmax(260px); axe 0 serious|critical
    // in light/dark/expanded-editor). This closes the "deferred visual parity
    // — required follow-up" item in LIORA_SURFACE_ROLLOUT_PLAN.md for spaces;
    // the E1 baseline-only framing no longer applies (the ≥8.5 global / ≥7.5
    // per criterion + screenshots gate is met here).
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
    // 16I-7 full port + first audit. Local-guide was never audited (only partial
    // token migration in 16F.6). Rebuilt to the gold standard: PageHeader +
    // real chips (lugares/categorías/listos/eventos) + NumberedSection 01
    // Lugares (cockpit EntityMediaCard cards grouped by category, shared
    // useCockpitAccordion) · 02 Añadir (PlaceAutocomplete one-click + manual
    // fallback) · 03 Eventos (FieldInput radio + Button sync + Switch rows).
    // Kit page-guialocal: header/section silhouette adopted; no 1:1 POI editor
    // (standard cockpit per la carta); neighborhood map waived (D8). Switch /
    // ToggleChip / DeleteConfirmationButton / InlineEditText canonical. Lucide
    // category icons (src/lib/icons/local-place-icons.ts, coverage-tested). All
    // clickables ≥44 hit, axe serious|critical = 0 light + dark.
    id: "operator-local-guide",
    routes: ["/properties/[propertyId]/local-guide"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/local-guide/**/*.tsx",
    ],
  },
  {
    // 16E content modules — systems (sistemas: clima, agua, electricidad,
    // conectividad). Kit reference: `page-sistemas` in subpages.html.
    // **16E.5 visual-parity port complete** (`feat/liora-systems-visual-parity`):
    // list page rebuilt to the sys-card silhouette — PageHeader (eyebrow/title/
    // chips/status pill) + NON-AI tip card + three completeness NumberedSections
    // (Configurados / Incompletos / Por configurar) with sys-card rows (IconBadge
    // + group chip + meta + status pill + ring-pct) and per-row quick-add for
    // recommended systems; detail page on the generic operator card grammar
    // (<Card variant="overview"> + <SectionEyebrow>). Lucide icons replace the
    // ← / → / ★ glyphs (canonical mapping in src/lib/icons/system-icons.ts,
    // pinned by system-icon-coverage.test.ts). All clickables ≥44 hit area,
    // selects carry aria-label (select-name baseline violation cleared), axe
    // serious|critical = 0 light + dark. No schema/functional change. Audit +
    // 7-criterion scores in LIORA_SURFACE_ROLLOUT_PLAN.md § systems.
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
  {
    // 16F messaging — touchpoint plantillas + automations index. The
    // `ui_kits/messaging/index.html` kit renders a LIVE INBOX (sidebar +
    // conversation list + thread + context panel) — a domain that does NOT
    // exist in this product: messaging here is template AUTHORING +
    // automation wiring + draft review, not a chat inbox. So the kit is a
    // reference for VISUAL GRAMMAR ONLY (uppercase eyebrows, status chips,
    // composer styling, olive AI/automation accent, source/timeline
    // patterns). The inbox/thread/composer-send/AI-suggestion are
    // `aspirational` (no backend) and documented in `docs/FUTURE.md`; the
    // index ports the existing touchpoint list + counters + a small set of
    // `derivable` reads (per-touchpoint template/automation counts,
    // last-activity timestamp). `src/components/messaging/**` (the starter
    // pack picker modal) renders on this page, so it is folded in here.
    id: "operator-messaging-index",
    routes: ["/properties/[propertyId]/messaging"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/messaging/page.tsx",
      "src/components/messaging/**/*.tsx",
    ],
  },
  {
    // 16F messaging — touchpoint detail (plantillas + automatizaciones).
    // NumberedSection 01 Plantillas / 02 Automatizaciones. Includes the
    // template card, create-template form, automation section + rows, and
    // the message body editor re-skinned as a composer (tool-row, NO
    // send/AI-toggle — those are aspirational). The variable picker +
    // template preview keep their existing behavior; the AI/automation
    // accent uses `--color-action-primary-*` (olive), never the kit's
    // cool blue-grey. The template preview is a NEUTRAL render of the
    // template, not an AI conversation bubble.
    id: "operator-messaging-touchpoint",
    routes: ["/properties/[propertyId]/messaging/[touchpointKey]"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/messaging/[touchpointKey]/**/*.tsx",
    ],
  },
  {
    // 16F messaging — drafts review queue. NumberedSection per draft status
    // (01 Pendientes / 02 Aprobados / 03 Enviados / …). Draft cards carry
    // semantic status tones, last-activity (scheduled send timestamp), and
    // four horizontal lifecycle text-buttons (Aprobar / Editar / Omitir /
    // Descartar) — text-bearing controls reach 44 visual height, no slop.
    id: "operator-messaging-drafts",
    routes: ["/properties/[propertyId]/messaging/drafts"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/messaging/drafts/**/*.tsx",
    ],
  },
  {
    // 16E.5 content module — policies (normas de la casa). Kit reference
    // exists (`page-normas` in subpages.html): eyebrow row (Propiedad ·
    // Normas) → title → sub (firme/cálido voice) → rule, then numbered
    // sections (01 Horarios y silencio, 02 Qué se permite). **Policies had
    // NO 16E E1 baseline** (it was not in AUDITED_SURFACES nor
    // EXPECTED_OPERATOR_SCOPE_PATTERNS before this branch), so this PR ships
    // E2-baseline (semantic tokens + a11y + 44 hit-targets) AND the Liora
    // silhouette (PageHeader, NumberedSection always-expanded with sub-form
    // toggles preserved, editorial empty states) in one PR. Acceptance gate
    // (≥8.5 global / ≥7.5 per criterion + screenshots) applies.
    // Divergence from the kit, documented in the PR description: the kit
    // chip-strip ("N definidas / N sin decidir") is OMITTED — the binary
    // policy data model has no honest mapping to a "decided/undecided" count.
    // The kit's tri-state rule-card grid is not adopted either — the real
    // model uses radio/checkbox cards + sub-form toggles (RadioCardGroup,
    // CheckboxCardGroup, NumberStepper), preserved per zero-functional-change.
    id: "operator-policies",
    routes: ["/properties/[propertyId]/policies"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/policies/**/*.tsx",
    ],
  },
  {
    // 16E.5 content modules — contacts (contactos). Kit reference exists
    // (`page-contactos` in subpages.html) with a rich visual silhouette:
    // `pg` page header (eyebrow / title / editorial subtitle / count chips /
    // "Añadir contacto" CTA), numbered sections per non-empty contact group
    // (01 Anfitrión / 02 Emergencia / …), and `cn-grid` of `cn-card` rows
    // (avatar + name + role + phone + action buttons), with an emergency card
    // variant. This branch ships the **full UI Kit visual silhouette port**
    // (not a baseline E1): semantic tokens, PageHeader/NumberedSection/
    // PageHeaderChip/ButtonLink primitives, avatar icon registry
    // (`src/lib/icons/contact-icons.ts`), quick-action links, and 44 hit-area
    // targets. Zero functional/server-action/schema changes. Acceptance gate
    // (≥8.5 global / ≥7.5 per criterion + screenshots) applies. Emergency
    // contacts are wired inside this module (no dedicated `emergency/` route —
    // MASTER_PLAN_V2 § rama 16E.5 Decisión F).
    id: "operator-contacts",
    routes: ["/properties/[propertyId]/contacts"],
    profile: "operator",
    files: [
      "src/app/properties/[propertyId]/contacts/**/*.tsx",
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
  "src/app/properties/[propertyId]/local-guide/**/*.tsx",
  "src/app/properties/[propertyId]/troubleshooting/**/*.tsx",
  "src/app/properties/[propertyId]/messaging/**/*.tsx",
  "src/components/messaging/**/*.tsx",
  "src/app/properties/[propertyId]/policies/**/*.tsx",
  "src/app/properties/[propertyId]/contacts/**/*.tsx",
  "src/components/overview/**/*.tsx",
  "src/components/layout/**/*.tsx",
  "src/components/ui/theme-toggle.tsx",
  "src/components/ui/media-carousel.tsx",
  "src/components/ui/banner.tsx",
  "src/components/ui/location-map.tsx",
  "src/components/ui/tooltip.tsx",
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
  "@/components/ui/page-header",
  "@/components/ui/numbered-section",
  "@/components/ui/page-header-chip",
  "@/components/ui/field",
  "@/components/ui/hover-card",
  "@/components/ui/entity-media-card",
  "@/components/ui/entity-card-accordion",
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
export type LioraPhase = "16D.5" | "16E" | "16E.5" | "16E.6" | "16F" | "16F.5" | "16F.6" | "16I" | "16G" | "16H";
export type RemoveBy = LioraPhase | "never";

export const LIORA_PHASE_ORDER: ReadonlyArray<LioraPhase> = [
  "16D.5",
  "16E",
  "16E.5",
  "16E.6",
  "16F",
  "16F.5",
  "16F.6",
  // 16I — content-tab polish (FASE 16I). Inserted immediately after 16F.6:
  // the array order is the comparison timeline, not the letter, so "16I"
  // sorts before "16G"/"16H" (forward phase inserted by feedback). See
  // MASTER_PLAN_V2.md § FASE 16I decision 1.
  "16I",
  "16G",
  "16H",
] as const;

/** Active Liora phase the allowlist is being audited against. */
export const CURRENT_LIORA_PHASE: LioraPhase = "16I";

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
