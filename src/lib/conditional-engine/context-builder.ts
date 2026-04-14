/**
 * Build a PropertyContext from persisted state.
 *
 * Kept decoupled from `@/lib/prisma` so unit tests can pass a minimal client
 * shape instead of mocking the full singleton.
 */

import type { PropertyContext } from "./types";

type MinimalPrisma = {
  property: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<Record<string, unknown> | null>;
  };
  space: {
    findMany: (args: {
      where: { propertyId: string };
      select: { id: true; spaceType: true };
    }) => Promise<Array<{ id: string; spaceType: string }>>;
  };
  propertySystem: {
    findMany: (args: {
      where: { propertyId: string };
      select: { systemKey: true };
    }) => Promise<Array<{ systemKey: string }>>;
  };
  propertyAmenityInstance: {
    findMany: (args: {
      where: { propertyId: string };
      select: { amenityKey: true };
      distinct?: "amenityKey"[];
    }) => Promise<Array<{ amenityKey: string }>>;
  };
};

export async function buildPropertyContext(
  prisma: MinimalPrisma,
  propertyId: string,
): Promise<PropertyContext> {
  const [property, spaces, systems, amenities] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId } }),
    prisma.space.findMany({
      where: { propertyId },
      select: { id: true, spaceType: true },
    }),
    prisma.propertySystem.findMany({
      where: { propertyId },
      select: { systemKey: true },
    }),
    // Phase 2 / Branch 2C — reads now source from the instance model.
    // `distinct` collapses duplicate amenityKey rows produced by multiple
    // space-scoped instances of the same amenity (e.g. "space:s1" +
    // "space:s2") — the legacy table had separate rows too, but the
    // downstream context only wants the unique key set.
    prisma.propertyAmenityInstance.findMany({
      where: { propertyId },
      select: { amenityKey: true },
      distinct: ["amenityKey"],
    }),
  ]);

  if (!property) throw new Error(`Property ${propertyId} not found`);

  return {
    property: {
      // Spread raw record first so any extra fields are preserved, then
      // override with normalized canonical fields. Normalization must win
      // over lightweight stubs that might return `undefined` for these keys.
      ...property,
      id: propertyId,
      propertyType: (property.propertyType as string | null) ?? null,
      roomType: (property.roomType as string | null) ?? null,
      layoutKey: (property.layoutKey as string | null) ?? null,
      propertyEnvironment: (property.propertyEnvironment as string | null) ?? null,
      floorLevel: (property.floorLevel as number | null) ?? null,
      hasElevator: (property.hasElevator as boolean | null) ?? null,
      maxGuests: (property.maxGuests as number | null) ?? null,
      maxAdults: (property.maxAdults as number | null) ?? null,
      maxChildren: (property.maxChildren as number | null) ?? null,
      infantsAllowed: (property.infantsAllowed as boolean | null) ?? null,
    },
    spaces: spaces.map((s) => ({ id: s.id, spaceType: s.spaceType })),
    systems: systems.map((s) => s.systemKey),
    amenities: Array.from(new Set(amenities.map((a) => a.amenityKey))),
  };
}

/**
 * Build a synthetic context from plain data — useful for tests and for
 * previewing availability before any writes occur (e.g. during the wizard).
 */
export function buildSyntheticContext(
  input: Partial<PropertyContext["property"]> & { id?: string } = {},
  spaces: Array<{ id: string; spaceType: string }> = [],
  systems: string[] = [],
  amenities: string[] = [],
): PropertyContext {
  // Spread input first, then force a defined id. Otherwise `input.id: undefined`
  // would silently override the default and produce `property.id === undefined`.
  return {
    property: { ...input, id: input.id ?? "synthetic" },
    spaces,
    systems,
    amenities,
  };
}
