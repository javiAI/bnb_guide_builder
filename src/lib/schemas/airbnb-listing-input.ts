import { z } from "zod";
import {
  accessibilityFeaturesSchema,
  sharedSpacesSchema,
  amenitiesStructuredSchema,
  listingPoliciesSchema,
} from "./airbnb-listing-shared";

/**
 * Airbnb listing payload — INPUT schema (Rama 14D, preview-only).
 *
 * Separado del output schema (`airbnb-listing.ts`, 14B) porque:
 * - Input y output tienen responsabilidades distintas: input valida lo que
 *   nos pegan; output valida lo que emitimos. Acoplarlos obligaría a
 *   ampliar el contrato outbound para aceptar campos que solo importamos.
 * - Input es superset: incluye `pricing.*` (omitido siempre en export por
 *   falta de `currency` en Property) porque el reconciler marca esos valores
 *   como `unactionable` con reason `requires_currency_decision` — pero solo
 *   si llegan.
 *
 * Mantenemos `.strict()` — unknown keys lanzan parse error, lo que fuerza al
 * host a pegar un payload limpio y evita que campos nuevos pasen en silencio.
 */

const pricingInputSchema = z
  .object({
    cleaning_fee: z.number().finite().optional(),
    extra_person_fee: z.number().finite().optional(),
    currency: z.string().min(1).optional(),
  })
  .strict();

export const airbnbListingInputSchema = z
  .object({
    property_type_category: z.string().min(1).optional(),
    person_capacity: z.number().int().min(1).optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    check_in_method: z.string().min(1).optional(),
    amenity_ids: z.array(z.string().min(1)).optional(),
    shared_spaces: sharedSpacesSchema.optional(),
    amenities: amenitiesStructuredSchema.optional(),
    accessibility_features: accessibilityFeaturesSchema.optional(),
    listing_policies: listingPoliciesSchema.optional(),
    pricing: pricingInputSchema.optional(),
    house_rules: z.string().optional(),
    locale: z.string().min(1).optional(),
  })
  .strict();

export type AirbnbListingInput = z.infer<typeof airbnbListingInputSchema>;
