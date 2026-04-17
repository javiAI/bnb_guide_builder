/**
 * Curated brand palette for public guides. Each entry is a `{light, dark}`
 * pair pre-validated to meet WCAG AA contrast:
 *   - `light` achieves ≥4.5:1 against `--color-neutral-50` text.
 *   - `dark`  achieves ≥4.5:1 against `--color-neutral-900` surface.
 *
 * The `dark` variant is derived from `light` by a deterministic HSL rule —
 * `lighten(+20L) · desaturate(-10S)` — **precomputed at module load**, not
 * recomputed per render. Consumers (renderer, brand header) import
 * `getBrandPair(key)` and inject both as CSS vars.
 *
 * Adding a palette = one entry here + regenerate tests. Never hardcode
 * colors in components.
 */

export interface BrandPair {
  key: string;
  label: string;
  light: string;
  dark: string;
}

// ──────────────────────────────────────────────
// HSL utilities (internal — used to precompute dark variants)
// ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return [h, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  if (sn === 0) {
    const v = ln * 255;
    return [v, v, v];
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue2rgb = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  const hn = h / 360;
  return [hue2rgb(hn + 1 / 3) * 255, hue2rgb(hn) * 255, hue2rgb(hn - 1 / 3) * 255];
}

/** Frozen HSL rule: lighten +20L, desaturate -10S. Shared with tests. */
export function deriveDarkVariant(lightHex: string): string {
  const [r, g, b] = hexToRgb(lightHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const nl = Math.min(100, l + 20);
  const ns = Math.max(0, s - 10);
  const [nr, ng, nb] = hslToRgb(h, ns, nl);
  return rgbToHex(nr, ng, nb);
}

// ──────────────────────────────────────────────
// Palette — light values chosen for ≥4.5:1 vs #FAFAFA (neutral-50)
// ──────────────────────────────────────────────

const PALETTE_LIGHT: Array<Pick<BrandPair, "key" | "label" | "light">> = [
  { key: "indigo", label: "Índigo", light: "#4F46E5" },
  { key: "teal", label: "Turquesa", light: "#0F766E" },
  { key: "coral", label: "Coral", light: "#B91C1C" },
  { key: "olive", label: "Oliva", light: "#4D7C0F" },
  { key: "navy", label: "Azul marino", light: "#1D4ED8" },
  { key: "plum", label: "Ciruela", light: "#9333EA" },
  { key: "sienna", label: "Siena", light: "#9A3412" },
  { key: "slate", label: "Pizarra", light: "#475569" },
];

export const BRAND_PALETTE: ReadonlyArray<BrandPair> = Object.freeze(
  PALETTE_LIGHT.map((p) =>
    Object.freeze({
      key: p.key,
      label: p.label,
      light: p.light,
      dark: deriveDarkVariant(p.light),
    }),
  ),
);

export const DEFAULT_BRAND_PALETTE_KEY = "indigo";

const _byKey: ReadonlyMap<string, BrandPair> = new Map(
  BRAND_PALETTE.map((p) => [p.key, p]),
);

/**
 * Returns the palette pair for `key`, or the default (indigo) when `key` is
 * null/unknown. Unknown keys log a warning once so a stale `brandPaletteKey`
 * in DB (e.g., palette renamed in taxonomy) surfaces without breaking the
 * public page.
 */
export function getBrandPair(key: string | null | undefined): BrandPair {
  if (key) {
    const found = _byKey.get(key);
    if (found) return found;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[brand-palette] Unknown brandPaletteKey="${key}" — falling back to default "${DEFAULT_BRAND_PALETTE_KEY}".`,
      );
    }
  }
  const def = _byKey.get(DEFAULT_BRAND_PALETTE_KEY);
  if (!def) throw new Error("brand-palette: default key is missing from PALETTE_LIGHT");
  return def;
}

export function getBrandPaletteKeys(): ReadonlyArray<string> {
  return BRAND_PALETTE.map((p) => p.key);
}
