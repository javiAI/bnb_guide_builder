import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  amenityTaxonomy,
  findSubtype,
  getAmenityScopePolicy,
  isAmenityMoved,
  isAmenityDerived,
  isAmenityConfigurable,
} from "@/lib/taxonomy-loader";
import type { ImportanceLevel, SubtypeField, AmenityItem } from "@/lib/types/taxonomy";
import {
  isCanonicalInstanceKey,
  spaceIdFromInstanceKey,
} from "@/lib/amenity-instance-keys";
import {
  resolveDerivation,
  type DerivationContext,
  type DerivationStatus,
  type AccessMethodsShape,
} from "@/lib/amenity-derivation-resolver";
import { AmenitySelector } from "./amenity-selector";

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

export interface DerivedAmenityItem {
  id: string;
  label: string;
  description: string;
  importanceLevel: ImportanceLevel;
  status: DerivationStatus;
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
      accessMethodsJson: true,
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
  const [existingInstances, systems] = await Promise.all([
    prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: {
        id: true,
        amenityKey: true,
        instanceKey: true,
        detailsJson: true,
        placements: { select: { spaceId: true } },
      },
    }),
    prisma.propertySystem.findMany({
      where: { propertyId },
      select: { systemKey: true, detailsJson: true },
    }),
  ]);

  // ── Build derivation context (shared by all derived items) ──

  const derivationCtx: DerivationContext = {
    propertyId,
    systems,
    spaces: property.spaces.map((s) => ({ spaceType: s.spaceType })),
    accessMethodsJson: (property.accessMethodsJson as AccessMethodsShape | null) ?? null,
  };

  // ── Partition taxonomy into configurable vs derived vs excluded ──

  const propEnv = property.propertyEnvironment;

  const configurableItems: AmenityItem[] = [];
  const derivedItems: AmenityItem[] = [];
  for (const item of amenityTaxonomy.items) {
    // Moved items live fully in other modules — hide from Equipamiento.
    if (isAmenityMoved(item.id)) continue;
    // Environment-gated items (beach/ski/lake/...) only show when the
    // property's environment matches. Applies to both configurable and
    // derived variants.
    const scope = getAmenityScopePolicy(item.id);
    if (scope?.relevantEnvironments?.length && (!propEnv || !scope.relevantEnvironments.includes(propEnv))) {
      continue;
    }
    if (isAmenityDerived(item.id)) {
      derivedItems.push(item);
    } else if (isAmenityConfigurable(item.id)) {
      configurableItems.push(item);
    } else {
      // Defensive: any future/unknown destination value should not silently
      // surface as configurable — the destination contract is enforced by
      // tests, and an unmapped item here means the partition is incomplete.
      throw new Error(
        `Amenity ${item.id} has unknown destination "${item.destination}" — update partition logic or mark as moved.`,
      );
    }
  }

  // Split remaining configurable items into property-wide vs space-bound
  const propertyWideItems = configurableItems.filter((item) => {
    const scope = getAmenityScopePolicy(item.id);
    return scope?.scopePolicy === "property_only";
  });

  const spaceBoundItems = configurableItems.filter((item) => {
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
    item: AmenityItem,
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

  // Derived items are property-wide-only in the UI: showing them once per
  // space would just duplicate "Configurar en Sistemas →" everywhere. Their
  // state is global (a system either exists or doesn't).
  const generalDerived: DerivedAmenityItem[] = derivedItems
    .map((item) => {
      const status = resolveDerivation(item, derivationCtx);
      if (!status) return null;
      return {
        id: item.id,
        label: item.label,
        description: item.description,
        importanceLevel: (item.importanceLevel as ImportanceLevel) ?? "standard",
        status,
      };
    })
    .filter((x): x is DerivedAmenityItem => x !== null);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Equipamiento
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Configura qué equipamiento tiene tu propiedad y cada espacio.
      </p>

      <div className="mt-8">
        <AmenitySelector
          propertyId={propertyId}
          generalItems={generalItems}
          generalDerived={generalDerived}
          spaceSections={spaceSections}
        />
      </div>
    </div>
  );
}
