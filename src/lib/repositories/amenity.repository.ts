import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: amenities for a property.
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
