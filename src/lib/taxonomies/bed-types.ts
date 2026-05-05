import type { ItemTaxonomyFile } from "../types/taxonomy";
import bedTypesJson from "../../../taxonomies/bed_types.json";

export const bedTypes = bedTypesJson as unknown as ItemTaxonomyFile;
