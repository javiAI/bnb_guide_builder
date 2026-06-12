import type { Prisma } from "@prisma/client";

// Capacity rule lives with the bed-types taxonomy (client-safe module).
export { getBedSleepingCapacity } from "@/lib/taxonomies/bed-types";

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
    where: { propertyId, status: "active" },
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
