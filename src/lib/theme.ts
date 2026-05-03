// Canonical theme storage key — must match the inline pre-paint script in src/app/layout.tsx.
// The inline script cannot import this module (it runs before any JS bundle), so it carries
// a deliberate copy of the key literal. If you rename it here, update layout.tsx too.
export const THEME_STORAGE_KEY = "theme";
