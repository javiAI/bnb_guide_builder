import { getSpaceFeatureGroups } from "@/lib/taxonomies/space-features";
import { getSpaceTypeItem } from "@/lib/taxonomies/space-types";
import type { SpaceFeatureGroup } from "@/lib/types/taxonomy";

export type SpaceProgressLevel = "none" | "partial" | "complete";

export type FeatureValue = string | number | boolean | string[] | null;
export type FeatureState = Record<string, FeatureValue>;

/**
 * Deterministic per-space completeness signal shared by the SpaceCard (live,
 * client) and SpacesPage (aggregate, server). Pure — no React, runs in both
 * environments.
 *
 * - `none`     → no feature filled and no beds.
 * - `partial`  → some content but not every non-dimension group has data.
 * - `complete` → at least one field filled per non-dimension feature group
 *                (or beds present when the space has no content groups).
 */
export function computeProgressDot(
  features: FeatureState,
  featureGroups: SpaceFeatureGroup[],
  hasBeds: boolean,
  bedCount: number,
): SpaceProgressLevel {
  const filledFeatures = Object.values(features).filter(
    (v) => v !== null && v !== false && v !== "" && !(Array.isArray(v) && v.length === 0),
  ).length;

  const hasAny = filledFeatures > 0 || (hasBeds && bedCount > 0);
  if (!hasAny) return "none";

  // "complete" = at least one field filled per non-dimensions group
  const contentGroups = featureGroups.filter((g) => g.id !== "sfg.dimensions");
  if (contentGroups.length === 0) return hasBeds && bedCount > 0 ? "complete" : "partial";

  const groupsWithData = contentGroups.filter((g) =>
    g.fields.some((f) => {
      const v = features[f.id];
      return v !== null && v !== undefined && v !== false && v !== "" && !(Array.isArray(v) && v.length === 0);
    }),
  );
  if (groupsWithData.length >= contentGroups.length) return "complete";
  return "partial";
}

/**
 * Convenience wrapper that resolves the feature groups + sleeping affordance
 * from the taxonomy. Used by the server (page aggregate) where only the stored
 * `featuresJson` + bed count are available.
 */
export function resolveSpaceProgress(
  spaceType: string,
  features: FeatureState,
  bedCount: number,
): SpaceProgressLevel {
  const featureGroups = getSpaceFeatureGroups(spaceType);
  const hasBeds = (getSpaceTypeItem(spaceType)?.allowsSleeping ?? false) || bedCount > 0;
  return computeProgressDot(features, featureGroups, hasBeds, bedCount);
}

/** Maps a progress level to the deterministic bar width used in the card foot. */
export const PROGRESS_PERCENT: Record<SpaceProgressLevel, number> = {
  none: 0,
  partial: 50,
  complete: 100,
};
