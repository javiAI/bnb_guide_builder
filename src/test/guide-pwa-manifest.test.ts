import { describe, it, expect } from "vitest";
import { buildGuidePwaManifest } from "@/lib/server/guide-pwa-manifest";
import {
  BRAND_PALETTE,
  DEFAULT_BRAND_PALETTE_KEY,
  getBrandPair,
} from "@/config/brand-palette";

describe("buildGuidePwaManifest", () => {
  it("scopes name, start_url and scope to the slug", () => {
    const m = buildGuidePwaManifest({
      slug: "casa-claudia",
      propertyNickname: "Apartamento Casa Claudia",
      brandPaletteKey: "indigo",
    });
    expect(m.name).toBe("Guía — Apartamento Casa Claudia");
    expect(m.scope).toBe("/g/casa-claudia/");
    expect(m.start_url).toBe("/g/casa-claudia/");
  });

  it("derives theme_color from brandPaletteKey", () => {
    const indigo = BRAND_PALETTE.find((p) => p.key === "indigo");
    if (!indigo) throw new Error("indigo missing from BRAND_PALETTE fixture");
    const m = buildGuidePwaManifest({
      slug: "x",
      propertyNickname: "X",
      brandPaletteKey: "indigo",
    });
    expect(m.theme_color).toBe(indigo.light);
  });

  it("falls back to default palette when brandPaletteKey is null", () => {
    const m = buildGuidePwaManifest({
      slug: "x",
      propertyNickname: "X",
      brandPaletteKey: null,
    });
    expect(m.theme_color).toBe(getBrandPair(DEFAULT_BRAND_PALETTE_KEY).light);
  });

  it("requires icons 192, 512 and a maskable 512", () => {
    const m = buildGuidePwaManifest({
      slug: "x",
      propertyNickname: "X",
      brandPaletteKey: "indigo",
    });
    expect(m.icons.find((i) => i.sizes === "192x192")).toBeTruthy();
    expect(
      m.icons.find((i) => i.sizes === "512x512" && i.purpose === undefined),
    ).toBeTruthy();
    expect(
      m.icons.find((i) => i.sizes === "512x512" && i.purpose === "maskable"),
    ).toBeTruthy();
  });

  it("truncates short_name above 12 characters", () => {
    const m = buildGuidePwaManifest({
      slug: "x",
      propertyNickname: "Apartamento Casa Claudia",
      brandPaletteKey: "indigo",
    });
    expect(m.short_name.length).toBeLessThanOrEqual(12);
  });

  it("keeps short names intact", () => {
    const m = buildGuidePwaManifest({
      slug: "x",
      propertyNickname: "Loft Sol",
      brandPaletteKey: "indigo",
    });
    expect(m.short_name).toBe("Loft Sol");
  });

  it("declares standalone display and Spanish lang", () => {
    const m = buildGuidePwaManifest({
      slug: "x",
      propertyNickname: "X",
      brandPaletteKey: "indigo",
    });
    expect(m.display).toBe("standalone");
    expect(m.lang).toBe("es-ES");
  });
});
