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
