/**
 * amenity-dual-write.ts — Phase 2 / Branch 2B helpers.
 *
 * During the dual-write window every mutation on the legacy
 * `PropertyAmenity` model must be mirrored onto the new
 * `PropertyAmenityInstance` (+ optional `PropertyAmenityPlacement`)
 * model, and vice-versa. Reads still go to the legacy model; the
 * cutover happens in Branch 2C.
 *
 * Instance-key convention (matches backfill script):
 *   - spaceId = null  → instanceKey = "default"
 *   - spaceId = "cuid" → instanceKey = "space:cuid"
 *
 * Callers should pass a Prisma `tx` client when running inside a
 * `$transaction`; otherwise these helpers use the singleton.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

type Tx = PrismaClient | Prisma.TransactionClient;

export function instanceKeyFor(spaceId: string | null): string {
  return spaceId ? `space:${spaceId}` : "default";
}

export function spaceIdFromInstanceKey(instanceKey: string): string | null {
  if (instanceKey === "default") return null;
  if (instanceKey.startsWith("space:")) return instanceKey.slice("space:".length);
  return null;
}

/** OLD → NEW: mirror a toggle-enable (create). Idempotent via upsert. */
export async function mirrorEnableToNew(
  args: {
    propertyId: string;
    amenityKey: string;
    spaceId: string | null;
    subtypeKey?: string | null;
    visibility?: string;
    guestInstructions?: string | null;
    aiInstructions?: string | null;
    internalNotes?: string | null;
    troubleshootingNotes?: string | null;
  },
  tx: Tx = defaultPrisma,
): Promise<void> {
  const instanceKey = instanceKeyFor(args.spaceId);
  const instance = await tx.propertyAmenityInstance.upsert({
    where: {
      propertyId_amenityKey_instanceKey: {
        propertyId: args.propertyId,
        amenityKey: args.amenityKey,
        instanceKey,
      },
    },
    create: {
      propertyId: args.propertyId,
      amenityKey: args.amenityKey,
      instanceKey,
      subtypeKey: args.subtypeKey ?? null,
      visibility: args.visibility ?? "public",
      guestInstructions: args.guestInstructions ?? null,
      aiInstructions: args.aiInstructions ?? null,
      internalNotes: args.internalNotes ?? null,
      troubleshootingNotes: args.troubleshootingNotes ?? null,
    },
    update: {},
  });
  if (args.spaceId) {
    await tx.propertyAmenityPlacement.upsert({
      where: { amenityId_spaceId: { amenityId: instance.id, spaceId: args.spaceId } },
      create: { amenityId: instance.id, spaceId: args.spaceId },
      update: {},
    });
  }
}

/** OLD → NEW: mirror a toggle-disable (deleteMany). */
export async function mirrorDisableToNew(
  args: { propertyId: string; amenityKey: string; spaceId: string | null },
  tx: Tx = defaultPrisma,
): Promise<void> {
  const instanceKey = instanceKeyFor(args.spaceId);
  // deleteMany cascades to placements via FK.
  await tx.propertyAmenityInstance.deleteMany({
    where: {
      propertyId: args.propertyId,
      amenityKey: args.amenityKey,
      instanceKey,
    },
  });
}

type AmenityUpdateData = {
  subtypeKey?: string | null;
  detailsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  guestInstructions?: string | null;
  aiInstructions?: string | null;
  internalNotes?: string | null;
  troubleshootingNotes?: string | null;
  visibility?: string;
};

/** OLD → NEW: mirror an update. Looks up matching Instance via composite key. */
export async function mirrorUpdateToNew(
  args: {
    propertyId: string;
    amenityKey: string;
    spaceId: string | null;
    data: AmenityUpdateData;
  },
  tx: Tx = defaultPrisma,
): Promise<void> {
  const instanceKey = instanceKeyFor(args.spaceId);
  await tx.propertyAmenityInstance.updateMany({
    where: {
      propertyId: args.propertyId,
      amenityKey: args.amenityKey,
      instanceKey,
    },
    data: args.data,
  });
}

