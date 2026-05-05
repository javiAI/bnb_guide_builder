import type { ItemTaxonomyFile } from "../types/taxonomy";
import visibilityLevelsJson from "../../../taxonomies/visibility_levels.json";

export const visibilityLevelsTaxonomy =
  visibilityLevelsJson as unknown as ItemTaxonomyFile;
