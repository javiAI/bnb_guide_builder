/**
 * Coarse distance buckets for public-guest / AI surfaces.
 *
 * Rationale — triangulation attack surface (Rama 13C):
 *   Property.latitude/longitude is scrubbed from the public payload, but exact
 *   `distanceMeters` on three or more local pins lets a client intersect three
 *   circles and recover the anchor to meter-level precision. Coarse buckets
 *   destroy that precision while preserving the "is it near or far?" signal
 *   guests actually care about.
 *
 * The bucket ladder (<200m, 200–500m, 500m–1km, >1km) is wide enough that a
 * three-pin triangulation returns an area on the order of a city block, which
 * is the same resolution as the obfuscated anchor disk itself — an attacker
 * gains no new information beyond the disk we already render.
 *
 * `distanceMeters` exact values are still emitted at `visibility: "internal"`
 * for host/ops dashboards; this helper is only for guest/ai.
 */

export type DistanceBucketKey = "lt200m" | "200_500m" | "500m_1km" | "gt1km";

interface DistanceBucketDef {
  key: DistanceBucketKey;
  /** Upper bound in meters, exclusive. `null` = unbounded (final bucket). */
  maxMeters: number | null;
  /** Spanish label for guest UI. */
  label: string;
}

export const DISTANCE_BUCKETS: readonly DistanceBucketDef[] = [
  { key: "lt200m", maxMeters: 200, label: "Menos de 200 m" },
  { key: "200_500m", maxMeters: 500, label: "Entre 200 m y 500 m" },
  { key: "500m_1km", maxMeters: 1000, label: "Entre 500 m y 1 km" },
  { key: "gt1km", maxMeters: null, label: "Más de 1 km" },
] as const;

const BUCKET_BY_KEY: Record<DistanceBucketKey, DistanceBucketDef> =
  Object.fromEntries(DISTANCE_BUCKETS.map((b) => [b.key, b])) as Record<
    DistanceBucketKey,
    DistanceBucketDef
  >;

/** Classify exact meters into a coarse bucket. Negative / NaN inputs clamp to
 * the closest bucket — callers shouldn't pass those, but the helper stays
 * total to keep map rendering safe when a provider misbehaves. */
export function bucketizeDistance(meters: number): DistanceBucketKey {
  if (!Number.isFinite(meters) || meters < 0) return "lt200m";
  for (const bucket of DISTANCE_BUCKETS) {
    if (bucket.maxMeters === null) return bucket.key;
    if (meters < bucket.maxMeters) return bucket.key;
  }
  // Unreachable — the final bucket has maxMeters=null which returns above.
  return "gt1km";
}

export function distanceBucketLabel(key: DistanceBucketKey): string {
  return BUCKET_BY_KEY[key].label;
}
