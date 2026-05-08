import {
  haversineMeters,
  resolveLocalPoiProvider,
  type ProviderMetadata,
} from "./places";

// Hard cap on suggestions surfaced to the UI per branch 16E.6 spec.
const HARD_CAP = 8;
// When the post-filter / post-dedupe pool is below this floor we emit
// `warningKey: "few_results"` so the UI can hint "Pocos resultados — añade un
// pin manual". 4 is the spec threshold.
const SOFT_WARNING_FLOOR = 4;
// Provider limit. MapTiler caps at 10; headroom over HARD_CAP=8 covers the
// usual filter+dedupe shrinkage (a `parking` query returns mostly `lp.parking`
// so 2 of slack is normally enough — when it bites, the UI surfaces
// `warningKey: "few_results"`).
const PROVIDER_LIMIT = 10;

const PARKING_CATEGORY_KEY = "lp.parking";
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
  providerMetadata: ProviderMetadata;
}

export interface ParkingDiscoveryParams {
  anchor: { latitude: number; longitude: number };
  language: "es" | "en";
  /** `providerPlaceId`s already persisted as `LocalPlace` rows for this
   * property — caller computes from DB so the service stays pure. */
  excludeProviderPlaceIds: ReadonlySet<string>;
  signal?: AbortSignal;
}

export interface ParkingDiscoveryResult {
  suggestions: ParkingSuggestion[];
  /** `"few_results"` when the post-filter / post-dedupe pool is below
   * `SOFT_WARNING_FLOOR`. `null` otherwise. */
  warningKey: "few_results" | null;
  /** Pool size after filter + dedupe but before the hard cap. Lets the UI
   * show "+N más sugerencias ocultas" if the cap bites. */
  totalBeforeCap: number;
}

export async function discoverParkingSuggestions(
  params: ParkingDiscoveryParams,
): Promise<ParkingDiscoveryResult> {
  const provider = resolveLocalPoiProvider();
  const raw = await provider.search({
    query: SEARCH_QUERY,
    anchor: params.anchor,
    language: params.language,
    limit: PROVIDER_LIMIT,
    signal: params.signal,
  });

  const seen = new Set<string>();
  const pool: ParkingSuggestion[] = [];
  for (const s of raw) {
    if (s.categoryKey !== PARKING_CATEGORY_KEY) continue;
    if (params.excludeProviderPlaceIds.has(s.providerPlaceId)) continue;
    if (seen.has(s.providerPlaceId)) continue;
    seen.add(s.providerPlaceId);
    pool.push({
      provider: s.provider,
      providerPlaceId: s.providerPlaceId,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      address: s.address ?? null,
      website: s.website ?? null,
      distanceMeters: haversineMeters(params.anchor, {
        latitude: s.latitude,
        longitude: s.longitude,
      }),
      providerMetadata: s.providerMetadata,
    });
  }

  pool.sort((a, b) => a.distanceMeters - b.distanceMeters);
  const totalBeforeCap = pool.length;
  const suggestions = pool.slice(0, HARD_CAP);
  const warningKey: ParkingDiscoveryResult["warningKey"] =
    totalBeforeCap < SOFT_WARNING_FLOOR ? "few_results" : null;

  return { suggestions, warningKey, totalBeforeCap };
}
