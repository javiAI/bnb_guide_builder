/**
 * PropertyDerivedService — canonical compute service for every derived field
 * a property has. The output is a single JSON payload (`DerivedPayload`) that
 * downstream readers (Overview, Publishing, retrieval) consume instead of
 * recomputing piecemeal.
 *
 * Cache: `recomputeAll(propertyId)` writes the payload to the
 * `PropertyDerived` table. Reads should go through `getDerived(propertyId)`,
 * which returns the cache row (recomputing on miss).
 *
 * All compute* helpers are split per concern so they can be unit-tested in
 * isolation. They each take `propertyId` and run their own queries — keep
 * them self-contained so call-sites can reach for one without paying for the
 * full recompute.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getBedSleepingCapacity } from "@/lib/property-counts";
import {
  amenityTaxonomy,
  getAvailableSpaceTypes,
} from "@/lib/taxonomy-loader";

export interface SpaceCapacity {
  spaceId: string;
  spaceType: string;
  name: string;
  sleepingCapacity: number;
}

export interface SleepingCapacity {
  total: number;
  bySpace: SpaceCapacity[];
}

export interface ActualCounts {
  actualBedroomsCount: number;
  actualBathroomsCount: number;
  actualBedsCount: number;
}

export interface SpaceAvailability {
  required: string[];
  recommended: string[];
  optional: string[];
  excluded: string[];
}

export interface SystemCoverageBySpace {
  /** Map of spaceId → list of system keys that cover that space. */
  bySpace: Record<string, string[]>;
}

export interface AmenitiesEffectiveBySpace {
  /** Map of spaceId → list of amenity keys (configurable + derived) effective there. */
  bySpace: Record<string, string[]>;
  /** Property-wide amenity keys (no placement → applies globally). */
  global: string[];
}

export interface DerivedPayload {
  propertyId: string;
  recomputedAt: string;
  sleepingCapacity: SleepingCapacity;
  actualCounts: ActualCounts;
  spaceAvailability: SpaceAvailability;
  systemCoverageBySpace: SystemCoverageBySpace;
  amenitiesEffectiveBySpace: AmenitiesEffectiveBySpace;
}

// ──────────────────────────────────────────────
// Per-concern compute functions
// ──────────────────────────────────────────────

export async function computeSleepingCapacity(
  propertyId: string,
): Promise<SleepingCapacity> {
  const spaces = await prisma.space.findMany({
    where: { propertyId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      spaceType: true,
      name: true,
      beds: { select: { bedType: true, quantity: true, configJson: true } },
    },
  });
  const bySpace: SpaceCapacity[] = spaces.map((s) => ({
    spaceId: s.id,
    spaceType: s.spaceType,
    name: s.name,
    sleepingCapacity: s.beds.reduce(
      (sum, b) =>
        sum +
        getBedSleepingCapacity(
          b.bedType,
          b.quantity,
          (b.configJson ?? null) as Record<string, unknown> | null,
        ),
      0,
    ),
  }));
  return {
    total: bySpace.reduce((sum, s) => sum + s.sleepingCapacity, 0),
    bySpace,
  };
}

export async function computeActualCounts(
  propertyId: string,
): Promise<ActualCounts> {
  const spaces = await prisma.space.findMany({
    where: { propertyId },
    select: {
      spaceType: true,
      beds: { select: { quantity: true } },
    },
  });
  return {
    actualBedroomsCount: spaces.filter((s) => s.spaceType === "sp.bedroom").length,
    actualBathroomsCount: spaces.filter((s) => s.spaceType === "sp.bathroom").length,
    actualBedsCount: spaces.reduce(
      (sum, s) => sum + s.beds.reduce((bsum, b) => bsum + b.quantity, 0),
      0,
    ),
  };
}

export async function computeSpaceAvailability(
  propertyId: string,
): Promise<SpaceAvailability> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { roomType: true, layoutKey: true },
  });
  if (!property?.roomType) {
    return { required: [], recommended: [], optional: [], excluded: [] };
  }
  return getAvailableSpaceTypes(property.roomType, property.layoutKey ?? null);
}

export async function computeSystemCoverageBySpace(
  propertyId: string,
): Promise<SystemCoverageBySpace> {
  // Only explicit affirmative overrides mean "this system covers this space".
  // `inherited` shouldn't be persisted; `override_no` is an explicit negation.
  // Filter at the DB and order results so the cached JSON is deterministic.
  const coverages = await prisma.propertySystemCoverage.findMany({
    where: { system: { propertyId }, mode: "override_yes" },
    orderBy: [{ spaceId: "asc" }, { system: { systemKey: "asc" } }],
    select: {
      spaceId: true,
      system: { select: { systemKey: true } },
    },
  });
  const bySpace: Record<string, string[]> = {};
  for (const c of coverages) {
    if (!bySpace[c.spaceId]) bySpace[c.spaceId] = [];
    bySpace[c.spaceId].push(c.system.systemKey);
  }
  for (const spaceId of Object.keys(bySpace)) {
    bySpace[spaceId] = Array.from(new Set(bySpace[spaceId])).sort();
  }
  return { bySpace };
}

