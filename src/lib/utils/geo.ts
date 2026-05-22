/** Meters per degree of latitude — equirectangular approximation, accurate
 * to sub-meter levels at the radii we render (≤200 km). */
export const METERS_PER_DEG_LAT = 111_320;

/** Approximate a circle on the Earth's surface as a closed GeoJSON polygon
 * of `steps` segments. Uses the equirectangular approximation — fine for
 * rendering, not for precise filtering. The ring is closed: the last
 * coordinate equals the first. */
export function buildCirclePolygon(
  center: { latitude: number; longitude: number },
  radiusMeters: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const metersPerDegLngHere =
    METERS_PER_DEG_LAT * Math.cos((center.latitude * Math.PI) / 180);
  const coords: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const dLat = (radiusMeters * Math.sin(theta)) / METERS_PER_DEG_LAT;
    const dLng =
      metersPerDegLngHere === 0
        ? 0
        : (radiusMeters * Math.cos(theta)) / metersPerDegLngHere;
    coords.push([center.longitude + dLng, center.latitude + dLat]);
  }
  coords.push(coords[0]);
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: {},
  };
}
