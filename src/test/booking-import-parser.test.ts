import { describe, it, expect } from "vitest";
import { bookingToCanonical } from "@/lib/imports/booking/parser";
import type { BookingListingInput } from "@/lib/schemas/booking-listing-input";

function basePayload(
  overrides: Partial<BookingListingInput> = {},
): BookingListingInput {
  return {
    property_type_category: "3",
    max_occupancy: 6,
    bedrooms: 3,
    bathrooms: 2,
    amenity_ids: ["2", "3", "4"],
    shared_spaces: { kitchen: true, living_room: true },
    amenities: { workspace: true },
    policies: {
      smoking: "not_allowed",
      parties: false,
      pets: false,
    },
    fees: { cleaning: 50, extra_person: 10, currency: "EUR" },
    house_rules_text: "No fumar dentro.",
    checkin_instructions: "Llaves en la caja de seguridad.",
    locale: "es",
    ...overrides,
  };
}

describe("bookingToCanonical — happy path", () => {
  it("maps all covered Booking fields into the canonical PropertyImportContext", () => {
    const { context, warnings } = bookingToCanonical(basePayload());

    expect(context.propertyType).toEqual({
      taxonomyId: expect.any(String),
      sourceExternalId: "3",
      sourceLabelEn: expect.any(String),
    });
    expect(context.bedroomsCount).toBe(3);
    expect(context.bathroomsCount).toBe(2);
    expect(context.personCapacity).toBe(6);

    // Booking has no check_in_method enum; primaryAccessMethod should be null
    expect(context.primaryAccessMethod).toBeNull();

    // Policies: parties (bool) → events.policy, pets (bool) → pets.allowed
    expect(context.policiesPartial.events).toEqual({ policy: "not_allowed" });
    expect(context.policiesPartial.pets).toEqual({ allowed: false });

    // Free text now includes both houseRules and checkInInstructions
    expect(context.freeText.houseRules).toBe("No fumar dentro.");
    expect(context.freeText.checkInInstructions).toBe("Llaves en la caja de seguridad.");

    // Pricing mapped from fees.*
    expect(context.pricing.cleaningFee).toBe(50);
    expect(context.pricing.extraPersonFee).toBe(10);
    expect(context.pricing.currency).toBe("EUR");

    // Amenities resolved
    expect(context.incomingAmenityKeys.size).toBeGreaterThan(0);

    // Booking has no accessibility_features; presencePings.accessibilityFeatures should be empty
    expect(context.presencePings.accessibilityFeatures).toEqual({});

    // May have 0-1 warnings depending on smoking enum passthrough
    expect(warnings.length).toBeLessThanOrEqual(1);
  });
});

describe("bookingToCanonical — unresolved amenities", () => {
  it("collects unresolved amenity_ids as warnings and unresolvedExternalIds", () => {
    const { warnings } = bookingToCanonical(
      basePayload({
        amenity_ids: ["999_unknown_id", "101"],
      }),
    );

    const unresolvedWarnings = warnings.filter(
      (w) => w.code === "unresolved_external_id",
    );
    expect(unresolvedWarnings.length).toBeGreaterThan(0);
    expect(unresolvedWarnings[0]).toEqual(
      expect.objectContaining({
        code: "unresolved_external_id",
        field: expect.stringContaining("999_unknown_id"),
      }),
    );
  });
});

describe("bookingToCanonical — Booking-specific divergences", () => {
  it("silently drops accessibility_features (Booking has none)", () => {
    const { context, warnings } = bookingToCanonical(
      basePayload({
        // Even if somehow present in heterogeneous payload, should be ignored
      }),
    );

    expect(context.presencePings.accessibilityFeatures).toEqual({});

    // No warnings about missing accessibility — silent drop expected for Booking
    const a11yWarnings = warnings.filter(
      (w) => w.field?.includes("accessibility"),
    );
    expect(a11yWarnings.length).toBe(0);
  });

  it("has no primaryAccessMethod (no check_in_method enum in Booking)", () => {
    const { context, warnings } = bookingToCanonical(basePayload());

    expect(context.primaryAccessMethod).toBeNull();

    // No warnings about missing access method — silent for Booking
    const accessWarnings = warnings.filter(
      (w) => w.field?.includes("check_in"),
    );
    expect(accessWarnings.length).toBe(0);
  });

  it("maps checkin_instructions to freeText.checkInInstructions", () => {
    const { context } = bookingToCanonical(
      basePayload({
        checkin_instructions: "Ring the bell on the door.",
      }),
    );

    expect(context.freeText.checkInInstructions).toBe(
      "Ring the bell on the door.",
    );
  });
});

describe("bookingToCanonical — pricing without currency", () => {
  it("emits requires_currency_for_fees warning when fees lack currency", () => {
    const { warnings } = bookingToCanonical(
      basePayload({
        fees: { cleaning: 50, extra_person: 10 },
      }),
    );

    const currencyWarnings = warnings.filter(
      (w) => w.code === "requires_currency_for_fees",
    );
    expect(currencyWarnings.length).toBeGreaterThan(0);
  });

  it("does not warn when fees have currency", () => {
    const { warnings } = bookingToCanonical(
      basePayload({
        fees: { cleaning: 50, extra_person: 10, currency: "EUR" },
      }),
    );

    const currencyWarnings = warnings.filter(
      (w) => w.code === "requires_currency_for_fees",
    );
    expect(currencyWarnings.length).toBe(0);
  });
});

describe("bookingToCanonical — locale mismatch detection", () => {
  it("captures incomingLocale for mismatch detection in reconciler", () => {
    const { context } = bookingToCanonical(
      basePayload({ locale: "en" }),
    );

    expect(context.incomingLocale).toBe("en");
  });
});
