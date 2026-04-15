/**
 * A single-fetch snapshot of every DB row the derived + completeness services
 * need for one property. Loading it once and passing it through `compute*`
 * helpers avoids ~8–10 duplicate queries when the orchestrator recomputes
 * everything (property-derived + completeness run against the same data).
 *
 * The per-helper prisma fallback stays intact: each `compute*` accepts an
 * optional snapshot and refetches when called on its own (unit tests + cheap
 * single-section reads).
 */

import { prisma } from "@/lib/db";

export interface SnapshotProperty {
  roomType: string | null;
  layoutKey: string | null;
  checkInStart: string | null;
  checkInEnd: string | null;
  checkOutTime: string | null;
  primaryAccessMethod: string | null;
  accessMethodsJson: unknown;
}

export interface SnapshotBed {
  id: string;
  bedType: string;
  quantity: number;
  configJson: unknown;
}

export interface SnapshotSpace {
  id: string;
  spaceType: string;
  name: string;
  beds: SnapshotBed[];
  amenityPlacements: { id: string }[];
}

export interface SnapshotAmenityInstance {
  amenityKey: string;
  subtypeKey: string | null;
  detailsJson: unknown;
  placements: { id: string; spaceId: string }[];
}

export interface SnapshotSystem {
  systemKey: string;
  detailsJson: unknown;
}

export interface SnapshotCoverage {
  spaceId: string;
  systemKey: string;
}

export interface PropertySnapshot {
  propertyId: string;
  property: SnapshotProperty | null;
  spaces: SnapshotSpace[];
  amenityInstances: SnapshotAmenityInstance[];
  systems: SnapshotSystem[];
  /** Only `override_yes` rows; ordered deterministically. */
  coverages: SnapshotCoverage[];
  /** Space ids that have at least one media assignment. */
  mediaSpaceEntityIds: string[];
}

export async function loadPropertySnapshot(
  propertyId: string,
): Promise<PropertySnapshot> {
  const [property, spaces, amenityInstances, systems, coverageRows] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        roomType: true,
        layoutKey: true,
        checkInStart: true,
        checkInEnd: true,
        checkOutTime: true,
        primaryAccessMethod: true,
        accessMethodsJson: true,
      },
    }),
    prisma.space.findMany({
      where: { propertyId, status: "active" },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        spaceType: true,
        name: true,
        beds: { select: { id: true, bedType: true, quantity: true, configJson: true } },
        amenityPlacements: { select: { id: true } },
      },
    }),
    prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: {
        amenityKey: true,
        subtypeKey: true,
        detailsJson: true,
        placements: { select: { id: true, spaceId: true } },
      },
    }),
    prisma.propertySystem.findMany({
      where: { propertyId },
      select: { systemKey: true, detailsJson: true },
    }),
    prisma.propertySystemCoverage.findMany({
      where: { system: { propertyId }, mode: "override_yes" },
      orderBy: [{ spaceId: "asc" }, { system: { systemKey: "asc" } }],
      select: { spaceId: true, system: { select: { systemKey: true } } },
    }),
  ]);

  const spaceIds = spaces.map((s) => s.id);
  const mediaGrouped =
    spaceIds.length > 0
      ? await prisma.mediaAssignment.groupBy({
          by: ["entityId"],
          where: { entityType: "space", entityId: { in: spaceIds } },
          _count: { _all: true },
        })
      : [];

  return {
    propertyId,
    property,
    spaces,
    amenityInstances,
    systems,
    coverages: coverageRows.map((c) => ({
      spaceId: c.spaceId,
      systemKey: c.system.systemKey,
    })),
    mediaSpaceEntityIds: mediaGrouped.map((m) => m.entityId),
  };
}
