import type { ItemTaxonomyFile } from "../types/taxonomy";
import troubleshootingTaxonomyJson from "../../../taxonomies/troubleshooting_taxonomy.json";

export const troubleshootingTaxonomy =
  troubleshootingTaxonomyJson as unknown as ItemTaxonomyFile;
