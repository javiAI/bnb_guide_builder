import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: guide versions, sections, and section items.
 */
export const guideRepository = {
  findVersionsByProperty(propertyId: string) {
    return prisma.guideVersion.findMany({
      where: { propertyId },
      orderBy: { version: "desc" },
    });
  },

  findVersionById(id: string) {
    return prisma.guideVersion.findUnique({
      where: { id },
      include: { sections: { include: { items: true }, orderBy: { sortOrder: "asc" } } },
    });
  },

  createVersion(data: Prisma.GuideVersionCreateInput) {
    return prisma.guideVersion.create({ data });
  },

  updateVersion(id: string, data: Prisma.GuideVersionUpdateInput) {
    return prisma.guideVersion.update({ where: { id }, data });
  },

  createSection(data: Prisma.GuideSectionCreateInput) {
    return prisma.guideSection.create({ data });
  },

  updateSection(id: string, data: Prisma.GuideSectionUpdateInput) {
    return prisma.guideSection.update({ where: { id }, data });
  },

  createSectionItem(data: Prisma.GuideSectionItemCreateInput) {
    return prisma.guideSectionItem.create({ data });
  },

  updateSectionItem(id: string, data: Prisma.GuideSectionItemUpdateInput) {
    return prisma.guideSectionItem.update({ where: { id }, data });
  },
};
