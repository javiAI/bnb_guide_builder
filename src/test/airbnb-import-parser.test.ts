import { describe, it, expect } from "vitest";
import { airbnbToCanonical } from "@/lib/imports/airbnb/parser";
import type { AirbnbListingInput } from "@/lib/schemas/airbnb-listing-input";

function basePayload(
  overrides: Partial<AirbnbListingInput> = {},
): AirbnbListingInput {
  return {
    property_type_category: "house",
    person_capacity: 6,
    bedrooms: 3,
    bathrooms: 2,
    check_in_method: "smart_lock",
    amenity_ids: ["4", "8", "5"],
    shared_spaces: { kitchen: true, living_room: true },
    amenities: { workspace: true },
    accessibility_features: { step_free_guest_entrance: true },
    listing_policies: {
      smoking_allowed: "not_allowed",
      events_allowed: false,
      pets_allowed: false,
      commercial_photography_allowed: false,
    },
    house_rules: "No fumar dentro.",
    locale: "es",
    ...overrides,
  };
}

describe("airbnbToCanonical — happy path", () => {
  it("maps all covered fields into the canonical PropertyImportContext", () => {
    const { context, warnings } = airbnbToCanonical(basePayload());

    expect(context.propertyType).toEqual({
      taxonomyId: "pt.house",
      sourceExternalId: "house",
      sourceLabelEn: expect.any(String),
    });
    expect(context.primaryAccessMethod).toEqual({
      taxonomyId: "am.smart_lock",
      sourceExternalId: "smart_lock",
      sourceLabelEn: expect.any(String),
    });
    expect(context.bedroomsCount).toBe(3);
    expect(context.bathroomsCount).toBe(2);
    expect(context.personCapacity).toBe(6);

    // policiesPartial binary projection
    expect(context.policiesPartial.events).toEqual({ policy: "not_allowed" });
    expect(context.policiesPartial.pets).toEqual({ allowed: false });
    expect(context.policiesPartial.commercialPhotography).toBe("not_allowed");
    expect(context.policiesPartial.smoking).toBe("not_allowed");

    // amenity_ids resolved into a set of taxonomy ids
    expect(context.incomingAmenityKeys.size).toBeGreaterThan(0);

    // presence pings preserved
    expect(context.presencePings.sharedSpaces.kitchen).toBe(true);
    expect(context.presencePings.amenitiesShellBools.workspace).toBe(true);
    expect(
      context.presencePings.accessibilityFeatures.step_free_guest_entrance,
    ).toBe(true);

    // custom label fields are always null in import
    expect(context.customPropertyTypeLabel).toBeNull();
    expect(context.customAccessMethodLabel).toBeNull();

    expect(context.freeText.houseRules).toBe("No fumar dentro.");
    expect(context.incomingLocale).toBe("es");

    // Smoking enum always emits passthrough warning
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("enum_value_passthrough");
  });

  it("projects events_allowed:true to binary 'allowed'", () => {
    const { context } = airbnbToCanonical(
      basePayload({ listing_policies: { events_allowed: true } }),
    );
    expect(context.policiesPartial.events).toEqual({ policy: "allowed" });
  });

  it("projects commercial_photography_allowed:true to 'with_permission'", () => {
    const { context } = airbnbToCanonical(
      basePayload({
        listing_policies: { commercial_photography_allowed: true },
      }),
    );
    expect(context.policiesPartial.commercialPhotography).toBe(
      "with_permission",
    );
  });
});

describe("airbnbToCanonical — unresolved external_ids go to customs, never silent", () => {
  it("emits unresolved_external_id and marks taxonomyId null for unknown property type", () => {
    const { context, warnings } = airbnbToCanonical(
      basePayload({ property_type_category: "definitely_not_real" }),
    );
    expect(context.propertyType).toEqual({
      taxonomyId: null,
      sourceExternalId: "definitely_not_real",
      sourceLabelEn: null,
    });
    // customPropertyTypeLabel is NEVER populated by the parser
    expect(context.customPropertyTypeLabel).toBeNull();
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("unresolved_external_id");
  });

  it("collects unresolved amenity_ids without resolving silently", () => {
    const { context, warnings } = airbnbToCanonical(
      basePayload({ amenity_ids: ["__nope__"] }),
    );
    expect(context.incomingAmenityKeys.has("__nope__")).toBe(false);
    expect(
      context.unresolvedExternalIds.some(
        (u) => u.field === "amenity_ids" && u.value === "__nope__",
      ),
    ).toBe(true);
    expect(warnings.some((w) => w.code === "unresolved_external_id")).toBe(
      true,
    );
  });
});

describe("airbnbToCanonical — pricing without currency emits warning", () => {
  it("preserves pricing numbers and warns when currency is missing", () => {
    const { context, warnings } = airbnbToCanonical(
      basePayload({ pricing: { cleaning_fee: 50, extra_person_fee: 15 } }),
    );
    expect(context.pricing).toEqual({
      cleaningFee: 50,
      extraPersonFee: 15,
      currency: null,
    });
    expect(
      warnings.some((w) => w.code === "requires_currency_for_fees"),
    ).toBe(true);
  });

  it("does NOT warn when pricing has a currency", () => {
    const { context, warnings } = airbnbToCanonical(
      basePayload({ pricing: { cleaning_fee: 50, currency: "EUR" } }),
    );
    expect(context.pricing.currency).toBe("EUR");
    expect(
      warnings.some((w) => w.code === "requires_currency_for_fees"),
    ).toBe(false);
  });
});
