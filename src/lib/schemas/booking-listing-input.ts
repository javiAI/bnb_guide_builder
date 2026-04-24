import { z } from "zod";

/**
 * Input schema for Booking.com listing preview import (Rama 14E).
 *
 * **Superset-curated**: accepts heterogeneous Booking.com payloads by using
 * `.passthrough()` at the **top level** (unknown fields are silently ignored),
 * while sub-objects (policies, shared_spaces, amenities, fees) remain `.strict()`
 * within their known shapes to validate internal structure.
 *
 * This allows hosts to paste real Booking API payloads (which may carry extra fields)
 * without failing validation, while still catching schema errors in the parts we care about.
 * Examples:
 * - Top-level extra field `metadata: {...}` → ignored (passthrough)
 * - Malformed `policies.smoking` value → fails validation (strict)
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

const feesSchema = z
  .object({
    cleaning: z.number().optional(),
    extra_person: z.number().optional(),
    currency: z.string().optional(),
  })
  .strict()
  .optional();

/**
 * Main input schema: accepts our export format + heterogeneous Booking payloads.
 * `.passthrough()` allows extra fields; known sub-objects remain strict.
 */
export const bookingListingInputSchema = z
  .object({
    property_type_category: propertyTypeCategorySchema.optional(),
    max_occupancy: z.number().int().min(1).optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    amenity_ids: z.array(z.string()).default([]),
    shared_spaces: sharedSpacesSchema.optional(),
    amenities: amenitiesStructuredSchema.optional(),
    policies: policiesSchema.optional(),
    fees: feesSchema,
    house_rules_text: z.string().optional(),
    checkin_instructions: z.string().optional(),
    locale: z.string().optional(),
  })
  .passthrough(); // Allow extra fields from heterogeneous payloads

export type BookingListingInput = z.infer<typeof bookingListingInputSchema>;
