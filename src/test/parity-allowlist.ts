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
 */
export interface AuditedSurface {
  id: string;
  routes: string[];
  files: string[];
}

export const AUDITED_SURFACES: ReadonlyArray<AuditedSurface> = [
  {
    id: "overview",
    routes: ["/properties/[propertyId]"],
    files: [
      "src/app/properties/[propertyId]/page.tsx",
      "src/app/properties/[propertyId]/layout.tsx",
      "src/components/overview/**/*.tsx",
      "src/components/layout/**/*.tsx",
      "src/components/ui/theme-toggle.tsx",
    ],
  },
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
}> = [
  {
    file: "src/app/properties/[propertyId]/amenities/amenity-selector-v2.tsx",
    identifier: "AmenitySelectorV2",
    reason:
      "Pre-Liora amenity instance migration leftover. Rename to AmenitySelector + amenity-selector.tsx in a dedicated cleanup PR (file + 1 caller in amenities/page.tsx).",
  },
];

/**
 * Liora replatform branch identifiers used by exception entries to declare
 * when an exception is expected to be removed. `never` is reserved for
 * structural exceptions that are not on the rollout path (e.g. third-party
 * brand SVGs); every other value is a hard deadline for cleanup.
 */
export type RemoveBy = "16D.5" | "16E" | "16F" | "16G" | "never";

export interface ExceptionEntry {
  file: string;
  reason: string;
  owner?: string;
  removeBy: RemoveBy;
}

/** Branch this allowlist is being audited against (current development branch). */
export const CURRENT_BRANCH = "16D.5";

/**
 * Touch-target violations grandfathered into the gate. Each entry must reach
 * a 44×44 hit area (visual ≥44 OR `recipe-icon-btn-32` slop) before being
 * deleted from this list. Pre-populated for files refactored later in this
 * same branch (commit 4) — entries removed when their fix lands.
 */
export const TOUCH_TARGET_EXCEPTIONS: ReadonlyArray<ExceptionEntry> = [
  {
    file: "src/components/layout/topbar.tsx",
    reason:
      "Bell placeholder (32×32) + Publicar mobile (32×32). Refactored to IconButton size='sm' (slop) + min-h/w 44 in commit 4 of this branch.",
    removeBy: "16D.5",
  },
  {
    file: "src/components/layout/publishing-rail.tsx",
    reason:
      "'Abrir guía' link (h-8) reaches 44 in commit 4 of this branch via min-h-[44px].",
    removeBy: "16D.5",
  },
  {
    file: "src/components/layout/mobile-nav-drawer.tsx",
    reason:
      "Menu open + close buttons (h-8 w-8) reach 44 visual in commit 4 of this branch (mobile-only — slop is not sufficient on coarse pointers).",
    removeBy: "16D.5",
  },
];

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
 * `<div>` instead of `<Card variant="overview">`. Pre-populated for the
 * cards refactored in commit 3 of this branch — entries removed when the
 * raw shell is replaced with the primitive.
 */
export const PRIMITIVE_ADOPTION_EXCEPTIONS: ReadonlyArray<ExceptionEntry> = [
  {
    file: "src/components/overview/activity-feed-card.tsx",
    reason: "Replaces raw shell with <Card variant='overview'> in commit 3.",
    removeBy: "16D.5",
  },
  {
    file: "src/components/overview/tasks-list-card.tsx",
    reason: "Replaces raw shell with <Card variant='overview'> in commit 3.",
    removeBy: "16D.5",
  },
];
