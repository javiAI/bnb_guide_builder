// Operator shell collapse + resize preferences (Liora 16F.5). Mirrors the
// discipline of `theme.ts`: the pre-paint script in `src/app/layout.tsx` carries
// literal copies of these key strings, attribute names and the width math
// because it runs before any JS bundle and cannot import this module. If you
// rename or re-bound anything here, update the pre-paint script in layout.tsx.
export const NAV_COLLAPSED_KEY = "shell:nav-collapsed";
export const RAIL_COLLAPSED_KEY = "shell:rail-collapsed";
export const NAV_WIDTH_KEY = "shell:nav-width";
export const RAIL_WIDTH_KEY = "shell:rail-width";

export const NAV_COLLAPSED_ATTR = "data-nav-collapsed";
export const RAIL_COLLAPSED_ATTR = "data-rail-collapsed";

export const NAV_WIDTH_VAR = "--sidebar-width";
export const RAIL_WIDTH_VAR = "--rail-width";

// Expanded width bounds + defaults. The nav collapses to an icon-rail (56px);
// the rail collapses to 0 (fully hidden) — it is re-opened from a small floating
// pull-tab pinned to the screen's right edge (RailDrawerTab), not an in-place
// strip, so it never occupies layout space while collapsed.
export const NAV_WIDTH = { min: 208, max: 360, default: 240, collapsed: 56 } as const;
export const RAIL_WIDTH = { min: 264, max: 440, default: 300, collapsed: 0 } as const;

export function clampWidth(value: number, bounds: { min: number; max: number }): number {
  if (Number.isNaN(value)) return bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}
