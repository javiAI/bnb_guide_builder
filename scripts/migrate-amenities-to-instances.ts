/**
 * migrate-amenities-to-instances.ts
 *
 * Phase 2 / Branch 2A backfill (see docs/MASTER_PLAN.md).
 *
 * Backfills every existing `PropertyAmenity` row into the new
 * `PropertyAmenityInstance` (+ optional `PropertyAmenityPlacement`) model.
 *
 * Mapping rules:
 *   - instanceKey = spaceId ? `space:${spaceId}` : "default"
 *   - all scalar fields (subtypeKey, detailsJson, *Instructions, *Notes,
 *     visibility) copy 1:1
 *   - if the source row has a spaceId, a `PropertyAmenityPlacement` is
 *     created linking the new instance to that space
 *
 * Idempotent: running twice produces the same DB state. The upsert is
 * keyed on (propertyId, amenityKey, instanceKey) which is the unique
 * index on `PropertyAmenityInstance`.
 *
 * The original `PropertyAmenity` rows are left untouched — this script
 * only forward-fills the new model during the dual-write window.
 * Cleanup of the old table happens in Branch 2C.
 *
 * Usage:
 *   /Users/javierabrilibanez/.nvm/versions/node/v18.20.5/bin/npx tsx \
 *     scripts/migrate-amenities-to-instances.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function instanceKeyFor(spaceId: string | null): string {
  return spaceId ? `space:${spaceId}` : "default";
}

async function main() {
  const legacy = await prisma.propertyAmenity.findMany({
    orderBy: [{ propertyId: "asc" }, { amenityKey: "asc" }, { createdAt: "asc" }],
  });

  let instancesWritten = 0;
  let placementsWritten = 0;

  for (const row of legacy) {
    const instanceKey = instanceKeyFor(row.spaceId);

    const instance = await prisma.propertyAmenityInstance.upsert({
      where: {
        propertyId_amenityKey_instanceKey: {
          propertyId: row.propertyId,
          amenityKey: row.amenityKey,
          instanceKey,
        },
      },
      create: {
        propertyId: row.propertyId,
        amenityKey: row.amenityKey,
        instanceKey,
        subtypeKey: row.subtypeKey,
        detailsJson: row.detailsJson ?? undefined,
        guestInstructions: row.guestInstructions,
        aiInstructions: row.aiInstructions,
        internalNotes: row.internalNotes,
        troubleshootingNotes: row.troubleshootingNotes,
        visibility: row.visibility,
      },
      update: {
        subtypeKey: row.subtypeKey,
        detailsJson: row.detailsJson ?? undefined,
        guestInstructions: row.guestInstructions,
        aiInstructions: row.aiInstructions,
        internalNotes: row.internalNotes,
        troubleshootingNotes: row.troubleshootingNotes,
        visibility: row.visibility,
      },
    });
    instancesWritten += 1;

    if (row.spaceId) {
      await prisma.propertyAmenityPlacement.upsert({
        where: {
          amenityId_spaceId: { amenityId: instance.id, spaceId: row.spaceId },
        },
        create: { amenityId: instance.id, spaceId: row.spaceId },
        update: {},
      });
      placementsWritten += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[migrate-amenities-to-instances] legacy=${legacy.length} instances=${instancesWritten} placements=${placementsWritten}`,
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
