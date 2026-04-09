import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: property identity, basics, arrival, and capacity.
 */
export const propertyRepository = {
  findById(id: string) {
    return prisma.property.findUnique({ where: { id } });
  },

  findByWorkspace(workspaceId: string) {
    return prisma.property.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  },

  create(data: Prisma.PropertyCreateInput) {
    return prisma.property.create({ data });
  },

  update(id: string, data: Prisma.PropertyUpdateInput) {
    return prisma.property.update({ where: { id }, data });
  },

  archive(id: string) {
    return prisma.property.update({
      where: { id },
      data: { status: "archived" },
    });
  },
};
