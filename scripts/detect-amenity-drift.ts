/**
 * detect-amenity-drift.ts — Phase 2 / Branch 2B.
 *
 * Compares the legacy `PropertyAmenity` model against the new
 * `PropertyAmenityInstance` (+ `PropertyAmenityPlacement`) model and
 * reports any divergence. Dual-write keeps them in sync at mutation
 * time; this script is the invariant check.
 *
 * Exit code 0 = no drift. Exit code 1 = drift detected.
 *
 * Usage:
 *   npm run detect-amenity-drift
 *   # or
 *   npx tsx scripts/detect-amenity-drift.ts
 */

import { PrismaClient } from "@prisma/client";
import { instanceKeyFor, spaceIdFromInstanceKey } from "../src/lib/amenity-dual-write";

const prisma = new PrismaClient();

type Drift = { kind: string; detail: string };

async function main() {
  const legacy = await prisma.propertyAmenity.findMany();
  const instances = await prisma.propertyAmenityInstance.findMany({ include: { placements: true } });

  const drifts: Drift[] = [];

  // 1. Every legacy row must have a corresponding Instance (+ Placement if spaceId).
  for (const row of legacy) {
    const expectedKey = instanceKeyFor(row.spaceId);
    const match = instances.find(
      (i) => i.propertyId === row.propertyId && i.amenityKey === row.amenityKey && i.instanceKey === expectedKey,
    );
    if (!match) {
      drifts.push({
        kind: "missing_instance",
        detail: `legacy(${row.id}) propertyId=${row.propertyId} amenityKey=${row.amenityKey} spaceId=${row.spaceId ?? "null"} has no Instance`,
      });
      continue;
    }
    if (row.spaceId) {
      const hasPlacement = match.placements.some((p) => p.spaceId === row.spaceId);
      if (!hasPlacement) {
        drifts.push({
          kind: "missing_placement",
          detail: `legacy(${row.id}) spaceId=${row.spaceId} has no Placement on Instance(${match.id})`,
        });
      }
    }
  }

  // 2. Every Instance (with canonical instanceKey) must have a corresponding
  //    legacy PropertyAmenity. Custom instanceKeys are excluded — see
  //    amenity-dual-write.ts comment.
  for (const instance of instances) {
    const isCanonical =
      instance.instanceKey === "default" || instance.instanceKey.startsWith("space:");
    if (!isCanonical) continue;
    const spaceId = spaceIdFromInstanceKey(instance.instanceKey);
    const match = legacy.find(
      (r) => r.propertyId === instance.propertyId && r.amenityKey === instance.amenityKey && r.spaceId === spaceId,
    );
    if (!match) {
      drifts.push({
        kind: "missing_legacy",
        detail: `Instance(${instance.id}) key=${instance.instanceKey} has no matching PropertyAmenity`,
      });
    }

    // 3. Every Placement must have a legacy PropertyAmenity for its spaceId.
    for (const placement of instance.placements) {
      const legacyMatch = legacy.find(
        (r) => r.propertyId === instance.propertyId && r.amenityKey === instance.amenityKey && r.spaceId === placement.spaceId,
      );
      if (!legacyMatch) {
        drifts.push({
          kind: "missing_legacy_for_placement",
          detail: `Placement(instance=${instance.id}, spaceId=${placement.spaceId}) has no legacy row`,
        });
      }
    }
  }

  if (drifts.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`[detect-amenity-drift] OK — legacy=${legacy.length} instances=${instances.length}, no drift`);
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`[detect-amenity-drift] ${drifts.length} drift(s) detected:`);
  for (const d of drifts) {
    // eslint-disable-next-line no-console
    console.error(`  [${d.kind}] ${d.detail}`);
  }
  process.exit(1);
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
