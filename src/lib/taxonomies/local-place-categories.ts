import { z } from "zod";
import localPlaceCategoriesJson from "../../../taxonomies/local_place_categories.json";

// Self-contained per-domain module: owns its JSON import + Zod schema + boot
// validation. Must NOT import `@/lib/taxonomy-loader` — doing so would drag the
// full loader (every taxonomy JSON) into any client bundle that touches local
// place categories. The central loader re-exports from this file instead.

const LocalPlaceCategorySchema = z
  .object({
    id: z.string().regex(/^lp\.[a-z][a-z0-9_]*$/, {
      message: "local place category id must match `lp.<slug>`",
    }),
    label: z.string().min(1),
    description: z.string().min(1),
    guestLabel: z.string().min(1).optional(),
    guestDescription: z.string().min(1).optional(),
    icon: z.string().min(1).optional(),
    recommended: z.boolean().optional(),
  })
  .strict();

const LocalPlaceCategoriesFileSchema = z
  .object({
    file: z.string(),
    version: z.string(),
    locale: z.string(),
    units_system: z.string(),
    items: z.array(LocalPlaceCategorySchema).min(1),
  })
  .strict();

export type LocalPlaceCategory = z.infer<typeof LocalPlaceCategorySchema>;
export type LocalPlaceCategoriesFile = z.infer<
  typeof LocalPlaceCategoriesFileSchema
>;

function loadLocalPlaceCategories(): LocalPlaceCategoriesFile {
  const parsed = LocalPlaceCategoriesFileSchema.safeParse(
    localPlaceCategoriesJson,
  );
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid taxonomies/local_place_categories.json:\n${details}`,
    );
  }
  const ids = parsed.data.items.map((i) => i.id);
  const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate local place category ids: ${Array.from(new Set(duplicates)).join(", ")}`,
    );
  }
  return parsed.data;
}

export const localPlaceCategories: LocalPlaceCategoriesFile =
  loadLocalPlaceCategories();

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
