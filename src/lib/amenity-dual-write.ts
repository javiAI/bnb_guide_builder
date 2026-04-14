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
import {
  instanceKeyFor,
  spaceIdFromInstanceKey,
  isCanonicalInstanceKey,
} from "@/lib/amenity-instance-keys";

export { instanceKeyFor, spaceIdFromInstanceKey } from "@/lib/amenity-instance-keys";

type Tx = PrismaClient | Prisma.TransactionClient;

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
  // Custom (non-canonical) instanceKeys have no direct 1:1 mirror target
  // in the old model, so skip mirroring the instance payload here. Note
  // this does NOT make them fully invisible to legacy reads: placement
  // mirroring (mirrorPlacementAddToOld) is also gated on
  // isCanonicalInstanceKey at the action layer, so neither the instance
  // row nor its placements produce legacy rows while the instanceKey is
  // non-canonical. New actions are not yet wired to the UI.
  if (!isCanonicalInstanceKey(instance.instanceKey)) return;
  const spaceId = spaceIdFromInstanceKey(instance.instanceKey);

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
    return;
  }
  // Concurrency note: if a concurrent writer creates the same composite
  // key between our findFirst and create, we get P2002. The whole tx
  // (new-model write + this mirror) rolls back. That's safe because
  // every dual-write path also mirrors, so the concurrent winner has
  // already produced both sides. Recovering in-place is not possible —
  // Prisma interactive transactions don't use savepoints, so a PG
  // constraint violation aborts the tx.
  await tx.propertyAmenity.create({
    data: {
      ...writeData,
      amenityKey: instance.amenityKey,
      property: { connect: { id: instance.propertyId } },
      ...(spaceId ? { space: { connect: { id: spaceId } } } : {}),
    },
  });
}

/** NEW → OLD: mirror delete of an Instance. */
export async function mirrorInstanceDeleteToOld(
  args: { propertyId: string; amenityKey: string; instanceKey: string },
  tx: Tx = defaultPrisma,
): Promise<void> {
  if (!isCanonicalInstanceKey(args.instanceKey)) return;
  const spaceId = spaceIdFromInstanceKey(args.instanceKey);
  await tx.propertyAmenity.deleteMany({
    where: { propertyId: args.propertyId, amenityKey: args.amenityKey, spaceId },
  });
}

/** NEW → OLD: mirror adding a placement (ensure PropertyAmenity row for that space).
 *
 * Copies instance-level scalar fields (subtypeKey, detailsJson, instructions,
 * visibility) into the new legacy row so legacy reads during the dual-write
 * window see the same configuration as the new model. The source instance is
 * the canonical "space:<spaceId>" one for this placement. */
export async function mirrorPlacementAddToOld(
  args: { propertyId: string; amenityKey: string; spaceId: string },
  tx: Tx = defaultPrisma,
): Promise<void> {
  const existing = await tx.propertyAmenity.findFirst({
    where: { propertyId: args.propertyId, amenityKey: args.amenityKey, spaceId: args.spaceId },
    select: { id: true },
  });
  if (existing) return;

  const instance = await tx.propertyAmenityInstance.findUnique({
    where: {
      propertyId_amenityKey_instanceKey: {
        propertyId: args.propertyId,
        amenityKey: args.amenityKey,
        instanceKey: instanceKeyFor(args.spaceId),
      },
    },
    select: {
      subtypeKey: true,
      detailsJson: true,
      guestInstructions: true,
      aiInstructions: true,
      internalNotes: true,
      troubleshootingNotes: true,
      visibility: true,
    },
  });

  const scalarData = instance
    ? {
        subtypeKey: instance.subtypeKey,
        detailsJson:
          instance.detailsJson === null ? Prisma.DbNull : (instance.detailsJson as Prisma.InputJsonValue),
        guestInstructions: instance.guestInstructions,
        aiInstructions: instance.aiInstructions,
        internalNotes: instance.internalNotes,
        troubleshootingNotes: instance.troubleshootingNotes,
        visibility: instance.visibility,
      }
    : {};

  // Concurrency: see mirrorInstanceToOld — P2002 aborts the tx and the
  // whole operation rolls back. Safe under the dual-write invariant
  // (concurrent winner also mirrors).
  await tx.propertyAmenity.create({
    data: {
      ...scalarData,
      amenityKey: args.amenityKey,
      property: { connect: { id: args.propertyId } },
      space: { connect: { id: args.spaceId } },
    },
  });
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
