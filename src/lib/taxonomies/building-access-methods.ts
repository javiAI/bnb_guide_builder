import type { ItemTaxonomyFile } from "../types/taxonomy";
import buildingAccessMethodsJson from "../../../taxonomies/building_access_methods.json";

export const buildingAccessMethods =
  buildingAccessMethodsJson as unknown as ItemTaxonomyFile;
