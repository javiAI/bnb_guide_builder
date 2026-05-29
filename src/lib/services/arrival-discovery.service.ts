import {
  haversineMeters,
  resolveLocalPoiProvider,
  type PoiSuggestion,
  type ProviderMetadata,
} from "./places";

// ── Arrival-mode discovery (16E.6) ──
//
// Intercity-only pipeline. Provider search + native-category re-bucketing +
// per-mode distance caps serve the S02 "how the guest reaches the city"
// modes: airport, train, bus. "car" is also intercity but routes through
// `parking-discovery.service`.
//
// Last-mile (metro, urban_bus, taxi, walk) is intentionally NOT part of this
// service. The guest gets a directional Google/Apple Maps deep link from the
// confirmed arrival point to the property — that covers public transit and
// walking without a parallel discovery pipeline. See FUTURE.md for the
// deferred taxi-as-first-class extension.
//
// `DISCOVERABLE_MODES` is the union of discoverable intercity modes minus
// car (parking-discovery handles it). The per-mode tables below are keyed
// by it.

// Shared discovery limits across parking + arrival pipelines. Both surface
// at most 8 suggestions and warn when the post-filter pool falls below 4 —
// the spec floor for "Pocos resultados". Provider limit (10) leaves headroom
// for filter/dedupe shrinkage.
export const DISCOVERY_HARD_CAP = 8;
export const DISCOVERY_SOFT_WARNING_FLOOR = 4;
export const DISCOVERY_PROVIDER_LIMIT = 10;

export const INTERCITY_MODES = ["airport", "train", "bus", "car"] as const;
export type IntercityMode = (typeof INTERCITY_MODES)[number];

/** Modes that have a POI-discovery pipeline (can produce pins via search).
 * Excludes `car` (parking-discovery handles it). Last-mile modes
 * (metro/urban_bus/taxi/walk) are out of scope — the directional deep link
 * from the arrival point to the property covers them without a parallel
 * pipeline. */
export const DISCOVERABLE_MODES = ["airport", "train", "bus"] as const;
export type DiscoverableMode = (typeof DISCOVERABLE_MODES)[number];

/** Alias retained so cache-key serialization / call sites keep reading the
 * same name. `ARRIVAL_MODES` is the operator-facing label; `DiscoverableMode`
 * is the internal type. */
export type ArrivalMode = DiscoverableMode;
export const ARRIVAL_MODES = DISCOVERABLE_MODES;

// Broad patterns — match OSM/MapTiler native categories (English) plus common
// variants. Provider returns `lp.transport` for almost any transit POI; we
// re-bucket per mode by matching against `nativeCategory` and `placeTypes`.
const DISCOVERY_PATTERNS: Record<DiscoverableMode, RegExp> = {
  train:
    /^(train_station|railway_station|railway|transit_station|train|rail|rail_station)$/i,
  bus: /^(bus_station|coach_station)$/i,
  airport: /^(airport|aerodrome|airfield|international_airport|heliport)$/i,
};

// Name-based fallback. MapTiler routinely returns Spanish-region transit POIs
// with `properties.categories: ["transport"]` (or no category at all) — the
// generic bucket maps to `lp.transport` cleanly, but the strict native-cat
// regex above then drops every train station / bus terminal / airport because
// "transport" doesn't match `train_station`. Without this fallback the
// "Sugeridos" column stayed empty for rural Spain and most MapTiler regions.
//
// Each pattern is disjoint from the others (negative lookaheads on cross-mode
// keywords) so a bus station's name never gets bucketed under train, etc.
// Tested against Renfe / Atocha / Avilés / Barajas / Sants spelling variants
// in arrival-discovery.test.ts.
const NAME_FALLBACK_PATTERNS: Record<DiscoverableMode, RegExp> = {
  // Train: explicit train keywords, excluding bus terms in the same string.
  train:
    /^(?!.*(autob[uú]s|\bbus\b|coach|aeropuerto|airport|metro|tranv[ií]a|tram|taxi))(?=.*(\btren\b|\btrain\b|renfe|ferrocarril|railway|\brail\b|cercan[ií]as|\bave\b|estaci[oó]n)).+/i,
  // Bus: intercity bus terminal — distinguished from urban bus stop by
  // requiring "estación" / "terminal" / explicit "bus station".
  bus: /^(?!.*(tren|train|renfe|ferrocarril|aeropuerto|airport|metro|tranv[ií]a|tram|taxi))(?=.*((estaci[oó]n|terminal).*(autob[uú]s|bus|coach)|bus.?(station|terminal)|coach.?station)).+/i,
  // Airport: aeropuerto / airport / aerodrome variants.
  airport:
    /(aeropuerto|airport|aerodrome|airfield|aeroport|aeroport)/i,
};

