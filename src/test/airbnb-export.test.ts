import { describe, it, expect } from "vitest";
import { buildAirbnbPayload } from "@/lib/exports/airbnb";
import type { PropertyExportContext } from "@/lib/exports/airbnb/engine";
import { airbnbListingPayloadSchema } from "@/lib/schemas/airbnb-listing";

function baseContext(
  overrides: Partial<PropertyExportContext> = {},
): PropertyExportContext {
  return {
    propertyType: "pt.house",
    customPropertyTypeLabel: null,
    bedroomsCount: 3,
    bathroomsCount: 2,
    personCapacity: 6,
    primaryAccessMethod: "am.smart_lock",
    customAccessMethodLabel: null,
    policiesJson: {
      quietHours: { enabled: true, from: "22:00", to: "08:00" },
      smoking: "not_allowed",
      events: { policy: "not_allowed" },
      commercialPhotography: "not_allowed",
      pets: { allowed: false },
      services: { allowed: true },
    },
    presentSpaceTypes: new Set(["sp.bedroom", "sp.bathroom", "sp.kitchen", "sp.living_room"]),
    presentAmenityKeys: new Set([
      "am.wifi",
      "am.kitchen",
      "am.air_conditioning",
      "ax.step_free_guest_entrance",
    ]),
    defaultLocale: "es",
    ...overrides,
  };
}

describe("buildAirbnbPayload — happy path", () => {
  it("produces a Zod-valid payload from a fully populated context", () => {
    const { payload, warnings } = buildAirbnbPayload(baseContext());
    const parsed = airbnbListingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);

    expect(payload.property_type_category).toBe("house");
    expect(payload.bedrooms).toBe(3);
    expect(payload.bathrooms).toBe(2);
    expect(payload.person_capacity).toBe(6);
    expect(payload.check_in_method).toBe("smart_lock");
    expect(payload.shared_spaces?.kitchen).toBe(true);
    expect(payload.shared_spaces?.living_room).toBe(true);
    expect(payload.accessibility_features?.step_free_guest_entrance).toBe(true);
    expect(payload.listing_policies?.events_allowed).toBe(false);
    expect(payload.listing_policies?.pets_allowed).toBe(false);
    expect(payload.listing_policies?.commercial_photography_allowed).toBe(false);
    expect(payload.listing_policies?.smoking_allowed).toBe("not_allowed");
    expect(payload.amenity_ids).toEqual(expect.arrayContaining(["4", "8", "5"]));
    expect(payload.house_rules).toContain("No fumar dentro");
    expect(payload.locale).toBe("es");

    // Always-emitted warning groups: pricing fields (2), enum passthrough (1),
    // free_text passthrough (1). Property type with multiple Airbnb aliases
    // adds one more (alternatives notice for pt.house).
    const codes = warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["missing_pricing_currency"]));
    expect(codes).toEqual(expect.arrayContaining(["enum_value_passthrough"]));
    expect(codes).toEqual(expect.arrayContaining(["free_text_passthrough"]));
  });
});

describe("buildAirbnbPayload — partial context", () => {
  it("omits fields cleanly when data is missing and emits no spurious warnings", () => {
    const ctx = baseContext({
      propertyType: null,
      bedroomsCount: null,
      bathroomsCount: null,
      personCapacity: null,
      primaryAccessMethod: null,
      policiesJson: null,
      presentSpaceTypes: new Set(),
      presentAmenityKeys: new Set(),
    });
    const { payload, warnings } = buildAirbnbPayload(ctx);

    expect(payload.property_type_category).toBeUndefined();
    expect(payload.bedrooms).toBeUndefined();
    expect(payload.bathrooms).toBeUndefined();
    expect(payload.person_capacity).toBeUndefined();
    expect(payload.check_in_method).toBeUndefined();
    expect(payload.shared_spaces).toBeUndefined();
    expect(payload.amenities).toBeUndefined();
    expect(payload.listing_policies).toBeUndefined();
    expect(payload.house_rules).toBeUndefined();
    expect(payload.amenity_ids).toEqual([]);

    // Pricing warnings are unconditional in v1 because the manifest declares
    // both fields covered.
    const pricingWarnings = warnings.filter((w) => w.code === "missing_pricing_currency");
    expect(pricingWarnings).toHaveLength(2);
  });
});

describe("buildAirbnbPayload — custom values", () => {
  it("emits a custom_value_unmapped warning when the host has a custom property type label", () => {
    const ctx = baseContext({
      propertyType: null,
      customPropertyTypeLabel: "Cueva trogloditas siglo XIX",
    });
    const { payload, warnings } = buildAirbnbPayload(ctx);
    expect(payload.property_type_category).toBeUndefined();
    expect(warnings.some((w) => w.code === "custom_value_unmapped")).toBe(true);
  });

  it("emits a custom_value_unmapped warning for a custom access method", () => {
    const ctx = baseContext({
      primaryAccessMethod: "am.does_not_exist",
      customAccessMethodLabel: "Cerradura biométrica de huella + retina",
    });
    const { payload, warnings } = buildAirbnbPayload(ctx);
    expect(payload.check_in_method).toBeUndefined();
    expect(warnings.some((w) => w.code === "no_mapping" || w.code === "custom_value_unmapped")).toBe(true);
  });
});

describe("buildAirbnbPayload — room counter fallback", () => {
  it("falls back to counting present space types when bedroomsCount is null", () => {
    const ctx = baseContext({
      bedroomsCount: null,
      bathroomsCount: null,
      // 4 bedrooms, 2 bathrooms inferred from presence
      presentSpaceTypes: new Set([
        "sp.bedroom",
        "sp.bathroom",
      ]),
    });
    const { payload } = buildAirbnbPayload(ctx);
    expect(payload.bedrooms).toBe(1);
    expect(payload.bathrooms).toBe(1);
  });
});

describe("buildAirbnbPayload — events policy boolean", () => {
  it("maps 'small_gatherings' to events_allowed:true", () => {
    const ctx = baseContext({
      policiesJson: { events: { policy: "small_gatherings", maxPeople: 8 } },
    });
    const { payload } = buildAirbnbPayload(ctx);
    expect(payload.listing_policies?.events_allowed).toBe(true);
  });

  it("maps 'with_approval' to events_allowed:true", () => {
    const ctx = baseContext({
      policiesJson: { events: { policy: "with_approval" } },
    });
    const { payload } = buildAirbnbPayload(ctx);
    expect(payload.listing_policies?.events_allowed).toBe(true);
  });

  it("maps 'not_allowed' to events_allowed:false", () => {
    const ctx = baseContext({
      policiesJson: { events: { policy: "not_allowed" } },
    });
    const { payload } = buildAirbnbPayload(ctx);
    expect(payload.listing_policies?.events_allowed).toBe(false);
  });
});
