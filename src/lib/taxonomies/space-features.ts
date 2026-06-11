import type {
  SpaceFeatureGroup,
  SpaceFeaturesFile,
} from "../types/taxonomy";
import spaceFeaturesJson from "../../../taxonomies/space_features.json";

const raw = spaceFeaturesJson as unknown as SpaceFeaturesFile;

/**
 * Resolve `include_fields_from` references: a group can mirror another
 * group's field catalog (single source of truth — e.g. sfg.ensuite_bathroom
 * reuses sfg.bathroom_fixtures). Included fields without a `shown_if` get the
 * group's `include_gate` injected; fields with their own `shown_if` keep it —
 * the editor cascades visibility through their (gated) trigger field.
 */
function resolveIncludes(groups: SpaceFeatureGroup[]): SpaceFeatureGroup[] {
  return groups.map((g) => {
    if (!g.include_fields_from) return g;
    const source = groups.find((x) => x.id === g.include_fields_from);
    if (!source) {
      throw new Error(
        `space_features: group ${g.id} includes fields from unknown group ${g.include_fields_from}`,
      );
    }
    const gate = g.include_gate;
    const included = source.fields.map((f) =>
      f.shown_if || !gate ? f : { ...f, shown_if: gate },
    );
    return { ...g, fields: [...g.fields, ...included] };
  });
}

export const spaceFeatures: SpaceFeaturesFile = {
  ...raw,
  groups: resolveIncludes(raw.groups),
};

export function getSpaceFeatureGroups(spaceTypeId: string): SpaceFeatureGroup[] {
  return spaceFeatures.groups.filter(
    (g) => g.applies_to.includes("*") || g.applies_to.includes(spaceTypeId),
  );
}
