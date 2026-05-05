import type { ItemTaxonomyFile } from "../types/taxonomy";
import parkingOptionsJson from "../../../taxonomies/parking_options.json";

export const parkingOptions = parkingOptionsJson as unknown as ItemTaxonomyFile;
