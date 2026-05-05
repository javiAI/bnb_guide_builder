import type { SpaceTypeItem, SpaceTypesTaxonomyFile } from "../types/taxonomy";
import spaceTypesJson from "../../../taxonomies/space_types.json";

export const spaceTypes = spaceTypesJson as unknown as SpaceTypesTaxonomyFile;

const _spaceTypesById: ReadonlyMap<string, SpaceTypeItem> = new Map(
  spaceTypes.items.map((s) => [s.id, s]),
);

export function getSpaceTypeItem(id: string): SpaceTypeItem | undefined {
  return _spaceTypesById.get(id);
}