// Discovery queries — MapTiler `/geocoding` is a forward geocoder (text →
// features), not a category-based Places API. The query string is what
// surfaces candidate POIs near the anchor; their `properties.categories`
// then decides the bucket. Empirically (probed against Madrid):
//
//   • English keywords yield clean, proximity-biased transit results for
//     train ("train station" → Atocha + Cercanías) and bus ("bus station"
//     → Méndez Álvaro, Príncipe Pío, Moncloa intercambiadores).
//   • Spanish "estación de tren" returns globally scattered hits (Namibia,
//     Iraq) before local ones — proximity bias is weak for tokenized
//     Spanish phrases.
//   • For airport, Spanish "aeropuerto" wins decisively: it returns Barajas
//     with `aerodrome` category, while English "airport" returns mostly
//     parking lots tagged with "airport" in their name.
//
// The frontend always displays results in Spanish; backend queries pick
// whatever language returns the best POI set per mode. Spanish synonyms
// for train/bus stay as fallbacks because some Spanish-language MapTiler
// regions (rural, smaller cities) only match Spanish phrasing.
const DISCOVERY_QUERIES: Record<DiscoverableMode, readonly string[]> = {
  train: ["train station", "railway station", "estación de tren"],
  bus: ["bus station", "estación de autobuses", "estación de autobús"],
  airport: ["aeropuerto", "airport"],
};

/** Global default search radius (meters) used when the caller doesn't pass an
 * explicit `radiusMeters`. 30 km is the operator-facing default in the cockpit
 * — wide enough for most intercity train / bus stations, while still excluding
 * irrelevant distant POIs. The operator can override per-search via the radius
 * selector in the cockpit (one shared value across modes). */
export const DEFAULT_DISCOVERY_RADIUS_M = 30_000;

/** Hard upper-bound on the per-search radius so a fat-fingered input can't
 * scan the entire continent and burn the provider quota. Matches the operator
 * cockpit selector's max value. */
export const MAX_DISCOVERY_RADIUS_M = 200_000;

/** Clamp a client-supplied radius to `[1, MAX_DISCOVERY_RADIUS_M]`. Both
 * discovery services route through this so the bound stays a single source
 * of truth even if the formula ever changes. */
export function clampDiscoveryRadius(radiusMeters: number): number {
  return Math.min(
    Math.max(1, Math.round(radiusMeters)),
    MAX_DISCOVERY_RADIUS_M,
  );
}

const DISCOVERY_CATEGORY_KEYS: Record<DiscoverableMode, string> = {
  train: "lp.arrival_train",
  bus: "lp.arrival_bus",
  airport: "lp.arrival_airport",
};

export function arrivalModeCategoryKey(mode: DiscoverableMode): string {
  return DISCOVERY_CATEGORY_KEYS[mode];
}

/** Slim arrival-option projection. `categoryKey` is implicit (always
 * `lp.arrival_<mode>`) and intentionally omitted to keep the action-side
 * `LocalPlace` create site explicit. `providerMetadata` is preserved so the
 * confirm action persists the upstream classification context. */
