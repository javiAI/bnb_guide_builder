import { describe, it, expect } from "vitest";

import {
  amenityTaxonomy,
  propertyTypes,
  spaceTypes,
  accessMethods,
  policyTaxonomy,
  getAirbnbId,
  getBookingId,
  getAirbnbMapping,
  getBookingMapping,
  validatePlatformMapping,
  type MappableTaxonomy,
} from "@/lib/taxonomy-loader";
import type { TaxonomyItem, PlatformMapping } from "@/lib/types/taxonomy";

// ── Coverage contract (rama 14A, reformulated) ──
//
// Every classifiable item in the five taxonomies below is in exactly one of
// two states:
//   (a) `source[]` contains at least one well-formed `PlatformMapping` whose
//       `platform` is `"airbnb"` or `"booking"` (any `kind` allowed by that
//       taxonomy), OR
//   (b) `platform_supported: false`.
//
// VRBO is allowed in the `PlatformId` union for future-proofing but does not
// satisfy the invariant — a VRBO-only mapping would still force an
// `platform_supported: false` on the item today. Airbnb/Booking is the gate
// because 14B/14C exporters only target those two.
//
// Platform vocabulary is heterogeneous — flat catalogs (amenity IDs), listing
// fields (pets_allowed bool), free-text buckets (house_rules), and counters
// (bedrooms). A single shape `{platform, external_id}` forced honest gaps to
// be marked `platform_supported:false`; the discriminated `PlatformMapping`
// represents each case faithfully. 14B/14C consume via `getAirbnbMapping` /
// `getBookingMapping` and switch on `kind`.
//
// Per-taxonomy allowed kinds (enforced below — prevents drift like a
// `room_counter` mapping sneaking into `policies`):
// - amenities:      external_id | structured_field
// - property_types: external_id
// - access_methods: external_id | free_text
// - space_types:    room_counter | structured_field
// - policies:       structured_field | free_text
//
// Exclusions: `ag.*` groups in amenities and `pol.house_rules`/`pol.fees`
// parents in policies are navigational containers, not classifiable.

const CLASSIFIABLE: Record<MappableTaxonomy, TaxonomyItem[]> = {
  amenities: amenityTaxonomy.items,
  property_types: propertyTypes.items,
  space_types: spaceTypes.items,
  access_methods: accessMethods.items,
  policies: policyTaxonomy.groups.flatMap((g) =>
    Array.isArray(g.items) ? g.items : [],
  ),
};

const ALLOWED_KINDS: Record<
  MappableTaxonomy,
  ReadonlySet<PlatformMapping["kind"]>
> = {
  amenities: new Set(["external_id", "structured_field"]),
  property_types: new Set(["external_id"]),
  access_methods: new Set(["external_id", "free_text"]),
  space_types: new Set(["room_counter", "structured_field"]),
  policies: new Set(["structured_field", "free_text"]),
};

function hasAirbnbOrBookingMapping(item: TaxonomyItem): boolean {
  const source = item.source;
  if (!Array.isArray(source)) return false;
  return source.some((entry) => {
    if (validatePlatformMapping(entry) !== null) return false;
    const p = (entry as { platform: string }).platform;
    return p === "airbnb" || p === "booking";
  });
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
            ambiguous.push(item.id);
          }
        }
        expect(ambiguous, `ambiguous ids in ${taxonomy}`).toEqual([]);
      });

      it("every source[] entry is a well-formed PlatformMapping", () => {
        const malformed: Array<{ id: string; error: string }> = [];
        for (const item of items) {
          const source = item.source;
          if (!Array.isArray(source)) continue;
          for (const entry of source) {
            const err = validatePlatformMapping(entry);
            if (err !== null) malformed.push({ id: item.id, error: err });
          }
        }
        expect(malformed, `malformed source entries in ${taxonomy}`).toEqual([]);
      });

      it(`only uses kinds allowed for ${taxonomy}`, () => {
        const allowed = ALLOWED_KINDS[taxonomy];
        const disallowed: Array<{ id: string; kind: string }> = [];
        for (const item of items) {
          const source = item.source;
          if (!Array.isArray(source)) continue;
          for (const entry of source) {
            if (validatePlatformMapping(entry) !== null) continue;
            const kind = (entry as PlatformMapping).kind;
            if (!allowed.has(kind)) disallowed.push({ id: item.id, kind });
          }
        }
        expect(disallowed, `disallowed kinds in ${taxonomy}`).toEqual([]);
      });

      it("no item declares both a mapping and platform_supported:false", () => {
        const contradictions: string[] = [];
        for (const item of items) {
          if (
            hasAirbnbOrBookingMapping(item) &&
            item.platform_supported === false
          ) {
            contradictions.push(item.id);
          }
        }
        expect(contradictions, `contradictions in ${taxonomy}`).toEqual([]);
      });
    });
  }
});

describe("Platform mapping helpers", () => {
  it("getAirbnbMapping returns the discriminated mapping for the item", () => {
    expect(getAirbnbMapping("amenities", "am.wifi")).toEqual({
      platform: "airbnb",
      kind: "external_id",
      external_id: "4",
    });
    expect(getAirbnbMapping("policies", "pol.pets")).toEqual({
      platform: "airbnb",
      kind: "structured_field",
      field: "listing_policies.pets_allowed",
      transform: "bool",
    });
    expect(getAirbnbMapping("space_types", "sp.bedroom")).toEqual({
      platform: "airbnb",
      kind: "room_counter",
      counter: "bedrooms",
    });
    expect(getAirbnbMapping("access_methods", "am.smart_lock")).toEqual({
      platform: "airbnb",
      kind: "external_id",
      external_id: "smart_lock",
    });
    expect(getBookingMapping("access_methods", "am.smart_lock")).toEqual({
      platform: "booking",
      kind: "free_text",
      field: "checkin_instructions",
    });
    expect(getAirbnbMapping("space_types", "sp.storage")).toBeNull();
  });

  it("getAirbnbId / getBookingId return external_id only when kind === external_id", () => {
    expect(getAirbnbId("amenities", "am.wifi")).toBe("4");
    expect(getBookingId("amenities", "am.wifi")).toBe("107");
    expect(getAirbnbId("property_types", "pt.apartment")).toBe("apartment");
    expect(getBookingId("property_types", "pt.apartment")).toBe("3");
    // structured_field is not a catalog ID, sugar returns null
    expect(getAirbnbId("policies", "pol.pets")).toBeNull();
    // room_counter is not a catalog ID either
    expect(getAirbnbId("space_types", "sp.bedroom")).toBeNull();
    // no mapping for that platform
    expect(getBookingId("property_types", "pt.house")).toBeNull();
  });

  it("throws on unknown ids so callers can't silently mismatch", () => {
    expect(() => getAirbnbMapping("amenities", "am.totally_fake")).toThrow(
      /Unknown/,
    );
    expect(() => getBookingMapping("property_types", "pt.nonexistent")).toThrow(
      /Unknown/,
    );
    expect(() => getAirbnbId("policies", "pol.fake")).toThrow(/Unknown/);
  });
});
