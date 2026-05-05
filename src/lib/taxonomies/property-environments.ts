import type { ItemTaxonomyFile } from "../types/taxonomy";
import propertyEnvironmentsJson from "../../../taxonomies/property_environments.json";

export const propertyEnvironments =
  propertyEnvironmentsJson as unknown as ItemTaxonomyFile;
