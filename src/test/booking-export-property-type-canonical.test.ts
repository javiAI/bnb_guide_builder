import { describe, it, expect } from "vitest";
import { resolvePropertyTypeCanonical } from "@/lib/exports/booking";
import { propertyTypes } from "@/lib/taxonomy-loader";
import type { PlatformMapping } from "@/lib/types/taxonomy";

describe("resolvePropertyTypeCanonical (booking)", () => {
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

  it("returns the first Booking external_id as canonical for pt.house and exposes the rest as alternatives", () => {
    const result = resolvePropertyTypeCanonical("pt.house");
    expect(result.unknown).toBe(false);
    expect(result.platformUnsupported).toBe(false);
    expect(result.canonical).toBe("7");
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it("matches the JSON `source[]` order for canonical selection (rule under test)", () => {
    const item = propertyTypes.items.find((i) => i.id === "pt.apartment");
    expect(item).toBeDefined();
    const bookingExternalIds = (item!.source ?? [])
      .filter(
        (e): e is PlatformMapping =>
          typeof e === "object" && e !== null && !Array.isArray(e),
      )
      .filter((m) => m.platform === "booking" && m.kind === "external_id")
      .map((m) => (m.kind === "external_id" ? m.external_id : null))
      .filter((v): v is string => typeof v === "string");
    const result = resolvePropertyTypeCanonical("pt.apartment");
    expect(result.canonical).toBe(bookingExternalIds[0]);
  });

  it("returns canonical:null for an item with platform_supported:false", () => {
    const unsupported = propertyTypes.items.find((i) => i.id === "pt.other");
    expect(unsupported).toBeDefined();
    expect(unsupported!.platform_supported).toBe(false);
    const result = resolvePropertyTypeCanonical("pt.other");
    expect(result).toEqual({
      canonical: null,
      alternatives: [],
      platformUnsupported: true,
      unknown: false,
    });
  });
});
