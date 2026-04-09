import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: spaces within a property.
 */
export const spaceRepository = {
  findByProperty(propertyId: string) {
    return prisma.space.findMany({
      where: { propertyId },
      orderBy: { sortOrder: "asc" },
    });
  },

  findById(id: string) {
    return prisma.space.findUnique({ where: { id } });
  },

  create(data: Prisma.SpaceCreateInput) {
    return prisma.space.create({ data });
  },

  update(id: string, data: Prisma.SpaceUpdateInput) {
    return prisma.space.update({ where: { id }, data });
  },
};
