import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: amenities for a property.
 *
 * @deprecated Phase 2 / Branch 2C — reads have cut over to
 * `amenityInstanceRepository` (see `src/lib/repositories/amenity-instance.repository.ts`).
 * The `PropertyAmenity` table is kept behind the dual-write window so legacy
 * consumers still see a coherent view; new code should target the instance
 * model. Writes from here still fan into the new model via
 * `@/lib/amenity-dual-write`. This module will be removed in the drop-legacy
 * phase.
 */
export const amenityRepository = {
  findByProperty(propertyId: string) {
    return prisma.propertyAmenity.findMany({
      where: { propertyId },
      orderBy: { amenityKey: "asc" },
    });
  },

  findById(id: string) {
    return prisma.propertyAmenity.findUnique({ where: { id } });
  },

  create(data: Prisma.PropertyAmenityCreateInput) {
    return prisma.propertyAmenity.create({ data });
  },

  update(id: string, data: Prisma.PropertyAmenityUpdateInput) {
    return prisma.propertyAmenity.update({ where: { id }, data });
  },

  upsertByKey(propertyId: string, amenityKey: string, data: Omit<Prisma.PropertyAmenityCreateInput, "property" | "amenityKey">) {
    return prisma.propertyAmenity.upsert({
      where: {
        id: `${propertyId}_${amenityKey}`,
      },
      create: {
        ...data,
        amenityKey,
        property: { connect: { id: propertyId } },
      },
      update: data,
    });
  },
};
