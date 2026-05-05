import { z } from "zod";
import localEventCategoriesJson from "../../../taxonomies/local_event_categories.json";

// Self-contained per-domain module: owns its JSON import + Zod schema + boot
// validation. Must NOT import `@/lib/taxonomy-loader` — doing so would drag the
// full loader (every taxonomy JSON) into any client bundle that touches local
// event categories. The central loader re-exports from this file instead.

const LocalEventCategorySchema = z
  .object({
    id: z.string().regex(/^le\.[a-z][a-z0-9_]*$/, {
      message: "local event category id must match `le.<slug>`",
    }),
    label: z.string().min(1),
    description: z.string().min(1),
    guestLabel: z.string().min(1).optional(),
    guestDescription: z.string().min(1).optional(),
    icon: z.string().min(1).optional(),
    recommended: z.boolean().optional(),
  })
  .strict();

const LocalEventCategoriesFileSchema = z
  .object({
    file: z.string(),
    version: z.string(),
    locale: z.string(),
    units_system: z.string(),
    items: z.array(LocalEventCategorySchema).min(1),
  })
  .strict();

export type LocalEventCategory = z.infer<typeof LocalEventCategorySchema>;
export type LocalEventCategoriesFile = z.infer<
  typeof LocalEventCategoriesFileSchema
>;

function loadLocalEventCategories(): LocalEventCategoriesFile {
  const parsed = LocalEventCategoriesFileSchema.safeParse(
    localEventCategoriesJson,
  );
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid taxonomies/local_event_categories.json:\n${details}`,
    );
  }
  const ids = parsed.data.items.map((i) => i.id);
  const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate local event category ids: ${Array.from(new Set(duplicates)).join(", ")}`,
    );
  }
  return parsed.data;
}

export const localEventCategories: LocalEventCategoriesFile =
  loadLocalEventCategories();

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
