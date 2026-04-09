import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: local place recommendations.
 */
export const localPlaceRepository = {
  findByProperty(propertyId: string) {
    return prisma.localPlace.findMany({
      where: { propertyId },
      orderBy: { categoryKey: "asc" },
    });
  },

  findById(id: string) {
    return prisma.localPlace.findUnique({ where: { id } });
  },

  create(data: Prisma.LocalPlaceCreateInput) {
    return prisma.localPlace.create({ data });
  },

  update(id: string, data: Prisma.LocalPlaceUpdateInput) {
    return prisma.localPlace.update({ where: { id }, data });
  },
};
