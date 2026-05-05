// Re-export from the canonical loader so every consumer goes through the
// eager Zod validation in `taxonomy-loader.ts` (id pattern, severity/target
// enum check, duplicate-id rejection). See `local-place-categories.ts` for
// the full rationale.
export {
  incidentCategories,
  findIncidentCategory,
  isIncidentCategoryKey,
} from "@/lib/taxonomy-loader";
export type {
  IncidentCategory,
  IncidentCategoriesFile,
  IncidentTargetType,
  IncidentSeverity,
} from "@/lib/taxonomy-loader";
