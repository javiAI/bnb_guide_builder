import type {
  SpaceFeatureGroup,
  SpaceFeaturesFile,
} from "../types/taxonomy";
import spaceFeaturesJson from "../../../taxonomies/space_features.json";

export const spaceFeatures = spaceFeaturesJson as unknown as SpaceFeaturesFile;

export function getSpaceFeatureGroups(spaceTypeId: string): SpaceFeatureGroup[] {
  return spaceFeatures.groups.filter(
    (g) => g.applies_to.includes("*") || g.applies_to.includes(spaceTypeId),
  );
}
