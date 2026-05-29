import { z } from "zod";

/** Allowed cadences for a single rate tier. The tuple form is required by
 * `z.enum`; the `RATE_TIER_PERS` set is what consumers use to validate an
 * untyped string at runtime (`.has(...)`). */
const RATE_TIER_PERS_TUPLE = ["minute", "hour", "day", "week", "month"] as const;
export type RateTierPer = (typeof RATE_TIER_PERS_TUPLE)[number];
export const RATE_TIER_PERS: ReadonlySet<RateTierPer> = new Set(RATE_TIER_PERS_TUPLE);

/** Shared rate-tier shape persisted on `LocalPlace.rateJson` (and any future
 * paid-option columns). Parking pins use it for free/paid classification;
 * arrival options reuse it for tolls and paid ferries. Capping at 10 tiers
 * keeps the JSON column small and matches the editor UI. */
export const rateTierSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.string().min(1).max(8),
    per: z.enum(RATE_TIER_PERS_TUPLE),
    note: z.string().max(200).optional(),
  })
  .strict();

export const rateJsonSchema = z.array(rateTierSchema).max(10);

export type RateTier = z.infer<typeof rateTierSchema>;
