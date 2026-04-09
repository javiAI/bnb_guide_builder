import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: troubleshooting playbooks.
 */
export const troubleshootingRepository = {
  findByProperty(propertyId: string) {
    return prisma.troubleshootingPlaybook.findMany({
      where: { propertyId },
      orderBy: { playbookKey: "asc" },
    });
  },

  findById(id: string) {
    return prisma.troubleshootingPlaybook.findUnique({ where: { id } });
  },

  create(data: Prisma.TroubleshootingPlaybookCreateInput) {
    return prisma.troubleshootingPlaybook.create({ data });
  },

  update(id: string, data: Prisma.TroubleshootingPlaybookUpdateInput) {
    return prisma.troubleshootingPlaybook.update({ where: { id }, data });
  },
};
