import type { ItemTaxonomyFile } from "../types/taxonomy";
import spanishProvincesJson from "../../../taxonomies/spanish_provinces.json";

export const spanishProvinces =
  spanishProvincesJson as unknown as ItemTaxonomyFile;
