import { z } from "zod";

/**
 * Booking.com listing payload — best-effort export schema (Rama 14C).
 *
 * IMPORTANT: this Zod schema is an INTERNAL best-effort representation of
 * a Booking.com listing payload, derived from:
 *   - `taxonomies/platform-catalogs/booking-structured-fields.json` (manifest of
 *     fields we serialize into)
 *   - `taxonomies/platform-catalogs/booking-property-types.json` (PCT codes)
 *   - Booking Connectivity API public docs
 *
 * It is NOT a contractually validated representation of Booking's Content /
 * Connectivity API payload. Treat warnings emitted by the exporter as the
 * source of truth for what we did NOT manage to map.
 *
 * The exporter validates the assembled payload against this schema before
 * returning it, so callers can rely on field types matching the schema even
 * if the schema later turns out to disagree with Booking. When that happens
 * the fix is: update this schema + the exporter, do not loosen the contract.
 *
 * Shape divergences from the Airbnb schema (see docs/FEATURES/PLATFORM_INTEGRATIONS.md):
 *   - `max_occupancy` (not `person_capacity`)
 *   - `policies.*` (not `listing_policies.*`)
 *   - `fees.{cleaning,extra_person}` (not `pricing.{cleaning_fee,extra_person_fee}`)
 *   - `house_rules_text` (not `house_rules`)
 *   - `checkin_instructions` free-text bucket (Booking has no check_in_method enum)
 *   - No `accessibility_features` namespace (Booking manifest does not declare any)
 *   - No structured `commercial_photography_allowed` bool (folded into house_rules_text)
 */

const propertyTypeCategorySchema = z.string().min(1);

const sharedSpacesSchema = z
  .object({
    kitchen: z.boolean().optional(),
    living_room: z.boolean().optional(),
    dining: z.boolean().optional(),
  })
  .strict();

const amenitiesStructuredSchema = z
  .object({
    workspace: z.boolean().optional(),
    laundry_area: z.boolean().optional(),
    balcony: z.boolean().optional(),
    patio: z.boolean().optional(),
    garden: z.boolean().optional(),
    garage: z.boolean().optional(),
    pool: z.boolean().optional(),
  })
  .strict();

const policiesSchema = z
  .object({
    smoking: z.string().optional(),
    parties: z.boolean().optional(),
    pets: z.boolean().optional(),
  })
  .strict();

export const bookingListingPayloadSchema = z
  .object({
    property_type_category: propertyTypeCategorySchema.optional(),
    max_occupancy: z.number().int().min(1).optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    amenity_ids: z.array(z.string()).default([]),
    shared_spaces: sharedSpacesSchema.optional(),
    amenities: amenitiesStructuredSchema.optional(),
    policies: policiesSchema.optional(),
    house_rules_text: z.string().optional(),
    checkin_instructions: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict();

export type BookingListingPayload = z.infer<typeof bookingListingPayloadSchema>;
