import type { ItemTaxonomyFile } from "../types/taxonomy";
import accessibilityFeaturesJson from "../../../taxonomies/accessibility_features.json";

export const accessibilityFeatures =
  accessibilityFeaturesJson as unknown as ItemTaxonomyFile;
