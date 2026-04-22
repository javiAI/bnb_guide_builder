import { describe, it, expect } from "vitest";

import {
  amenityTaxonomy,
  propertyTypes,
  spaceTypes,
  accessMethods,
  policyTaxonomy,
  getAirbnbId,
  getBookingId,
  type MappableTaxonomy,
} from "@/lib/taxonomy-loader";
import type { TaxonomyItem, PlatformMapping } from "@/lib/types/taxonomy";

// ── Coverage contract (rama 14A) ──
//
// Every classifiable item in the five taxonomies below is in exactly one of
// two states:
//   (a) `source[]` contains at least one `{platform, external_id}` mapping
//       (partial — e.g. Airbnb only — is allowed), OR
//   (b) `platform_supported: false`.
//
// Anything in between ("no mapping yet, but maybe one day") is a bug: it
// leaves the import/export contract ambiguous and will silently under-export
// when platform sync ships. The invariant test below fails the build on any
// ambiguous ID.
//
// Exclusions:
// - Amenity groups (`ag.*`) are navigational containers, never classifiable.
// - Policy group parents (`pol.house_rules`, `pol.fees`) hold leaves; only
//   the leaves inside `groups[].items[]` are classifiable.
// - `source_refs` is a separate map of doc provenance, not platform mappings.

const CLASSIFIABLE: Record<MappableTaxonomy, TaxonomyItem[]> = {
  amenities: amenityTaxonomy.items,
  property_types: propertyTypes.items,
  space_types: spaceTypes.items,
  access_methods: accessMethods.items,
  policies: policyTaxonomy.groups.flatMap((g) =>
    Array.isArray(g.items) ? g.items : [],
  ),
};

const VALID_PLATFORMS: ReadonlySet<string> = new Set([
  "airbnb",
  "booking",
  "vrbo",
]);

function isWellFormedMapping(x: unknown): x is PlatformMapping {
  if (!x || typeof x !== "object") return false;
  const rec = x as Record<string, unknown>;
  return (
    typeof rec.platform === "string" &&
    VALID_PLATFORMS.has(rec.platform) &&
    typeof rec.external_id === "string" &&
    rec.external_id.length > 0
  );
}

function hasAirbnbOrBookingMapping(item: TaxonomyItem): boolean {
  const source = item.source;
  if (!Array.isArray(source)) return false;
  return source.some(
    (entry) =>
      isWellFormedMapping(entry) &&
      (entry.platform === "airbnb" || entry.platform === "booking"),
  );
}

describe("Platform mapping coverage (rama 14A)", () => {
  for (const taxonomy of Object.keys(CLASSIFIABLE) as MappableTaxonomy[]) {
    describe(taxonomy, () => {
      const items = CLASSIFIABLE[taxonomy];

      it("has at least one classifiable item", () => {
        expect(items.length).toBeGreaterThan(0);
      });

      it("every item is either mapped or explicitly unsupported", () => {
        const ambiguous: string[] = [];
        for (const item of items) {
          const mapped = hasAirbnbOrBookingMapping(item);
          const unsupported = item.platform_supported === false;
          if (mapped === unsupported) {
            // Both true (contradiction) or both false (ambiguous) → fail.
            ambiguous.push(item.id);
          }
        }
        expect(ambiguous, `ambiguous ids in ${taxonomy}`).toEqual([]);
      });

      it("every source[] entry is a well-formed PlatformMapping", () => {
        const malformed: Array<{ id: string; entry: unknown }> = [];
        for (const item of items) {
          const source = item.source;
          if (!Array.isArray(source)) continue;
          for (const entry of source) {
            if (!isWellFormedMapping(entry)) {
              malformed.push({ id: item.id, entry });
            }
          }
        }
        expect(malformed, `malformed source entries in ${taxonomy}`).toEqual([]);
      });

      it("no item declares both a mapping and platform_supported:false", () => {
        const contradictions: string[] = [];
        for (const item of items) {
          if (hasAirbnbOrBookingMapping(item) && item.platform_supported === false) {
            contradictions.push(item.id);
          }
        }
        expect(contradictions, `contradictions in ${taxonomy}`).toEqual([]);
      });
    });
  }
});

describe("Platform mapping helpers", () => {
  it("getAirbnbId returns the first airbnb external_id or null", () => {
    expect(getAirbnbId("amenities", "am.wifi")).toBe("4");
    expect(getAirbnbId("property_types", "pt.apartment")).toBe("apartment");
    expect(getAirbnbId("access_methods", "am.smart_lock")).toBe("smart_lock");
    expect(getAirbnbId("space_types", "sp.bedroom")).toBeNull();
    expect(getAirbnbId("property_types", "pt.other")).toBeNull();
  });

  it("getBookingId returns the first booking external_id or null", () => {
    expect(getBookingId("amenities", "am.wifi")).toBe("107");
    expect(getBookingId("property_types", "pt.apartment")).toBeNull();
  });

  it("throws on unknown ids so callers can't silently mismatch", () => {
    expect(() => getAirbnbId("amenities", "am.totally_fake")).toThrow(/Unknown/);
    expect(() => getBookingId("property_types", "pt.nonexistent")).toThrow(
      /Unknown/,
    );
  });
});
