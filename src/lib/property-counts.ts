import type { Prisma } from "@prisma/client";
import { bedTypes } from "@/lib/taxonomy-loader";

/**
 * Computes sleeping capacity for a bed type and quantity.
 * Uses the `sleepingCapacity` field from bed_types.json.
 * Custom beds use configJson.customCapacity, defaulting to 1.
 */
export function getBedSleepingCapacity(
  bedType: string,
  quantity: number,
  configJson?: Record<string, unknown> | null,
): number {
  if (bedType === "bt.other") {
    const custom = typeof configJson?.customCapacity === "number" ? configJson.customCapacity : 1;
    return custom * quantity;
  }
  const item = (bedTypes.items as Array<{ id: string; sleepingCapacity?: number }>).find(
    (b) => b.id === bedType,
  );
  return (item?.sleepingCapacity ?? 1) * quantity;
}

/**
 * Recomputes bedroomsCount, bathroomsCount, and bedsCount from actual Space/Bed
 * rows and writes them back to the Property. Must be called with a transaction
 * client so the mutation and recompute are atomic.
 */
export async function recomputePropertyCounts(
  tx: Prisma.TransactionClient,
  propertyId: string,
): Promise<void> {
  const spaces = await tx.space.findMany({
    where: { propertyId },
    select: {
      spaceType: true,
      beds: { select: { quantity: true } },
    },
  });

  const bedroomsCount = spaces.filter((s) => s.spaceType === "sp.bedroom").length;
  const bathroomsCount = spaces.filter((s) => s.spaceType === "sp.bathroom").length;
  const bedsCount = spaces.reduce(
    (sum, s) => sum + s.beds.reduce((bsum, b) => bsum + b.quantity, 0),
    0,
  );

  await tx.property.update({
    where: { id: propertyId },
    data: { bedroomsCount, bathroomsCount, bedsCount },
  });
}
