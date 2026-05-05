import { z } from "zod";
import incidentCategoriesJson from "../../../taxonomies/incident_categories.json";

// Self-contained per-domain module: owns its JSON import + Zod schema + boot
// validation. Must NOT import `@/lib/taxonomy-loader` — doing so would drag the
// full loader (every taxonomy JSON) into any client bundle that touches
// incident categories. The central loader re-exports from this file instead.

const INCIDENT_TARGET_TYPES = [
  "system",
  "amenity",
  "space",
  "access",
  "property",
] as const;
export type IncidentTargetType = (typeof INCIDENT_TARGET_TYPES)[number];

const INCIDENT_SEVERITIES = ["low", "medium", "high"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

const IncidentCategorySchema = z
  .object({
    id: z.string().regex(/^ic\.[a-z_]+$/, {
      message: "incident category id must match `ic.<snake_case>`",
    }),
    label: z.string().min(1),
    description: z.string().min(1),
    guestLabel: z.string().min(1),
    icon: z.string().min(1),
    defaultSeverity: z.enum(INCIDENT_SEVERITIES),
    defaultTargetType: z.enum(INCIDENT_TARGET_TYPES),
  })
  .strict();

const IncidentCategoriesFileSchema = z
  .object({
    file: z.string(),
    version: z.string(),
    locale: z.string(),
    units_system: z.string(),
    items: z.array(IncidentCategorySchema).min(1),
  })
  .strict();

export type IncidentCategory = z.infer<typeof IncidentCategorySchema>;
export type IncidentCategoriesFile = z.infer<
  typeof IncidentCategoriesFileSchema
>;

function loadIncidentCategories(): IncidentCategoriesFile {
  const parsed = IncidentCategoriesFileSchema.safeParse(incidentCategoriesJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid taxonomies/incident_categories.json:\n${details}`);
  }
  const ids = parsed.data.items.map((i) => i.id);
  const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate incident category ids: ${Array.from(new Set(duplicates)).join(", ")}`,
    );
  }
  return parsed.data;
}

export const incidentCategories: IncidentCategoriesFile =
  loadIncidentCategories();

const INCIDENT_CATEGORY_BY_ID: ReadonlyMap<string, IncidentCategory> = new Map(
  incidentCategories.items.map((item) => [item.id, item]),
);

export function findIncidentCategory(id: string): IncidentCategory | undefined {
  return INCIDENT_CATEGORY_BY_ID.get(id);
}

export function isIncidentCategoryKey(id: string): boolean {
  return INCIDENT_CATEGORY_BY_ID.has(id);
}