/**
 * Effective amenities per space = configurable amenities placed there +
 * derived amenities whose source applies (e.g. `am.wifi` is effective in every
 * space when `sys.internet` exists).
 *
 * Today this merge includes explicit amenity placements plus the
 * derived-from-system case that fans out globally across all spaces.
 * Other derivation kinds (derived-from-space, derived-from-access) are not
 * included in this "effective by space" result yet and should be added here
 * when that behavior is implemented.
 */
export async function computeAmenitiesEffectiveBySpace(
  propertyId: string,
): Promise<AmenitiesEffectiveBySpace> {
  const [instances, systems, spaces] = await Promise.all([
    prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: {
        amenityKey: true,
        placements: { select: { spaceId: true } },
      },
    }),
    prisma.propertySystem.findMany({
      where: { propertyId },
      select: { systemKey: true },
    }),
    prisma.space.findMany({
      where: { propertyId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
  ]);

  const bySpaceSets: Record<string, Set<string>> = {};
  const globalSet = new Set<string>();
  const ensure = (spaceId: string) => {
    if (!bySpaceSets[spaceId]) bySpaceSets[spaceId] = new Set();
    return bySpaceSets[spaceId];
  };

  // 1. Configurable amenities — by placement, or global if none.
  for (const inst of instances) {
    if (inst.placements.length === 0) {
      globalSet.add(inst.amenityKey);
      continue;
    }
    for (const p of inst.placements) {
      ensure(p.spaceId).add(inst.amenityKey);
    }
  }

  // 2. Derived-from-system amenities — apply globally when source system exists.
  const systemKeys = new Set(systems.map((s) => s.systemKey));
  for (const item of amenityTaxonomy.items) {
    if (item.destination !== "derived_from_system") continue;
    if (!item.target || !systemKeys.has(item.target)) continue;
    globalSet.add(item.id);
    // Also expose globally-derived items per-space so consumers can flatten
    // without re-merging the global list.
    for (const sp of spaces) {
      ensure(sp.id).add(item.id);
    }
  }

  const bySpace: Record<string, string[]> = {};
  for (const spaceId of Object.keys(bySpaceSets)) {
    bySpace[spaceId] = Array.from(bySpaceSets[spaceId]).sort();
  }
  const global = Array.from(globalSet).sort();
  return { bySpace, global };
}

// ──────────────────────────────────────────────
// Orchestrator + cache
// ──────────────────────────────────────────────

async function buildPayload(
  propertyId: string,
  now: Date,
): Promise<DerivedPayload> {
  const [
    sleepingCapacity,
    actualCounts,
    spaceAvailability,
    systemCoverageBySpace,
    amenitiesEffectiveBySpace,
  ] = await Promise.all([
    computeSleepingCapacity(propertyId),
    computeActualCounts(propertyId),
    computeSpaceAvailability(propertyId),
    computeSystemCoverageBySpace(propertyId),
    computeAmenitiesEffectiveBySpace(propertyId),
  ]);
  return {
    propertyId,
    recomputedAt: now.toISOString(),
    sleepingCapacity,
    actualCounts,
    spaceAvailability,
    systemCoverageBySpace,
    amenitiesEffectiveBySpace,
  };
}

/**
 * Recompute the full derived payload and write it to the cache table. Safe to
 * call fire-and-forget from server actions; failures are logged and swallowed
 * so a recompute glitch never breaks the user-facing mutation.
 */
export async function recomputeAll(propertyId: string): Promise<DerivedPayload> {
  const now = new Date();
  const payload = await buildPayload(propertyId, now);
  const derivedJson = payload as unknown as Prisma.InputJsonValue;
  await prisma.propertyDerived.upsert({
    where: { propertyId },
    create: {
      propertyId,
      derivedJson,
      recomputedAt: now,
    },
    update: {
      derivedJson,
      recomputedAt: now,
    },
  });
  return payload;
}

/**
 * Fire-and-forget recompute — for use inside server actions where we don't
 * want a cache write failure to mask the real mutation result. Errors are
 * logged but not rethrown.
 */
export function recomputeAllInBackground(propertyId: string): void {
  recomputeAll(propertyId).catch((err) => {
    console.error(`[property-derived] recompute failed for ${propertyId}:`, err);
  });
}

/**
 * Read the cached payload. Recomputes on miss so callers always get something.
 */
export async function getDerived(propertyId: string): Promise<DerivedPayload> {
  const row = await prisma.propertyDerived.findUnique({
    where: { propertyId },
  });
  if (row) return row.derivedJson as unknown as DerivedPayload;
  return recomputeAll(propertyId);
}
