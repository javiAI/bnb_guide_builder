import { z } from "zod";

/** Shared rate-tier shape persisted on `LocalPlace.rateJson` (and any future
 * paid-option columns). Parking pins use it for free/paid classification;
 * arrival options reuse it for tolls and paid ferries. Capping at 10 tiers
 * keeps the JSON column small and matches the editor UI. */
export const rateTierSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.string().min(1).max(8),
    per: z.enum(["minute", "hour", "day", "week", "month"]),
    note: z.string().max(200).optional(),
  })
  .strict();

export const rateJsonSchema = z.array(rateTierSchema).max(10);

export type RateTier = z.infer<typeof rateTierSchema>;
