import type { ItemTaxonomyFile } from "../types/taxonomy";
import bedTypesJson from "../../../taxonomies/bed_types.json";

export const bedTypes = bedTypesJson as unknown as ItemTaxonomyFile;

/**
 * Sleeping capacity for a bed row: `bt.other` reads configJson.customCapacity
 * (default 1); every other type uses the taxonomy's `sleepingCapacity`
 * (cribs are 0). Single source for the capacity business rule — used by the
 * server aggregate (property-counts) and the client cards (space-card,
 * bed-manager) alike; lives here so client bundles skip taxonomy-loader.
 */
export function getBedSleepingCapacity(
  bedType: string,
  quantity: number,
  configJson?: Record<string, unknown> | null,
): number {
  if (bedType === "bt.other") {
    const custom = typeof configJson?.customCapacity === "number" ? configJson.customCapacity : 1;
    return custom * quantity;
  }
  const item = (bedTypes.items as Array<{ id: string; sleepingCapacity?: number }>).find(
    (b) => b.id === bedType,
  );
  return (item?.sleepingCapacity ?? 1) * quantity;
}

/** Total sleeping places across a set of bed rows. */
export function bedPlaces(
  beds: ReadonlyArray<{ bedType: string; quantity: number; configJson?: Record<string, unknown> | null }>,
): number {
  return beds.reduce((sum, b) => sum + getBedSleepingCapacity(b.bedType, b.quantity, b.configJson), 0);
}
