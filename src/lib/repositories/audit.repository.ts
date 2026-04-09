import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: audit log (append-only).
 */
export const auditRepository = {
  findByProperty(propertyId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { propertyId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  findByEntity(propertyId: string, entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { propertyId, entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
  },

  create(data: Prisma.AuditLogCreateInput) {
    return prisma.auditLog.create({ data });
  },
};
