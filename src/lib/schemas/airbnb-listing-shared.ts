import { z } from "zod";

/**
 * Shared sub-schemas extracted from airbnb-listing-input.ts (import).
 * Defined once to prevent drift between import and export schemas once export also adopts them.
 */

export const accessibilityFeaturesSchema = z
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

export const sharedSpacesSchema = z
  .object({
    kitchen: z.boolean().optional(),
    living_room: z.boolean().optional(),
    dining: z.boolean().optional(),
  })
  .strict();

export const amenitiesStructuredSchema = z
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

export const listingPoliciesSchema = z
  .object({
    smoking_allowed: z.string().optional(),
    events_allowed: z.boolean().optional(),
    pets_allowed: z.boolean().optional(),
    commercial_photography_allowed: z.boolean().optional(),
  })
  .strict();