export interface ArrivalSuggestion {
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

export interface ArrivalDiscoveryParams {
  mode: DiscoverableMode;
  anchor: { latitude: number; longitude: number };
  language: "es" | "en";
  /** `providerPlaceId`s already persisted for this property + mode — caller
   * computes from DB so the service stays pure. */
  excludeProviderPlaceIds: ReadonlySet<string>;
  /** Search radius from the anchor, in meters. Single shared value across all
   * modes (operator-facing default `DEFAULT_DISCOVERY_RADIUS_M`). Clamped to
   * `[1, MAX_DISCOVERY_RADIUS_M]` to bound provider work. */
  radiusMeters?: number;
  signal?: AbortSignal;
}

export interface ArrivalDiscoveryResult {
  suggestions: ArrivalSuggestion[];
  /** `none` when provider returned zero matches for the mode; `few_results`
   * when pool size is below the soft floor; `null` when the pool is healthy. */
  warningKey: "none" | "few_results" | null;
  totalBeforeCap: number;
}

function matchesMode(suggestion: PoiSuggestion, mode: DiscoverableMode): boolean {
  const { providerMetadata } = suggestion;
  const pattern = DISCOVERY_PATTERNS[mode];
  const candidates = [
    providerMetadata.nativeCategory,
    ...(providerMetadata.placeTypes ?? []),
  ].filter((c): c is string => typeof c === "string" && c.length > 0);
  if (candidates.some((c) => pattern.test(c))) return true;

  // Fallback: when the provider classified the POI only under the broad
  // `lp.transport` bucket (real-world MapTiler behavior for many Spanish
  // regions) the strict per-mode native-cat regex rejects it. Recover by
  // matching against the place's own name — the query that surfaced this
  // hit was mode-targeted ("estación de tren"), so a name-keyword match is
  // a high-confidence signal even without a native category match.
  if (suggestion.categoryKey === "lp.transport") {
    return NAME_FALLBACK_PATTERNS[mode].test(suggestion.name);
  }
  return false;
}

export async function discoverArrivalSuggestions(
  params: ArrivalDiscoveryParams,
): Promise<ArrivalDiscoveryResult> {
  const provider = resolveLocalPoiProvider();
  const queries = DISCOVERY_QUERIES[params.mode];
  const distanceCap = clampDiscoveryRadius(
    params.radiusMeters ?? DEFAULT_DISCOVERY_RADIUS_M,
  );

  // Run the mode's queries in parallel — they're independent provider calls
  // that the caller waits on as a single unit. Halves wall time on modes
  // with 2–3 query variants. The shared `signal` aborts all in-flight calls.
  const rawResults = params.signal?.aborted
    ? []
    : await Promise.all(
        queries.map((query) =>
          provider.search({
            query,
            anchor: params.anchor,
            language: params.language,
            limit: DISCOVERY_PROVIDER_LIMIT,
            signal: params.signal,
          }),
        ),
      );

  const seen = new Set<string>();
  const pool: ArrivalSuggestion[] = [];
  for (const raw of rawResults) {
    for (const s of raw) {
      if (!matchesMode(s, params.mode)) continue;
      if (params.excludeProviderPlaceIds.has(s.providerPlaceId)) continue;
      if (seen.has(s.providerPlaceId)) continue;
      const distanceMeters = haversineMeters(params.anchor, {
        latitude: s.latitude,
        longitude: s.longitude,
      });
      if (distanceMeters > distanceCap) continue;
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
        providerMetadata: s.providerMetadata,
      });
    }
  }

  pool.sort((a, b) => a.distanceMeters - b.distanceMeters);
  const totalBeforeCap = pool.length;
  const suggestions = pool.slice(0, DISCOVERY_HARD_CAP);
  const warningKey: ArrivalDiscoveryResult["warningKey"] =
    totalBeforeCap === 0
      ? "none"
      : totalBeforeCap < DISCOVERY_SOFT_WARNING_FLOOR
        ? "few_results"
        : null;

  return { suggestions, warningKey, totalBeforeCap };
}
