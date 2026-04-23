import { z } from "zod";

/**
 * Airbnb listing payload — best-effort export schema (Rama 14B).
 *
 * IMPORTANT: this Zod schema is an INTERNAL best-effort representation of
 * an Airbnb listing payload, derived from:
 *   - `taxonomies/platform-catalogs/airbnb-structured-fields.json` (manifest of
 *     fields we serialize into)
 *   - `taxonomies/platform-catalogs/airbnb-property-types.json` (enum of
 *     property_type_category values)
 *   - public Airbnb help-center articles
 *
 * It is NOT a contractually validated representation of Airbnb's Listings
 * API payload. The API is partner-only and our docs are interpretive. Until a
 * partner integration confirms the shape, treat warnings emitted by the
 * exporter as the source of truth for what we did NOT manage to map.
 *
 * The exporter validates the assembled payload against this schema before
 * returning it, so callers can rely on field types matching the schema even
 * if the schema later turns out to disagree with Airbnb. When that happens
 * the fix is: update this schema + the exporter, do not loosen the contract.
 */

const propertyTypeCategorySchema = z.string().min(1);

const accessibilityFeaturesSchema = z
  .object({
    step_free_guest_entrance: z.boolean().optional(),
    guest_entrance_wide_81cm: z.boolean().optional(),
    accessible_parking_spot: z.boolean().optional(),
    step_free_path_to_entrance: z.boolean().optional(),
    step_free_bedroom_access: z.boolean().optional(),
    bedroom_entrance_wide_81cm: z.boolean().optional(),
    step_free_bathroom_access: z.boolean().optional(),
    bathroom_entrance_wide_81cm: z.boolean().optional(),
    shower_grab_bar: z.boolean().optional(),
    toilet_grab_bar: z.boolean().optional(),
    step_free_shower: z.boolean().optional(),
    shower_bath_chair: z.boolean().optional(),
    ceiling_mobile_hoist: z.boolean().optional(),
  })
  .strict();

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

const listingPoliciesSchema = z
  .object({
    smoking_allowed: z.string().optional(),
    events_allowed: z.boolean().optional(),
    pets_allowed: z.boolean().optional(),
    commercial_photography_allowed: z.boolean().optional(),
  })
  .strict();

export const airbnbListingPayloadSchema = z
  .object({
    property_type_category: propertyTypeCategorySchema.optional(),
    person_capacity: z.number().int().min(1).optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    check_in_method: z.string().optional(),
    amenity_ids: z.array(z.string()).default([]),
    shared_spaces: sharedSpacesSchema.optional(),
    amenities: amenitiesStructuredSchema.optional(),
    accessibility_features: accessibilityFeaturesSchema.optional(),
    listing_policies: listingPoliciesSchema.optional(),
    house_rules: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict();

export type AirbnbListingPayload = z.infer<typeof airbnbListingPayloadSchema>;
