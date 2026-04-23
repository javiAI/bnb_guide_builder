import { describe, it, expect } from "vitest";
import { resolvePropertyTypeCanonical } from "@/lib/exports/airbnb";
import { propertyTypes } from "@/lib/taxonomy-loader";
import type { PlatformMapping } from "@/lib/types/taxonomy";

describe("resolvePropertyTypeCanonical", () => {
  it("returns unknown:true when id is missing or unknown", () => {
    expect(resolvePropertyTypeCanonical(null)).toEqual({
      canonical: null,
      alternatives: [],
      platformUnsupported: false,
      unknown: true,
    });
    expect(resolvePropertyTypeCanonical("pt.does_not_exist")).toMatchObject({
      unknown: true,
    });
  });

  it("returns the first Airbnb external_id as canonical for pt.house and exposes the rest as alternatives", () => {
    const result = resolvePropertyTypeCanonical("pt.house");
    expect(result.unknown).toBe(false);
    expect(result.platformUnsupported).toBe(false);
    expect(result.canonical).toBe("house");
    expect(result.alternatives).toEqual(
      expect.arrayContaining([
        "townhouse",
        "bungalow",
        "cottage",
        "chalet",
        "cabin",
        "villa",
        "tiny_house",
        "farm_stay",
        "casa_particular",
      ]),
    );
  });

  it("matches the JSON `source[]` order for canonical selection (rule under test)", () => {
    const item = propertyTypes.items.find((i) => i.id === "pt.apartment");
    expect(item).toBeDefined();
    const airbnbExternalIds = (item!.source ?? [])
      .filter(
        (e): e is PlatformMapping =>
          typeof e === "object" && e !== null && !Array.isArray(e),
      )
      .filter((m) => m.platform === "airbnb" && m.kind === "external_id")
      .map((m) => (m.kind === "external_id" ? m.external_id : null))
      .filter((v): v is string => typeof v === "string");
    const result = resolvePropertyTypeCanonical("pt.apartment");
    expect(result.canonical).toBe(airbnbExternalIds[0]);
  });

  it("returns canonical:null for an item with platform_supported:false", () => {
    const synthetic = {
      id: "pt.synthetic_unsupported",
      label: "synth",
      description: "test only",
      platform_supported: false as const,
    };
    const real = propertyTypes.items;
    real.push(synthetic as (typeof real)[number]);
    try {
      const result = resolvePropertyTypeCanonical("pt.synthetic_unsupported");
      expect(result).toEqual({
        canonical: null,
        alternatives: [],
        platformUnsupported: true,
        unknown: false,
      });
    } finally {
      const idx = real.findIndex((i) => i.id === "pt.synthetic_unsupported");
      if (idx >= 0) real.splice(idx, 1);
    }
  });
});
