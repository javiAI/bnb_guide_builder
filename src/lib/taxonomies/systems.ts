import type {
  SystemGroup,
  SystemTaxonomyFile,
} from "../types/taxonomy";
import systemTaxonomyJson from "../../../taxonomies/system_taxonomy.json";

export const systemTaxonomy =
  systemTaxonomyJson as unknown as SystemTaxonomyFile;

export function getSystemGroups(): SystemGroup[] {
  return systemTaxonomy.groups;
}
