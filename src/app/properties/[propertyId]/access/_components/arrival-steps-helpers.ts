/** Pure helpers for paso 01 — Cómo llegar. Kept in a separate module so
 * test files (and any other plain-TS consumer) can import them without
 * pulling in MapLibre / React via arrival-steps-editor.tsx. */

/** Top-level arrival modes. Mirrors section-2's intercity selectors: only
 * "how the guest reached the city" — `coche`, `train`, `bus`, `airport`.
 * Last-mile modes (metro/urban_bus/taxi/walk) don't appear here; the per-item
 * directional deep link (item → property) covers public transit + walking. */
export type ArrivalTabKey = "coche" | "train" | "bus" | "airport";

/** Intercity transit modes — every tab key except `coche`. Reused by the
 * editor to narrow `ArrivalTransitOption.mode` at the boundary where it
 * builds per-mode lists. */
export type IntercityMode = "train" | "bus" | "airport";
const INTERCITY_MODES: ReadonlySet<string> = new Set<IntercityMode>([
  "train",
  "bus",
  "airport",
]);
export function isIntercityMode(mode: string): mode is IntercityMode {
  return INTERCITY_MODES.has(mode);
}

/** Tier shape for paid-parking pricing. Canonical definition lives in the
 * shared Zod schema (`@/lib/schemas/rate-tier.schema`); re-exported here so
 * existing imports through `arrival-steps-helpers` keep working without
 * forcing every consumer to retarget the import. */
export {
  RATE_TIER_PERS,
  type RateTier,
  type RateTierPer,
} from "@/lib/schemas/rate-tier.schema";

export interface ArrivalParkingPlaceShape {
  id: string;
  latitude: number | null;
  longitude: number | null;
  feeType: "free" | "paid" | null;
}

export interface ArrivalTransitOptionShape {
  id: string;
  mode: "train" | "bus" | "airport" | "metro" | "urban_bus" | "taxi";
}

/** Canonical tab order for paso 01: coche → tren → bus → avión. */
export const TAB_KEYS_ORDER: readonly ArrivalTabKey[] = [
  "coche",
  "train",
  "bus",
  "airport",
];

/** Visible tabs = canonical order filtered to modes that have ≥1 option AND
 * are enabled in section-2. `enabledModes` keys map: `coche` ↔ `parking`,
 * everything else identity. When `enabledModes` is undefined the filter
 * degrades to "has options" only (back-compat for callers that don't thread
 * the section-2 enable state). */
export function computeVisibleTabs(
  parkingPlaces: readonly ArrivalParkingPlaceShape[],
  arrivalOptions: readonly ArrivalTransitOptionShape[],
  enabledModes?: Partial<Record<"parking" | "train" | "bus" | "airport", boolean>>,
): ArrivalTabKey[] {
  return TAB_KEYS_ORDER.filter((key) => {
    const enabledKey = key === "coche" ? "parking" : key;
    if (enabledModes && enabledModes[enabledKey] !== true) return false;
    if (key === "coche") return parkingPlaces.length > 0;
    return arrivalOptions.some((o) => o.mode === key);
  });
}

/** Google Maps "directions" deeplink with a coordinate destination. Used by
 * the paso 01 header (property anchor): operator/guest's current location →
 * property. */
export function gMapsDestHref(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

/** Apple Maps "drive to" deeplink with a coordinate destination. iOS routes to
 * the native app; other platforms fall back to maps.apple.com. */
export function appleMapsDestHref(latitude: number, longitude: number): string {
  return `https://maps.apple.com/?daddr=${latitude},${longitude}`;
}

/** Google Maps directions deeplink with both origin and destination — the
 * "last mile" link: from an arrival point (parking lot, train station, etc.)
 * to the property. Maps surfaces driving + transit + walking automatically. */
export function gMapsDirHref(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}`;
}

/** Apple Maps directions deeplink with both origin (saddr) and destination
 * (daddr) — same "last mile" semantics as `gMapsDirHref`. */
export function appleMapsDirHref(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): string {
  return `https://maps.apple.com/?saddr=${originLat},${originLng}&daddr=${destLat},${destLng}`;
}

/** Google Maps directions with a single waypoint between current location and
 * destination — covers the driving case end-to-end: user wherever they are →
 * parking → property. Origin is omitted on purpose so Google falls back to the
 * device's current location. */
export function gMapsViaHref(
  waypointLat: number,
  waypointLng: number,
  destLat: number,
  destLng: number,
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&waypoints=${waypointLat},${waypointLng}`;
}

/** Apple Maps multi-stop directions: current location → waypoint → destination.
 * Apple's URL scheme chains stops with `+to:` in `daddr`; omitting `saddr`
 * falls back to the device location. */
export function appleMapsViaHref(
  waypointLat: number,
  waypointLng: number,
  destLat: number,
  destLng: number,
): string {
  return `https://maps.apple.com/?daddr=${waypointLat},${waypointLng}+to:${destLat},${destLng}`;
}

/** Parse the methodId tail out of a media usageKey.
 *
 *   access.<cockpit>                 → null      (cover scope)
 *   access.<cockpit>.<methodId>      → "<methodId>"   (methodIds may contain a dot, e.g. `am.smart_lock`)
 *   access.<cockpit>.live-map        → "live-map"     (synthetic; callers gate on slide.kind upstream)
 *   <anything else>                  → null
 *
 * Returns null for non-method keys so callers can early-return without
 * threading shape checks. Shared between the subsystem-card filter and the
 * arrival-steps editor (both filter slides by selected methodIds). */
export function methodIdFromUsageKey(usageKey: string): string | null {
  const segs = usageKey.split(".");
  if (segs.length < 3 || segs[0] !== "access") return null;
  return segs.slice(2).join(".");
}
