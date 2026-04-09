import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: media assets and assignments.
 */
export const mediaRepository = {
  findAssetsByProperty(propertyId: string) {
    return prisma.mediaAsset.findMany({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
    });
  },

  findAssetById(id: string) {
    return prisma.mediaAsset.findUnique({
      where: { id },
      include: { assignments: true },
    });
  },

  createAsset(data: Prisma.MediaAssetCreateInput) {
    return prisma.mediaAsset.create({ data });
  },

  updateAsset(id: string, data: Prisma.MediaAssetUpdateInput) {
    return prisma.mediaAsset.update({ where: { id }, data });
  },

  createAssignment(data: Prisma.MediaAssignmentCreateInput) {
    return prisma.mediaAssignment.create({ data });
  },

  findAssignments(entityType: string, entityId: string) {
    return prisma.mediaAssignment.findMany({
      where: { entityType, entityId },
      include: { mediaAsset: true },
      orderBy: { sortOrder: "asc" },
    });
  },
};
