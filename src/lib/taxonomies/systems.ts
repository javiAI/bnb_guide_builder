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

/** Building/property-infrastructure systems that never belong to a single
 * room — excluded from per-space coverage everywhere (an elevator is the
 * building's, refuse collection is the property's). Single source for the
 * Spaces grid and the system-detail coverage section. */
export const SPACE_SYSTEM_BLACKLIST: ReadonlySet<string> = new Set(["sys.elevator", "sys.garbage"]);
