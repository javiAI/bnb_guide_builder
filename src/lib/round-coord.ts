/**
 * Snap a latitude/longitude to 6 decimal places (~0.1 m).
 *
 * Coordinates come from geocoding + the map at full float64 precision and
 * round-trip through `Float` DB columns with epsilon-level differences
 * (e.g. `-0.1452657580375671` vs `-0.14526575803756714`). Auto-save serialises
 * the form and treats those epsilons as real edits, re-saving in a loop. Snap
 * every coordinate at its set-point so the value is stable and re-applying the
 * same point is a no-op. 6 decimals is far finer than any map/address needs.
 */
export function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
