import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: wizard sessions and raw responses (capture layer).
 */
export const wizardRepository = {
  findSessionByProperty(propertyId: string) {
    return prisma.wizardSession.findFirst({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
      include: { responses: true },
    });
  },

  findSessionById(id: string) {
    return prisma.wizardSession.findUnique({
      where: { id },
      include: { responses: true },
    });
  },

  createSession(data: Prisma.WizardSessionCreateInput) {
    return prisma.wizardSession.create({ data });
  },

  updateSession(id: string, data: Prisma.WizardSessionUpdateInput) {
    return prisma.wizardSession.update({ where: { id }, data });
  },

  upsertResponse(
    wizardSessionId: string,
    stepNumber: number,
    fieldKey: string,
    valueJson: Prisma.InputJsonValue,
  ) {
    return prisma.wizardResponse.upsert({
      where: {
        id: `${wizardSessionId}_${stepNumber}_${fieldKey}`,
      },
      create: {
        wizardSession: { connect: { id: wizardSessionId } },
        stepNumber,
        fieldKey,
        valueJson,
      },
      update: { valueJson },
    });
  },

  createResponse(data: Prisma.WizardResponseCreateInput) {
    return prisma.wizardResponse.create({ data });
  },
};
