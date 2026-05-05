import type { ItemTaxonomyFile } from "../types/taxonomy";
import accessMethodsJson from "../../../taxonomies/access_methods.json";

export const accessMethods = accessMethodsJson as unknown as ItemTaxonomyFile;
