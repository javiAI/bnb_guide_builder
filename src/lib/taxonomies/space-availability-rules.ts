import type { SpaceAvailabilityRulesFile } from "../types/taxonomy";
import spaceAvailabilityRulesJson from "../../../taxonomies/space_availability_rules.json";

export const spaceAvailabilityRules =
  spaceAvailabilityRulesJson as unknown as SpaceAvailabilityRulesFile;
