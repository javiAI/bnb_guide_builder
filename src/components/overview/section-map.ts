import type { SectionScores } from "@/lib/services/completeness.service";

/**
 * Single source of truth for how readiness sections surface in the Overview —
 * display label + the URL segment under `/properties/:id/`. Shared across the
 * gaps card and the next-action card so a renamed section is a one-file edit.
 */
export interface SectionMeta {
  key: keyof SectionScores;
  label: string;
  href: string;
}

export const OVERVIEW_SECTIONS: readonly SectionMeta[] = [
  { key: "spaces", label: "Espacios", href: "spaces" },
  { key: "amenities", label: "Equipamiento", href: "amenities" },
  { key: "systems", label: "Sistemas", href: "systems" },
  { key: "arrival", label: "Acceso y llegada", href: "access" },
] as const;

export const SECTION_META_BY_KEY: Record<keyof SectionScores, SectionMeta> =
  Object.fromEntries(OVERVIEW_SECTIONS.map((s) => [s.key, s])) as Record<
    keyof SectionScores,
    SectionMeta
  >;
