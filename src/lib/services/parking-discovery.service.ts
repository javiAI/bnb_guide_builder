import {
  haversineMeters,
  resolveLocalPoiProvider,
  type ProviderMetadata,
} from "./places";
import {
  clampDiscoveryRadius,
  DEFAULT_DISCOVERY_RADIUS_M,
  DISCOVERY_HARD_CAP,
  DISCOVERY_PROVIDER_LIMIT,
  DISCOVERY_SOFT_WARNING_FLOOR,
} from "./arrival-discovery.service";

export const PARKING_CATEGORY_KEY = "lp.parking";
const SEARCH_QUERY = "parking";

/** Slim parking-only projection of `PoiSuggestion`. `categoryKey` is implicit
 * (always `lp.parking`) and intentionally omitted to keep the action-side
 * `LocalPlace` create site explicit about the constant. `providerMetadata` is
 * preserved on the wire because the confirm action persists it onto the
 * `LocalPlace` row — guest leak prevention happens at the `composeGuide`
 * boundary (see `parking-leak-invariants.test.ts`), not at this service. */
export interface ParkingSuggestion {
  provider: string;
  providerPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  website: string | null;
  distanceMeters: number;
  /** Provider-emitted fee hint, when the upstream can determine it. `null`
   * means "unknown" — operator picks at confirm time. MapTiler always emits
   * `null`; Google Places / OSM Overpass can populate it. */
  parkingFee: "free" | "paid" | null;
  providerMetadata: ProviderMetadata;
}

export interface ParkingDiscoveryParams {
  anchor: { latitude: number; longitude: number };
  language: "es" | "en";
  /** `providerPlaceId`s already persisted as `LocalPlace` rows for this
   * property — caller computes from DB so the service stays pure. */
  excludeProviderPlaceIds: ReadonlySet<string>;
  /** Search radius from the anchor, in meters. Single shared value across all
   * cockpit discovery (parking + arrival modes). Clamped to
   * `[1, MAX_DISCOVERY_RADIUS_M]`. */
  radiusMeters?: number;
  signal?: AbortSignal;
}

export interface ParkingDiscoveryResult {
  suggestions: ParkingSuggestion[];
  /** `"few_results"` when the post-filter / post-dedupe pool is below
   * `DISCOVERY_SOFT_WARNING_FLOOR`. `null` otherwise. */
  warningKey: "few_results" | null;
  /** Pool size after filter + dedupe but before the hard cap. Lets the UI
   * show "+N más sugerencias ocultas" if the cap bites. */
  totalBeforeCap: number;
}

export async function discoverParkingSuggestions(
  params: ParkingDiscoveryParams,
): Promise<ParkingDiscoveryResult> {
  const provider = resolveLocalPoiProvider();
  const radiusMeters = clampDiscoveryRadius(
    params.radiusMeters ?? DEFAULT_DISCOVERY_RADIUS_M,
  );
  const raw = await provider.search({
    query: SEARCH_QUERY,
    anchor: params.anchor,
    language: params.language,
    limit: DISCOVERY_PROVIDER_LIMIT,
    signal: params.signal,
  });

  const seen = new Set<string>();
  const pool: ParkingSuggestion[] = [];
  for (const s of raw) {
    if (s.categoryKey !== PARKING_CATEGORY_KEY) continue;
    if (params.excludeProviderPlaceIds.has(s.providerPlaceId)) continue;
    if (seen.has(s.providerPlaceId)) continue;
    const distanceMeters = haversineMeters(params.anchor, {
      latitude: s.latitude,
      longitude: s.longitude,
    });
    if (distanceMeters > radiusMeters) continue;
    seen.add(s.providerPlaceId);
    pool.push({
      provider: s.provider,
      providerPlaceId: s.providerPlaceId,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      address: s.address ?? null,
      website: s.website ?? null,
      distanceMeters,
      parkingFee: s.parkingFee ?? null,
      providerMetadata: s.providerMetadata,
    });
  }

  pool.sort((a, b) => a.distanceMeters - b.distanceMeters);
  const totalBeforeCap = pool.length;
  const suggestions = pool.slice(0, DISCOVERY_HARD_CAP);
  const warningKey: ParkingDiscoveryResult["warningKey"] =
    totalBeforeCap < DISCOVERY_SOFT_WARNING_FLOOR ? "few_results" : null;

  return { suggestions, warningKey, totalBeforeCap };
}
