/**
 * Completeness scoring per section + overall readiness.
 *
 * Rules and weights live in `taxonomies/completeness_rules.json` (config-driven).
 * Scores are 0–100 integers. Each `compute*Completeness` is self-contained so
 * call-sites can read one without paying for all four. `computeOverallReadiness`
 * fans out and returns per-section scores plus `usable` / `publishable` gates.
 *
 * Every helper accepts an optional `PropertySnapshot` — when the orchestrator
 * has already fetched it, pass it through to avoid redundant queries.
 */

import { prisma } from "@/lib/db";
import {
  amenityTaxonomy,
  amenitySubtypes,
  completenessRules,
  getAvailableSpaceTypes,
} from "@/lib/taxonomy-loader";
import type { PropertySnapshot } from "@/lib/services/property-snapshot";

export interface SectionScores {
  spaces: number;
  amenities: number;
  systems: number;
  arrival: number;
}

export interface OverallReadiness {
  scores: SectionScores;
  overall: number;
  usable: boolean;
  publishable: boolean;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const ratio = (have: number, need: number) => (need <= 0 ? 1 : have / need);

// ── Spaces ──

export async function computeSpacesCompleteness(
  propertyId: string,
  snapshot?: PropertySnapshot,
): Promise<number> {
  const property =
    snapshot?.property ??
    (await prisma.property.findUnique({
      where: { id: propertyId },
      select: { roomType: true, layoutKey: true },
    }));
  if (!property?.roomType) return 0;

  const availability = getAvailableSpaceTypes(property.roomType, property.layoutKey ?? null);

  const spaces =
    snapshot?.spaces ??
    (await prisma.space.findMany({
      where: { propertyId },
      select: {
        id: true,
        spaceType: true,
        beds: { select: { id: true } },
        amenityPlacements: { select: { id: true } },
      },
    }));
  // Empty section → 0; avoids `ratio(0,0)=1` giving full credit on facets
  // whose denominators depend on spaces.length / bedsExpected.length.
  if (spaces.length === 0) return 0;

  const presentTypes = new Set(spaces.map((s) => s.spaceType));
  const requiredHave = availability.required.filter((t) => presentTypes.has(t)).length;
  const recommendedHave = availability.recommended.filter((t) => presentTypes.has(t)).length;

  // Spaces that *should* have beds (bedrooms / studios / lofts).
  const bedsExpected = spaces.filter((s) =>
    ["sp.bedroom", "sp.studio", "sp.loft", "sp.kitchen_living"].includes(s.spaceType),
  );
  const bedsHave = bedsExpected.filter((s) => s.beds.length > 0).length;

  const amenitiesHave = spaces.filter((s) => s.amenityPlacements.length > 0).length;

  // Media: count distinct space entities that have at least one assignment.
  let mediaHave = 0;
  if (snapshot) {
    mediaHave = snapshot.mediaSpaceEntityIds.length;
  } else {
    const spaceIds = spaces.map((s) => s.id);
    if (spaceIds.length > 0) {
      const grouped = await prisma.mediaAssignment.groupBy({
        by: ["entityId"],
        where: { entityType: "space", entityId: { in: spaceIds } },
        _count: { _all: true },
      });
      mediaHave = grouped.length;
    }
  }

  const w = completenessRules.sections.spaces.weights;
  const score =
    w.requiredPresent * ratio(requiredHave, availability.required.length) +
    w.recommendedPresent * ratio(recommendedHave, availability.recommended.length) +
    w.bedsConfigured * ratio(bedsHave, bedsExpected.length) +
    w.amenitiesPlaced * ratio(amenitiesHave, spaces.length) +
    w.mediaAttached * ratio(mediaHave, spaces.length);

  return clampPct(score);
}

// ── Amenities ──

function isAmenityDetailsComplete(
  amenityKey: string,
  detailsJson: unknown,
): boolean {
  // Subtype existence is driven by taxonomy (keyed by amenity_id), not by
  // whether the instance has `subtypeKey` populated. A freshly toggled-on
  // `am.wifi` has `subtypeKey=null` but still needs ssid/password — keying off
  // the instance field here would incorrectly mark it complete.
  const subtype = amenitySubtypes.subtypes.find((s) => s.amenity_id === amenityKey);
  if (!subtype) return true;
  const requiredFields = subtype.fields.filter((f) => f.required);
  if (requiredFields.length === 0) return true;
  const details = (detailsJson ?? {}) as Record<string, unknown>;
  return requiredFields.every((f) => {
    const v = details[f.id];
    return v !== undefined && v !== null && v !== "";
  });
}

export async function computeAmenitiesCompleteness(
  propertyId: string,
  snapshot?: PropertySnapshot,
): Promise<number> {
  const instances =
    snapshot?.amenityInstances ??
    (await prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: {
        amenityKey: true,
        subtypeKey: true,
        detailsJson: true,
        placements: { select: { id: true } },
      },
    }));
  // No amenities configured at all → nothing to score against.
  if (instances.length === 0) return 0;

  const w = completenessRules.sections.amenities.weights;
  const core = completenessRules.sections.amenities.coreAmenityKeys;

  const presentKeys = new Set(instances.map((i) => i.amenityKey));
  const coreHave = core.filter((k) => presentKeys.has(k)).length;

  const detailComplete = instances.filter((i) =>
    isAmenityDetailsComplete(i.amenityKey, i.detailsJson),
  ).length;

  const scopePolicies = amenityTaxonomy.scopePolicies ?? {};
  // An amenity is "placed" when it either has placements or its scopePolicy is
  // `property_only` (no placement required). Unknown keys default to needing
  // placement so we don't give free credit to amenities outside taxonomy.
  const placedHave = instances.filter((i) => {
    if (i.placements.length > 0) return true;
    return scopePolicies[i.amenityKey]?.scopePolicy === "property_only";
  }).length;

  const score =
    w.coreAmenitiesPresent * ratio(coreHave, core.length) +
    w.subtypeDetailsComplete * ratio(detailComplete, instances.length) +
    w.placementsResolved * ratio(placedHave, instances.length);

  return clampPct(score);
}

