import { describe, it, expect } from "vitest";
import { buildBookingPayload } from "@/lib/exports/booking";
import type { PropertyExportContext } from "@/lib/exports/booking/engine";
import { bookingListingPayloadSchema } from "@/lib/schemas/booking-listing";

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
    spaceTypeCounts: {
      "sp.bedroom": 3,
      "sp.bathroom": 2,
      "sp.kitchen": 1,
      "sp.living_room": 1,
    },
    presentAmenityKeys: new Set([
      "am.wifi",
      "am.kitchen",
      "am.air_conditioning",
    ]),
    defaultLocale: "es",
    ...overrides,
  };
}

describe("buildBookingPayload — happy path", () => {
  it("produces a Zod-valid payload from a fully populated context", () => {
    const { payload, warnings } = buildBookingPayload(baseContext());
    const parsed = bookingListingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);

    expect(payload.property_type_category).toBe("7");
    expect(payload.bedrooms).toBe(3);
    expect(payload.bathrooms).toBe(2);
    expect(payload.max_occupancy).toBe(6);
    expect(payload.shared_spaces?.kitchen).toBe(true);
    expect(payload.shared_spaces?.living_room).toBe(true);
    expect(payload.policies?.parties).toBe(false);
    expect(payload.policies?.pets).toBe(false);
    expect(payload.policies?.smoking).toBe("not_allowed");
    expect(payload.amenity_ids).toEqual(expect.arrayContaining(["107", "20", "11"]));
    expect(payload.house_rules_text).toContain("No fumar dentro");
    expect(payload.checkin_instructions).toContain("Método de acceso");
    expect(payload.locale).toBe("es");

    // Always-emitted warning groups: pricing fields (2), enum passthrough (1),
    // free_text passthrough (2: house_rules_text + checkin_instructions).
    // Property type with multiple Booking aliases adds one more (alternatives).
    const codes = warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["missing_pricing_currency"]));
    expect(codes).toEqual(expect.arrayContaining(["enum_value_passthrough"]));
    expect(codes).toEqual(expect.arrayContaining(["free_text_passthrough"]));
  });
});

describe("buildBookingPayload — partial context", () => {
  it("omits fields cleanly when data is missing and emits no spurious warnings", () => {
    const ctx = baseContext({
      propertyType: null,
      bedroomsCount: null,
      bathroomsCount: null,
      personCapacity: null,
      primaryAccessMethod: null,
      policiesJson: null,
      presentSpaceTypes: new Set(),
      spaceTypeCounts: {},
      presentAmenityKeys: new Set(),
    });
    const { payload, warnings } = buildBookingPayload(ctx);

    expect(payload.property_type_category).toBeUndefined();
    expect(payload.bedrooms).toBeUndefined();
    expect(payload.bathrooms).toBeUndefined();
    expect(payload.max_occupancy).toBeUndefined();
    expect(payload.shared_spaces).toBeUndefined();
    expect(payload.amenities).toBeUndefined();
    expect(payload.policies).toBeUndefined();
    expect(payload.house_rules_text).toBeUndefined();
    expect(payload.checkin_instructions).toBeUndefined();
    expect(payload.amenity_ids).toEqual([]);

    const pricingWarnings = warnings.filter((w) => w.code === "missing_pricing_currency");
    expect(pricingWarnings).toHaveLength(2);
  });
});

describe("buildBookingPayload — custom values", () => {
  it("emits a custom_value_unmapped warning when the host has a custom property type label", () => {
    const ctx = baseContext({
      propertyType: null,
      customPropertyTypeLabel: "Cueva trogloditas siglo XIX",
    });
    const { payload, warnings } = buildBookingPayload(ctx);
    expect(payload.property_type_category).toBeUndefined();
    expect(warnings.some((w) => w.code === "custom_value_unmapped")).toBe(true);
  });

  it("folds custom access method into checkin_instructions free-text", () => {
    const ctx = baseContext({
      primaryAccessMethod: "am.smart_lock",
      customAccessMethodLabel: "Cerradura biométrica de huella + retina",
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.checkin_instructions).toContain("Cerradura biométrica");
  });
});

describe("buildBookingPayload — room counter fallback", () => {
  it("sums spaceTypeCounts across matching taxonomy items when explicit counts are null", () => {
    const ctx = baseContext({
      bedroomsCount: null,
      bathroomsCount: null,
      presentSpaceTypes: new Set(["sp.bedroom", "sp.bathroom"]),
      spaceTypeCounts: {
        "sp.bedroom": 4,
        "sp.bathroom": 2,
      },
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.bedrooms).toBe(4);
    expect(payload.bathrooms).toBe(2);
  });

  it("omits counters when spaceTypeCounts is empty and explicit counts are null", () => {
    const ctx = baseContext({
      bedroomsCount: null,
      bathroomsCount: null,
      presentSpaceTypes: new Set(),
      spaceTypeCounts: {},
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.bedrooms).toBeUndefined();
    expect(payload.bathrooms).toBeUndefined();
  });
});

describe("buildBookingPayload — events policy boolean", () => {
  it("maps 'small_gatherings' to policies.parties:true", () => {
    const ctx = baseContext({
      policiesJson: { events: { policy: "small_gatherings", maxPeople: 8 } },
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.policies?.parties).toBe(true);
  });

  it("maps 'with_approval' to policies.parties:true", () => {
    const ctx = baseContext({
      policiesJson: { events: { policy: "with_approval" } },
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.policies?.parties).toBe(true);
  });

  it("maps 'not_allowed' to policies.parties:false", () => {
    const ctx = baseContext({
      policiesJson: { events: { policy: "not_allowed" } },
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.policies?.parties).toBe(false);
  });
});

describe("buildBookingPayload — commercial_photography asymmetry", () => {
  it("folds commercial_photography 'with_permission' into house_rules_text", () => {
    const ctx = baseContext({
      policiesJson: {
        events: { policy: "not_allowed" },
        commercialPhotography: "with_permission",
      },
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.house_rules_text).toContain("Fotografía comercial");
  });

  it("does NOT add a commercial_photography line when 'not_allowed'", () => {
    const ctx = baseContext({
      policiesJson: {
        events: { policy: "not_allowed" },
        commercialPhotography: "not_allowed",
      },
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.house_rules_text ?? "").not.toContain("Fotografía comercial");
  });
});

describe("buildBookingPayload — checkin_instructions free-text", () => {
  it("composes 'Método de acceso: {label}.' when only label is present", () => {
    const ctx = baseContext({
      primaryAccessMethod: "am.smart_lock",
      customAccessMethodLabel: null,
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.checkin_instructions).toMatch(/^Método de acceso: .+\.$/);
  });

  it("omits checkin_instructions when primaryAccessMethod is null", () => {
    const ctx = baseContext({
      primaryAccessMethod: null,
      customAccessMethodLabel: null,
    });
    const { payload } = buildBookingPayload(ctx);
    expect(payload.checkin_instructions).toBeUndefined();
  });
});
