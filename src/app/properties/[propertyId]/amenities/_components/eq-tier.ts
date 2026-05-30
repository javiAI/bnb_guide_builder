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
export interface TierMeta {
  /** Sort key — essential (0) → recommended (1) → bonus (2). */
  order: number;
  label: string;
  /** Left-border color — categorical chart tokens for distinct, theme-safe hues. */
  borderClass: string;
}

export const TIER_META: Record<ImportanceLevel, TierMeta> = {
  highlight: { order: 0, label: "Esencial", borderClass: "border-l-[var(--color-chart-1)]" },
  standard: { order: 1, label: "Recomendado", borderClass: "border-l-[var(--color-chart-2)]" },
  bonus: { order: 2, label: "Destacado", borderClass: "border-l-[var(--color-chart-3)]" },
};
