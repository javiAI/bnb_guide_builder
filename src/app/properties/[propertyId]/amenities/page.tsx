import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  amenityTaxonomy,
  findSubtype,
  getAmenityScopePolicy,
} from "@/lib/taxonomy-loader";
import type { ImportanceLevel, SubtypeField } from "@/lib/types/taxonomy";
import {
  isCanonicalInstanceKey,
  spaceIdFromInstanceKey,
} from "@/lib/amenity-instance-keys";
import { AmenitySelectorV2 } from "./amenity-selector-v2";

// ── Serialisable types for client ──

export interface EnrichedAmenityItem {
  id: string;
  label: string;
  description: string;
  recommended: boolean;
  importanceLevel: ImportanceLevel;
  hasSubtype: boolean;
  subtypeFields: SubtypeField[];
  enabled: boolean;
  /** `PropertyAmenityInstance.id` of the enabled instance, if any. */
  dbId: string | null;
  detailsJson: Record<string, unknown> | null;
  /**
   * True for instances whose `instanceKey` is non-canonical (i.e. not
   * "default" / "space:<id>"). No current code path produces these —
   * forward-looking flag so the UI can badge custom instances once a
   * creation surface lands.
   */
  isCustomInstance: boolean;
}

export interface SpaceSection {
  spaceId: string;
  spaceType: string;
  spaceName: string;
  items: EnrichedAmenityItem[];
}

export default async function AmenitiesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      propertyEnvironment: true,
      spaces: {
        select: { id: true, spaceType: true, name: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!property) notFound();

  // Load instances + placements. For each canonical space-scoped
  // instance (`space:<id>`) we surface it at its placement spaceIds;
  // non-canonical (custom) instances are tagged via `isCustomInstance`.
  const existingInstances = await prisma.propertyAmenityInstance.findMany({
    where: { propertyId },
    select: {
      id: true,
      amenityKey: true,
      instanceKey: true,
      detailsJson: true,
      placements: { select: { spaceId: true } },
    },
  });

  // ── Build item sets ──

  const propEnv = property.propertyEnvironment;

  const excludedIds = new Set<string>();
  for (const item of amenityTaxonomy.items) {
    const scope = getAmenityScopePolicy(item.id);
    if (scope?.isDerived) excludedIds.add(item.id);
    if (item.canonicalOwner) excludedIds.add(item.id);
    // Environment filtering: items with relevantEnvironments only show when property's environment matches.
    // If the item declares relevantEnvironments but the property hasn't set one yet, exclude it
    // (avoids showing environment-specific amenities like beach/ski/lake on undefined-environment properties).
    if (scope?.relevantEnvironments?.length && (!propEnv || !scope.relevantEnvironments.includes(propEnv))) {
      excludedIds.add(item.id);
    }
  }

  // Split remaining items into property-wide vs space-bound
  const propertyWideItems = amenityTaxonomy.items.filter((item) => {
    if (excludedIds.has(item.id)) return false;
    const scope = getAmenityScopePolicy(item.id);
    return scope?.scopePolicy === "property_only";
  });

  const spaceBoundItems = amenityTaxonomy.items.filter((item) => {
    if (excludedIds.has(item.id)) return false;
    const scope = getAmenityScopePolicy(item.id);
    return scope?.scopePolicy === "space_only" || scope?.scopePolicy === "multi_instance";
  });

  // Index by `${amenityKey}|${spaceId ?? ""}` so `enrichItem` can lookup
  // in O(1) for any (taxonomy item, space) pair.
  //
  // Two passes so canonical instances always win a key collision:
  //   Pass 1: canonical instances ("default" / "space:<id>") — indexed
  //           by the spaceId encoded in the instanceKey (authoritative
  //           slot, ignoring any drifted placements).
  //   Pass 2: custom instances — indexed from their placements (or the
  //           property-wide slot when empty), but only into keys a
  //           canonical instance didn't already claim.
  type IndexedInstance = {
    id: string;
    amenityKey: string;
    detailsJson: unknown;
    isCustomInstance: boolean;
  };
  const instanceIndex = new Map<string, IndexedInstance>();
  const indexedFrom = (inst: typeof existingInstances[number], isCustom: boolean): IndexedInstance => ({
    id: inst.id,
    amenityKey: inst.amenityKey,
    detailsJson: inst.detailsJson,
    isCustomInstance: isCustom,
  });

  for (const inst of existingInstances) {
    if (!isCanonicalInstanceKey(inst.instanceKey)) continue;
    const derivedSpaceId = spaceIdFromInstanceKey(inst.instanceKey);
    // Canonical instances are 1:1 per space by design — the instanceKey
    // is the authoritative slot, not the placements. A `space:X` instance
    // with a stray placement on Y still surfaces only at X.
    const slot = derivedSpaceId === null ? `${inst.amenityKey}|` : `${inst.amenityKey}|${derivedSpaceId}`;
    instanceIndex.set(slot, indexedFrom(inst, false));
  }
  for (const inst of existingInstances) {
    if (isCanonicalInstanceKey(inst.instanceKey)) continue;
    const custom = indexedFrom(inst, true);
    if (inst.placements.length === 0) {
      const slot = `${inst.amenityKey}|`;
      if (!instanceIndex.has(slot)) instanceIndex.set(slot, custom);
    } else {
      for (const p of inst.placements) {
        const slot = `${inst.amenityKey}|${p.spaceId}`;
        if (!instanceIndex.has(slot)) instanceIndex.set(slot, custom);
      }
    }
  }

  function enrichItem(
    item: typeof amenityTaxonomy.items[number],
    spaceId: string | null,
  ): EnrichedAmenityItem {
    const key = `${item.id}|${spaceId ?? ""}`;
    const existing = instanceIndex.get(key);
    const subtype = findSubtype(item.id);
    return {
      id: item.id,
      label: item.label,
      description: item.description,
      recommended: item.recommended ?? false,
      importanceLevel: (item.importanceLevel as ImportanceLevel) ?? "standard",
      hasSubtype: !!subtype,
      subtypeFields: subtype?.fields ?? [],
      enabled: !!existing,
      dbId: existing?.id ?? null,
      detailsJson: (existing?.detailsJson as Record<string, unknown>) ?? null,
      isCustomInstance: existing?.isCustomInstance ?? false,
    };
  }

  // General section: property-wide amenities (spaceId = null)
  const generalItems = propertyWideItems.map((item) => enrichItem(item, null));

  // Per-space sections: for each configured space, show applicable space-bound amenities
  const spaceSections: SpaceSection[] = property.spaces.map((space) => {
    const applicable = spaceBoundItems.filter((item) => {
      const scope = getAmenityScopePolicy(item.id);
      const suggested = scope?.suggestedSpaceTypes ?? [];
      return suggested.length === 0 || suggested.includes(space.spaceType);
    });
    return {
      spaceId: space.id,
      spaceType: space.spaceType,
      spaceName: space.name,
      items: applicable.map((item) => enrichItem(item, space.id)),
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Equipamiento
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Configura qué equipamiento tiene tu propiedad y cada espacio.
      </p>

      <div className="mt-8">
        <AmenitySelectorV2
          propertyId={propertyId}
          generalItems={generalItems}
          spaceSections={spaceSections}
        />
      </div>
    </div>
  );
}