/** NEW → OLD: mirror create/update of an Instance onto PropertyAmenity. */
export async function mirrorInstanceToOld(
  instance: {
    id: string;
    propertyId: string;
    amenityKey: string;
    instanceKey: string;
    subtypeKey: string | null;
    detailsJson: Prisma.JsonValue | null;
    guestInstructions: string | null;
    aiInstructions: string | null;
    internalNotes: string | null;
    troubleshootingNotes: string | null;
    visibility: string;
  },
  tx: Tx = defaultPrisma,
): Promise<void> {
  const spaceId = spaceIdFromInstanceKey(instance.instanceKey);
  // Custom (non-canonical) instanceKeys have no 1:1 mirror target in the
  // old model — skip. Legacy reads will simply not see such rows; this
  // is acceptable because reads still come from the old model and new
  // actions aren't yet wired to UI.
  if (instance.instanceKey !== "default" && !instance.instanceKey.startsWith("space:")) {
    return;
  }

  const existing = await tx.propertyAmenity.findFirst({
    where: { propertyId: instance.propertyId, amenityKey: instance.amenityKey, spaceId },
    select: { id: true },
  });

  const writeData = {
    subtypeKey: instance.subtypeKey,
    detailsJson: instance.detailsJson === null ? Prisma.DbNull : (instance.detailsJson as Prisma.InputJsonValue),
    guestInstructions: instance.guestInstructions,
    aiInstructions: instance.aiInstructions,
    internalNotes: instance.internalNotes,
    troubleshootingNotes: instance.troubleshootingNotes,
    visibility: instance.visibility,
  };

  if (existing) {
    await tx.propertyAmenity.update({ where: { id: existing.id }, data: writeData });
  } else {
    await tx.propertyAmenity.create({
      data: {
        ...writeData,
        amenityKey: instance.amenityKey,
        property: { connect: { id: instance.propertyId } },
        ...(spaceId ? { space: { connect: { id: spaceId } } } : {}),
      },
    });
  }
}

/** NEW → OLD: mirror delete of an Instance. */
export async function mirrorInstanceDeleteToOld(
  args: { propertyId: string; amenityKey: string; instanceKey: string },
  tx: Tx = defaultPrisma,
): Promise<void> {
  if (args.instanceKey !== "default" && !args.instanceKey.startsWith("space:")) return;
  const spaceId = spaceIdFromInstanceKey(args.instanceKey);
  await tx.propertyAmenity.deleteMany({
    where: { propertyId: args.propertyId, amenityKey: args.amenityKey, spaceId },
  });
}

/** NEW → OLD: mirror adding a placement (ensure PropertyAmenity row for that space). */
export async function mirrorPlacementAddToOld(
  args: { propertyId: string; amenityKey: string; spaceId: string },
  tx: Tx = defaultPrisma,
): Promise<void> {
  const existing = await tx.propertyAmenity.findFirst({
    where: { propertyId: args.propertyId, amenityKey: args.amenityKey, spaceId: args.spaceId },
    select: { id: true },
  });
  if (existing) return;
  try {
    await tx.propertyAmenity.create({
      data: {
        amenityKey: args.amenityKey,
        property: { connect: { id: args.propertyId } },
        space: { connect: { id: args.spaceId } },
      },
    });
  } catch (err) {
    // P2002 from concurrent writer — safe to ignore, row already exists.
    if ((err as { code?: string }).code !== "P2002") throw err;
  }
}

/** NEW → OLD: mirror removing a placement. */
export async function mirrorPlacementRemoveFromOld(
  args: { propertyId: string; amenityKey: string; spaceId: string },
  tx: Tx = defaultPrisma,
): Promise<void> {
  await tx.propertyAmenity.deleteMany({
    where: { propertyId: args.propertyId, amenityKey: args.amenityKey, spaceId: args.spaceId },
  });
}
