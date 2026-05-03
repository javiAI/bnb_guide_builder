import type { SectionScores } from "@/lib/services/completeness.service";

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
