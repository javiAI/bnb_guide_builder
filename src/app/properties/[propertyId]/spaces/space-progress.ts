import { getSpaceTypeItem } from "@/lib/taxonomies/space-types";

export type SpaceProgressLevel = "none" | "partial" | "complete";

export type FeatureValue = string | number | boolean | string[] | null;
export type FeatureState = Record<string, FeatureValue>;

/** True when at least one feature field carries a meaningful value. */
function hasAnyFeature(features: FeatureState): boolean {
  return Object.values(features).some(
    (v) => v !== null && v !== false && v !== "" && !(Array.isArray(v) && v.length === 0),
  );
}

/**
 * Guest-meaningful, transparent completeness for a space card. Three honest
 * signals — a cover photo, beds (only when the space is meant for sleeping),
 * and at least one descriptive detail:
 *
 *   - `none`     → none of the applicable signals present.
 *   - `partial`  → some but not all applicable signals present.
 *   - `complete` → every applicable signal present.
 *
 * No fake percentage: the old 0/50/100 buckets implied a granularity that
 * never existed and, worse, ignored whether the space even had a photo — the
 * first thing a guest sees on the card. Pure (no React) so it runs identically
 * on the server aggregate and the live client card.
 */
export function computeSpaceStatus(args: {
  features: FeatureState;
  isSleeping: boolean;
  bedCount: number;
  hasPhoto: boolean;
}): SpaceProgressLevel {
  const { features, isSleeping, bedCount, hasPhoto } = args;
  const signals: boolean[] = [hasPhoto, hasAnyFeature(features)];
  if (isSleeping) signals.push(bedCount > 0);

  const met = signals.filter(Boolean).length;
  if (met === 0) return "none";
  return met === signals.length ? "complete" : "partial";
}

/**
 * The unmet signals behind a non-complete status, as operator-facing labels —
 * surfaced on the status pill's hover so "En progreso" explains itself.
 * Mirrors computeSpaceStatus exactly: same signals, same applicability.
 */
export function missingSpaceSignals(args: {
  features: FeatureState;
  isSleeping: boolean;
  bedCount: number;
  hasPhoto: boolean;
}): string[] {
  const { features, isSleeping, bedCount, hasPhoto } = args;
  const missing: string[] = [];
  if (!hasPhoto) missing.push("una foto");
  if (isSleeping && bedCount === 0) missing.push("camas");
  if (!hasAnyFeature(features)) missing.push("algún detalle de la estancia");
  return missing;
}

/**
 * Convenience wrapper that resolves the sleeping affordance from the taxonomy.
 * Used by the server (page aggregate) where only the stored `featuresJson`,
 * bed count and photo count are available.
 */
export function resolveSpaceStatus(
  spaceType: string,
  features: FeatureState,
  bedCount: number,
  hasPhoto: boolean,
): SpaceProgressLevel {
  const isSleeping = (getSpaceTypeItem(spaceType)?.allowsSleeping ?? false) || bedCount > 0;
  return computeSpaceStatus({ features, isSleeping, bedCount, hasPhoto });
}
