import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: ops checklist, stock, and maintenance.
 */
export const opsRepository = {
  // Checklist
  findChecklist(propertyId: string) {
    return prisma.opsChecklistItem.findMany({
      where: { propertyId },
      orderBy: { sortOrder: "asc" },
    });
  },

  createChecklistItem(data: Prisma.OpsChecklistItemCreateInput) {
    return prisma.opsChecklistItem.create({ data });
  },

  updateChecklistItem(id: string, data: Prisma.OpsChecklistItemUpdateInput) {
    return prisma.opsChecklistItem.update({ where: { id }, data });
  },

  // Stock
  findStock(propertyId: string) {
    return prisma.stockItem.findMany({
      where: { propertyId },
      orderBy: { name: "asc" },
    });
  },

  createStockItem(data: Prisma.StockItemCreateInput) {
    return prisma.stockItem.create({ data });
  },

  updateStockItem(id: string, data: Prisma.StockItemUpdateInput) {
    return prisma.stockItem.update({ where: { id }, data });
  },

  // Maintenance
  findMaintenance(propertyId: string) {
    return prisma.maintenanceTask.findMany({
      where: { propertyId },
      orderBy: { nextDueAt: "asc" },
    });
  },

  createMaintenanceTask(data: Prisma.MaintenanceTaskCreateInput) {
    return prisma.maintenanceTask.create({ data });
  },

  updateMaintenanceTask(id: string, data: Prisma.MaintenanceTaskUpdateInput) {
    return prisma.maintenanceTask.update({ where: { id }, data });
  },
};
