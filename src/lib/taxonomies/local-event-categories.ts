import localEventCategoriesJson from "../../../taxonomies/local_event_categories.json";

export type LocalEventCategory = {
  id: string;
  label: string;
  description: string;
  guestLabel?: string;
  guestDescription?: string;
  icon?: string;
  recommended?: boolean;
};

export type LocalEventCategoriesFile = {
  file: string;
  version: string;
  locale: string;
  units_system: string;
  items: LocalEventCategory[];
};

export const localEventCategories =
  localEventCategoriesJson as unknown as LocalEventCategoriesFile;

const LOCAL_EVENT_CATEGORY_BY_ID: ReadonlyMap<string, LocalEventCategory> =
  new Map(localEventCategories.items.map((item) => [item.id, item]));

export function findLocalEventCategory(
  id: string,
): LocalEventCategory | undefined {
  return LOCAL_EVENT_CATEGORY_BY_ID.get(id);
}

export function isLocalEventCategoryKey(id: string): boolean {
  return LOCAL_EVENT_CATEGORY_BY_ID.has(id);
}
