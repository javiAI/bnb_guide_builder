import type { ImportanceLevel } from "@/lib/types/taxonomy";

/**
 * Tier presentation for the flattened equipamiento list (16E.5 visual parity).
 *
 * The E1 baseline grouped amenities into three banded tier sections
 * (Esenciales / Recomendados / Destacados). The kit silhouette
 * (`page-equipamiento`) groups by room instead and flattens the tiers into a
 * single per-room list. We preserve the tier signal two ways without a band:
 *   1. `order` — rows sort essential → recommended → bonus inside each group,
 *      so the reading order still communicates priority.
 *   2. `borderClass` — a categorical left border per tier (chart palette,
 *      purpose-built for distinct, theme-safe categorical hues).
 *   3. `label` — surfaced as sr-only text on each row so the tier is not a
 *      color-only signal (WCAG 1.4.1).
 */
export const TIER_ORDER: Record<ImportanceLevel, number> = {
  highlight: 0,
  standard: 1,
  bonus: 2,
};

export interface TierMeta {
  label: string;
  /** Left-border color — categorical chart tokens for distinct, theme-safe hues. */
  borderClass: string;
}

export const TIER_META: Record<ImportanceLevel, TierMeta> = {
  highlight: { label: "Esencial", borderClass: "border-l-[var(--color-chart-1)]" },
  standard: { label: "Recomendado", borderClass: "border-l-[var(--color-chart-2)]" },
  bonus: { label: "Destacado", borderClass: "border-l-[var(--color-chart-3)]" },
};
