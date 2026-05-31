// Operator shell collapse preferences (16F.5). Mirrors the discipline of
// `theme.ts`: the pre-paint script in `src/app/layout.tsx` carries literal
// copies of these key strings + attribute names because it runs before any JS
// bundle and cannot import this module. If you rename anything here, update the
// pre-paint script in layout.tsx too.
export const NAV_COLLAPSED_KEY = "shell:nav-collapsed";
export const RAIL_COLLAPSED_KEY = "shell:rail-collapsed";

export const NAV_COLLAPSED_ATTR = "data-nav-collapsed";
export const RAIL_COLLAPSED_ATTR = "data-rail-collapsed";
