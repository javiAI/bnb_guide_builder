import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: knowledge sources, items, and citations.
 */
export const knowledgeRepository = {
  findItemsByProperty(propertyId: string, visibility?: string) {
    return prisma.knowledgeItem.findMany({
      where: {
        propertyId,
        ...(visibility ? { visibility } : {}),
      },
      orderBy: { topic: "asc" },
    });
  },

  findItemById(id: string) {
    return prisma.knowledgeItem.findUnique({
      where: { id },
      include: { citations: true, source: true },
    });
  },

  createItem(data: Prisma.KnowledgeItemCreateInput) {
    return prisma.knowledgeItem.create({ data });
  },

  updateItem(id: string, data: Prisma.KnowledgeItemUpdateInput) {
    return prisma.knowledgeItem.update({ where: { id }, data });
  },

  findSources(propertyId: string) {
    return prisma.knowledgeSource.findMany({
      where: { propertyId },
    });
  },

  createSource(data: Prisma.KnowledgeSourceCreateInput) {
    return prisma.knowledgeSource.create({ data });
  },
};
