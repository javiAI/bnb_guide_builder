import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: guide versions (snapshot-based, 9C).
 * GuideSection/GuideSectionItem tables removed — treeJson is the single source.
 */
export const guideRepository = {
  findVersionsByProperty(propertyId: string) {
    return prisma.guideVersion.findMany({
      where: { propertyId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        status: true,
        publishedAt: true,
        createdAt: true,
      },
    });
  },

  findVersionById(id: string) {
    return prisma.guideVersion.findUnique({
      where: { id },
    });
  },

  findPublishedVersion(propertyId: string) {
    return prisma.guideVersion.findFirst({
      where: { propertyId, status: "published" },
      orderBy: { version: "desc" },
    });
  },

  findLatestVersion(propertyId: string) {
    return prisma.guideVersion.findFirst({
      where: { propertyId },
      orderBy: { version: "desc" },
    });
  },

  createVersion(data: Prisma.GuideVersionCreateInput) {
    return prisma.guideVersion.create({ data });
  },

  updateVersion(id: string, data: Prisma.GuideVersionUpdateInput) {
    return prisma.guideVersion.update({ where: { id }, data });
  },
};
