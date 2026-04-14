import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  amenityTaxonomy,
  findSubtype,
  getAmenityScopePolicy,
} from "@/lib/taxonomy-loader";
import type { ImportanceLevel, SubtypeField } from "@/lib/types/taxonomy";
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
  dbId: string | null;
  detailsJson: Record<string, unknown> | null;
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

  // All existing amenity rows for this property
  const existingAmenities = await prisma.propertyAmenity.findMany({
    where: { propertyId },
    select: { id: true, amenityKey: true, spaceId: true, detailsJson: true },
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

  // Index existing amenity rows: key = `${amenityKey}|${spaceId ?? ""}` → row
  const amenityIndex = new Map<string, typeof existingAmenities[number]>();
  for (const a of existingAmenities) {
    amenityIndex.set(`${a.amenityKey}|${a.spaceId ?? ""}`, a);
  }

  function enrichItem(
    item: typeof amenityTaxonomy.items[number],
    spaceId: string | null,
  ): EnrichedAmenityItem {
    const key = `${item.id}|${spaceId ?? ""}`;
    const existing = amenityIndex.get(key);
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
