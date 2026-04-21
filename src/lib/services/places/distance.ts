const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance in meters between two WGS-84 coordinates.
 * Accuracy is sufficient for POI proximity display (< 10 km typical); the
 * spherical approximation introduces ≤ 0.5% error versus WGS-84 ellipsoid. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/** Human-readable distance label used across host UI (autocomplete suggestions,
 * picked preview, local-place card). Metric-only — the project's units rule. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
