import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Write owner: amenity instances (+ placements) for a property.
 *
 * See docs/MASTER_PLAN.md Phase 2. Dual-write window is active: callers
 * may still use `amenityRepository` against the legacy `PropertyAmenity`
 * table. Cutover happens in Branch 2C.
 */
export const amenityInstanceRepository = {
  findByProperty(propertyId: string) {
    return prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      orderBy: [{ amenityKey: "asc" }, { instanceKey: "asc" }],
      include: { placements: true },
    });
  },

  findById(id: string) {
    return prisma.propertyAmenityInstance.findUnique({
      where: { id },
      include: { placements: true },
    });
  },

  create(data: Prisma.PropertyAmenityInstanceCreateInput) {
    return prisma.propertyAmenityInstance.create({ data });
  },

  update(id: string, data: Prisma.PropertyAmenityInstanceUpdateInput) {
    return prisma.propertyAmenityInstance.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.propertyAmenityInstance.delete({ where: { id } });
  },

  addPlacement(amenityId: string, spaceId: string, note?: string | null) {
    return prisma.propertyAmenityPlacement.upsert({
      where: { amenityId_spaceId: { amenityId, spaceId } },
      create: { amenityId, spaceId, note: note ?? null },
      // Only touch `note` when caller passed one explicitly — omitting it
      // preserves any existing note instead of clearing it.
      update: note !== undefined ? { note } : {},
    });
  },

  removePlacement(amenityId: string, spaceId: string) {
    return prisma.propertyAmenityPlacement.deleteMany({
      where: { amenityId, spaceId },
    });
  },

  /** Total instance count for a property (post-cutover read for publishing/analytics). */
  countByProperty(propertyId: string) {
    return prisma.propertyAmenityInstance.count({ where: { propertyId } });
  },

  /** Distinct amenityKeys for a property — used by the conditional engine context. */
  async findKeysByProperty(propertyId: string): Promise<string[]> {
    const rows = await prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: { amenityKey: true },
      distinct: ["amenityKey"],
    });
    return rows.map((r) => r.amenityKey);
  },
};
