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
 *
 * Note: this script imports only the pure key helpers, not the
 * dual-write module — so it doesn't pull in the app's Prisma singleton.
 */

import { PrismaClient } from "@prisma/client";
import {
  instanceKeyFor,
  spaceIdFromInstanceKey,
  isCanonicalInstanceKey,
} from "../src/lib/amenity-instance-keys";

const prisma = new PrismaClient();

type Drift = { kind: string; detail: string };

// Compound key helpers for map lookups. Null spaceId → "" sentinel,
// which is safe because instance IDs are cuids (never empty).
const instanceKey = (propertyId: string, amenityKey: string, instanceKey: string) =>
  `${propertyId}\0${amenityKey}\0${instanceKey}`;
const legacyKey = (propertyId: string, amenityKey: string, spaceId: string | null) =>
  `${propertyId}\0${amenityKey}\0${spaceId ?? ""}`;

async function main() {
  const legacy = await prisma.propertyAmenity.findMany();
  const instances = await prisma.propertyAmenityInstance.findMany({ include: { placements: true } });

  // Build O(1) lookup indexes.
  const instanceByKey = new Map<string, (typeof instances)[number]>();
  for (const inst of instances) {
    instanceByKey.set(instanceKey(inst.propertyId, inst.amenityKey, inst.instanceKey), inst);
  }
  const legacyByKey = new Map<string, (typeof legacy)[number]>();
  for (const row of legacy) {
    legacyByKey.set(legacyKey(row.propertyId, row.amenityKey, row.spaceId), row);
  }

  const drifts: Drift[] = [];

  // 1. Every legacy row must have a corresponding Instance (+ Placement if spaceId).
  for (const row of legacy) {
    const expectedKey = instanceKeyFor(row.spaceId);
    const match = instanceByKey.get(instanceKey(row.propertyId, row.amenityKey, expectedKey));
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
    if (!isCanonicalInstanceKey(instance.instanceKey)) continue;
    const spaceId = spaceIdFromInstanceKey(instance.instanceKey);
    const match = legacyByKey.get(legacyKey(instance.propertyId, instance.amenityKey, spaceId));
    if (!match) {
      drifts.push({
        kind: "missing_legacy",
        detail: `Instance(${instance.id}) key=${instance.instanceKey} has no matching PropertyAmenity`,
      });
    }

    // 3. Every Placement must have a legacy PropertyAmenity for its spaceId.
    for (const placement of instance.placements) {
      const legacyMatch = legacyByKey.get(
        legacyKey(instance.propertyId, instance.amenityKey, placement.spaceId),
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
