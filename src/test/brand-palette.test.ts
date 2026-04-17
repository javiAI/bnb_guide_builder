import { describe, it, expect } from "vitest";
import {
  BRAND_PALETTE,
  DEFAULT_BRAND_PALETTE_KEY,
  deriveDarkVariant,
  getBrandPair,
  getBrandPaletteKeys,
} from "@/config/brand-palette";

// ──────────────────────────────────────────────
// Contrast computation per WCAG 2.2 (relative luminance + contrast ratio).
// Kept local to the test so we verify the palette's claim directly instead of
// leaking a general-purpose utility.
// ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((n) => {
    const s = n / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

// Reference neutrals matching `--color-neutral-*` CSS custom properties.
const NEUTRAL_50 = "#FAFAFA";
const NEUTRAL_900 = "#111827";

describe("brand-palette — curated pairs", () => {
  it("exposes at least 6 palette options", () => {
    expect(BRAND_PALETTE.length).toBeGreaterThanOrEqual(6);
  });

  it("every palette key is unique", () => {
    const keys = BRAND_PALETTE.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every palette has a Spanish label", () => {
    for (const p of BRAND_PALETTE) {
      expect(p.label).toBeTruthy();
      expect(p.label.length).toBeGreaterThan(1);
    }
  });

  it("default key resolves to a real entry", () => {
    const keys = getBrandPaletteKeys();
    expect(keys).toContain(DEFAULT_BRAND_PALETTE_KEY);
  });

  it("palette is frozen at module load (immutable)", () => {
    expect(Object.isFrozen(BRAND_PALETTE)).toBe(true);
    for (const p of BRAND_PALETTE) {
      expect(Object.isFrozen(p)).toBe(true);
    }
  });
});

describe("brand-palette — WCAG 2.2 AA contrast", () => {
  it("light variant has ≥4.5:1 contrast on neutral-50 background", () => {
    for (const p of BRAND_PALETTE) {
      const ratio = contrast(p.light, NEUTRAL_50);
      expect(ratio, `${p.key} (${p.light}) vs ${NEUTRAL_50}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("dark variant has ≥4.5:1 contrast on neutral-900 background", () => {
    for (const p of BRAND_PALETTE) {
      const ratio = contrast(p.dark, NEUTRAL_900);
      expect(ratio, `${p.key} (${p.dark}) vs ${NEUTRAL_900}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("brand-palette — deriveDarkVariant", () => {
  it("is deterministic: repeated calls return the same hex", () => {
    const a = deriveDarkVariant("#4F46E5");
    const b = deriveDarkVariant("#4F46E5");
    expect(a).toBe(b);
  });

  it("produces a lighter luminance than the input (intended for dark mode surface)", () => {
    for (const p of BRAND_PALETTE) {
      const inputLum = relativeLuminance(p.light);
      const outputLum = relativeLuminance(p.dark);
      expect(outputLum, `${p.key}: dark variant ${p.dark} should be lighter than ${p.light}`).toBeGreaterThan(
        inputLum,
      );
    }
  });

  it("returns a valid hex string", () => {
    expect(deriveDarkVariant("#4F46E5")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("brand-palette — getBrandPair lookup", () => {
  it("returns the exact pair for a known key", () => {
    const first = BRAND_PALETTE[0];
    const pair = getBrandPair(first.key);
    expect(pair).toEqual(first);
  });

  it("falls back to default when key is null", () => {
    const pair = getBrandPair(null);
    expect(pair.key).toBe(DEFAULT_BRAND_PALETTE_KEY);
  });

  it("falls back to default when key is undefined", () => {
    const pair = getBrandPair(undefined);
    expect(pair.key).toBe(DEFAULT_BRAND_PALETTE_KEY);
  });

  it("falls back to default (with warning) for unknown keys — stale DB values shouldn't break the page", () => {
    // NODE_ENV is narrowed to a literal union by Vitest's types; cast once to
    // flip the env for the warning path and restore it in `finally`.
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    env.NODE_ENV = "test";
    const warn = console.warn;
    const calls: unknown[] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };
    try {
      const pair = getBrandPair("color-that-does-not-exist");
      expect(pair.key).toBe(DEFAULT_BRAND_PALETTE_KEY);
      expect(calls.length).toBe(1);
    } finally {
      console.warn = warn;
      env.NODE_ENV = prev;
    }
  });
});
