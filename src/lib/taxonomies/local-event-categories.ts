// Re-export from the canonical loader so every consumer goes through the
// eager Zod validation in `taxonomy-loader.ts` (id pattern + duplicate-check
// at boot). See `local-place-categories.ts` for the full rationale.
export {
  localEventCategories,
  findLocalEventCategory,
  isLocalEventCategoryKey,
} from "@/lib/taxonomy-loader";
export type {
  LocalEventCategory,
  LocalEventCategoriesFile,
} from "@/lib/taxonomy-loader";
