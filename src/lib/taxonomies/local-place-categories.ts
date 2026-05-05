import localPlaceCategoriesJson from "../../../taxonomies/local_place_categories.json";

export type LocalPlaceCategory = {
  id: string;
  label: string;
  description: string;
  guestLabel?: string;
  guestDescription?: string;
  icon?: string;
  recommended?: boolean;
};

export type LocalPlaceCategoriesFile = {
  file: string;
  version: string;
  locale: string;
  units_system: string;
  items: LocalPlaceCategory[];
};

export const localPlaceCategories =
  localPlaceCategoriesJson as unknown as LocalPlaceCategoriesFile;

const LOCAL_PLACE_CATEGORY_BY_ID: ReadonlyMap<string, LocalPlaceCategory> =
  new Map(localPlaceCategories.items.map((item) => [item.id, item]));

export function findLocalPlaceCategory(
  id: string,
): LocalPlaceCategory | undefined {
  return LOCAL_PLACE_CATEGORY_BY_ID.get(id);
}

export function isLocalPlaceCategoryKey(id: string): boolean {
  return LOCAL_PLACE_CATEGORY_BY_ID.has(id);
}