// ── Systems ──

export async function computeSystemsCompleteness(
  propertyId: string,
  snapshot?: PropertySnapshot,
): Promise<number> {
  const systems =
    snapshot?.systems ??
    (await prisma.propertySystem.findMany({
      where: { propertyId },
      select: { systemKey: true, detailsJson: true },
    }));
  // No systems configured → 0; section is empty.
  if (systems.length === 0) return 0;

  const w = completenessRules.sections.systems.weights;
  const recommended = completenessRules.sections.systems.recommendedSystemKeys;

  const presentKeys = new Set(systems.map((s) => s.systemKey));
  const recommendedHave = recommended.filter((k) => presentKeys.has(k)).length;

  // "Details complete" = detailsJson is a non-empty object with at least one
  // populated value. Subtype-level field validation lives in cross-validations.
  const detailsComplete = systems.filter((s) => {
    const d = (s.detailsJson ?? {}) as Record<string, unknown>;
    return Object.values(d).some((v) => v !== undefined && v !== null && v !== "");
  }).length;

  const score =
    w.recommendedSystemsPresent * ratio(recommendedHave, recommended.length) +
    w.systemDetailsComplete * ratio(detailsComplete, systems.length);

  return clampPct(score);
}

// ── Arrival ──

export async function computeArrivalCompleteness(
  propertyId: string,
  snapshot?: PropertySnapshot,
): Promise<number> {
  const property =
    snapshot?.property ??
    (await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        checkInStart: true,
        checkInEnd: true,
        checkOutTime: true,
        primaryAccessMethod: true,
        accessMethodsJson: true,
      },
    }));
  if (!property) return 0;

  const w = completenessRules.sections.arrival.weights;
  const hasCheckIn = !!(property.checkInStart && property.checkInEnd);
  const hasCheckOut = !!property.checkOutTime;
  const hasPrimary = !!property.primaryAccessMethod;

  const access = (property.accessMethodsJson ?? null) as
    | { unit?: { methods?: string[] }; building?: { methods?: string[] } }
    | null;
  const hasAccessDetail = !!(
    (access?.unit?.methods && access.unit.methods.length > 0) ||
    (access?.building?.methods && access.building.methods.length > 0)
  );

  const score =
    (hasCheckIn ? w.checkInTimes : 0) +
    (hasCheckOut ? w.checkOutTime : 0) +
    (hasPrimary ? w.primaryAccessMethod : 0) +
    (hasAccessDetail ? w.accessMethodsDetail : 0);

  return clampPct(score);
}

// ── Orchestrator ──

export async function computeOverallReadiness(
  propertyId: string,
  snapshot?: PropertySnapshot,
): Promise<OverallReadiness> {
  const [spaces, amenities, systems, arrival] = await Promise.all([
    computeSpacesCompleteness(propertyId, snapshot),
    computeAmenitiesCompleteness(propertyId, snapshot),
    computeSystemsCompleteness(propertyId, snapshot),
    computeArrivalCompleteness(propertyId, snapshot),
  ]);
  const scores: SectionScores = { spaces, amenities, systems, arrival };
  const overall = clampPct((spaces + amenities + systems + arrival) / 4);
  const { usableMinScore, publishableMinScore } = completenessRules.thresholds;
  return {
    scores,
    overall,
    usable: Object.values(scores).every((v) => v >= usableMinScore),
    publishable: Object.values(scores).every((v) => v >= publishableMinScore),
  };
}
