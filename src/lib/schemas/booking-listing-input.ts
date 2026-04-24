import { z } from "zod";

/**
 * Input schema for Booking.com listing preview import (Rama 14E).
 *
 * This schema is a SUPERSET that accepts heterogeneous Booking.com payloads:
 * - Exports from our system (14C pipeline)
 * - Real/raw payloads pasted manually by users (from Booking API, spreadsheets, etc.)
 * - Partial or malformed payloads
 *
 * Strategy: `.passthrough()` at top level allows extra fields without failing;
 * we validate only the fields we care about. Sub-objects (policies, shared_spaces, etc.)
 * that are known remain `.strict()` to catch schema mismatches early.
 *
 * Divergences from Booking export schema (14C):
 * - Input accepts extra fields (Booking API may include metadata, locale, etc.)
 * - Policies, shared_spaces, amenities remain strict within their known shapes
 * - Empty/malformed sub-objects are allowed to pass, warnings emit later in parser
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
