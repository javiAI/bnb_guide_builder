import { prisma } from "@/lib/db";
import type { VisibilityLevel } from "@/lib/visibility";
import { PropertyNotFoundError } from "./types";

// Security-sensitive scope: the Prisma filter that keeps internal/sensitive
// rows out of every export pipeline. Pinned to the literal "guest" so a future
// reorder of `visibilityLevels` cannot silently widen what exporters see.
const GUEST_VISIBILITY: VisibilityLevel = "guest";

export interface PropertyExportContext {
  propertyType: string | null;
  customPropertyTypeLabel: string | null;
  bedroomsCount: number | null;
  bathroomsCount: number | null;
  personCapacity: number | null;
  primaryAccessMethod: string | null;
  customAccessMethodLabel: string | null;
  policiesJson: Record<string, unknown> | null;
  /**
   * sp.* taxonomy ids of Spaces with `visibility === "guest"`. Used for
   * boolean presence signals (shared_spaces, amenities-by-space).
   */
  presentSpaceTypes: ReadonlySet<string>;
  /**
   * sp.* taxonomy id → number of matching Spaces with `visibility === "guest"`.
   * Used by room counters (bedrooms, bathrooms) to recover multiplicity that
   * `presentSpaceTypes` collapses. Keys are always `sp.*`; missing keys mean 0.
   */
  spaceTypeCounts: Readonly<Record<string, number>>;
  /** am.* / ax.* taxonomy ids of PropertyAmenityInstance with `visibility === "guest"`. */
  presentAmenityKeys: ReadonlySet<string>;
  defaultLocale: string;
}

export async function loadPropertyContext(
  propertyId: string,
): Promise<PropertyExportContext> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      propertyType: true,
      customPropertyTypeLabel: true,
      bedroomsCount: true,
      bathroomsCount: true,
      maxGuests: true,
      maxAdults: true,
      maxChildren: true,
      primaryAccessMethod: true,
      customAccessMethodLabel: true,
      policiesJson: true,
      defaultLocale: true,
      spaces: {
        where: { visibility: GUEST_VISIBILITY, status: "active" },
        select: { spaceType: true },
      },
      amenityInstances: {
        where: { visibility: GUEST_VISIBILITY },
        select: { amenityKey: true },
      },
    },
  });

  if (!property) throw new PropertyNotFoundError(propertyId);

  const personCapacity =
    property.maxGuests ?? property.maxAdults + property.maxChildren;

  const spaceTypeCounts: Record<string, number> = {};
  for (const s of property.spaces) {
    spaceTypeCounts[s.spaceType] = (spaceTypeCounts[s.spaceType] ?? 0) + 1;
  }

  return {
    propertyType: property.propertyType,
    customPropertyTypeLabel: property.customPropertyTypeLabel,
    bedroomsCount: property.bedroomsCount,
    bathroomsCount: property.bathroomsCount,
    personCapacity: personCapacity > 0 ? personCapacity : null,
    primaryAccessMethod: property.primaryAccessMethod,
    customAccessMethodLabel: property.customAccessMethodLabel,
    policiesJson:
      property.policiesJson &&
      typeof property.policiesJson === "object" &&
      !Array.isArray(property.policiesJson)
        ? (property.policiesJson as Record<string, unknown>)
        : null,
    defaultLocale: property.defaultLocale,
    presentSpaceTypes: new Set(Object.keys(spaceTypeCounts)),
    spaceTypeCounts,
    presentAmenityKeys: new Set(property.amenityInstances.map((a) => a.amenityKey)),
  };
}
