import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: message templates and automations.
 */
export const messagingRepository = {
  findTemplatesByProperty(propertyId: string) {
    return prisma.messageTemplate.findMany({
      where: { propertyId },
      orderBy: { touchpointKey: "asc" },
    });
  },

  findTemplateById(id: string) {
    return prisma.messageTemplate.findUnique({
      where: { id },
      include: { automations: true },
    });
  },

  createTemplate(data: Prisma.MessageTemplateCreateInput) {
    return prisma.messageTemplate.create({ data });
  },

  updateTemplate(id: string, data: Prisma.MessageTemplateUpdateInput) {
    return prisma.messageTemplate.update({ where: { id }, data });
  },

  findAutomationsByProperty(propertyId: string) {
    return prisma.messageAutomation.findMany({
      where: { propertyId },
      include: { template: true },
    });
  },

  createAutomation(data: Prisma.MessageAutomationCreateInput) {
    return prisma.messageAutomation.create({ data });
  },

  updateAutomation(id: string, data: Prisma.MessageAutomationUpdateInput) {
    return prisma.messageAutomation.update({ where: { id }, data });
  },
};
