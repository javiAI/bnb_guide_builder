import type { ItemTaxonomyFile } from "../types/taxonomy";
import propertyTypesJson from "../../../taxonomies/property_types.json";

export const propertyTypes = propertyTypesJson as unknown as ItemTaxonomyFile;
