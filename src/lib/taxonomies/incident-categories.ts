import incidentCategoriesJson from "../../../taxonomies/incident_categories.json";

export const INCIDENT_TARGET_TYPES = [
  "system",
  "amenity",
  "space",
  "access",
  "property",
] as const;
export type IncidentTargetType = (typeof INCIDENT_TARGET_TYPES)[number];

export const INCIDENT_SEVERITIES = ["low", "medium", "high"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export type IncidentCategory = {
  id: string;
  label: string;
  description: string;
  guestLabel: string;
  icon: string;
  defaultSeverity: IncidentSeverity;
  defaultTargetType: IncidentTargetType;
};

export type IncidentCategoriesFile = {
  file: string;
  version: string;
  locale: string;
  units_system: string;
  items: IncidentCategory[];
};

export const incidentCategories =
  incidentCategoriesJson as unknown as IncidentCategoriesFile;

const INCIDENT_CATEGORY_BY_ID: ReadonlyMap<string, IncidentCategory> = new Map(
  incidentCategories.items.map((item) => [item.id, item]),
);

export function findIncidentCategory(id: string): IncidentCategory | undefined {
  return INCIDENT_CATEGORY_BY_ID.get(id);
}

export function isIncidentCategoryKey(id: string): boolean {
  return INCIDENT_CATEGORY_BY_ID.has(id);
}
