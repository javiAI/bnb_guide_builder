// MapTiler POI category + place_type strings → canonical `lp.*` taxonomy key.
//
// MapTiler returns categories in `feature.properties.categories` (array) and
// `feature.place_type` (array, usually `["poi"]`). The mapping runs over every
// candidate string and picks the first `lp.*` match. When no string maps, the
// provider drops the suggestion rather than synthesizing a raw key — the host
// can still add it manually.
//
// Priority: more-specific categories win over generic ones. Ordered keys in
// the map ensure `supermarket` beats `shop` when both appear.

type CategoryMap = ReadonlyArray<readonly [RegExp, string]>;

const MAPTILER_CATEGORY_PATTERNS: CategoryMap = [
  // Health first — never bucket a pharmacy as "shop"
  [/^pharmacy$/i, "lp.pharmacy"],
  [/^(hospital|clinic|doctor|health)$/i, "lp.hospital"],

  // Food + drink
  [/^restaurant$/i, "lp.restaurant"],
  [/^(cafe|coffee_shop|bakery|patisserie)$/i, "lp.cafe"],
  [/^(bar|pub|nightclub|biergarten)$/i, "lp.bar"],

  // Retail — supermarket before generic shop
  [/^(supermarket|grocery|convenience)$/i, "lp.supermarket"],

  // Transport — broad bucket; arrival-discovery service re-buckets per mode
  [
    /^(subway|subway_station|metro_station|metro|train_station|railway_station|rail_station|railway|rail|bus_station|bus_stop|bus|coach_station|public_transport|trolleybus_stop|tram_stop|tram|tram_station|light_rail|underground|taxi|taxi_stand|taxi_rank|ferry_terminal|transit_station|airport|aerodrome|airfield|international_airport|heliport)$/i,
    "lp.transport",
  ],
  [/^(parking|parking_lot|parking_garage|car_park|parking_space)$/i, "lp.parking"],

  // Leisure
  [
    /^(attraction|tourist_attraction|museum|monument|viewpoint|castle|landmark|theater|cinema|aquarium|zoo)$/i,
    "lp.attraction",
  ],
  [/^(beach|coast)$/i, "lp.beach"],
  [/^(park|garden|playground|nature_reserve)$/i, "lp.park"],
  [/^(gym|fitness_centre|fitness_center|sports_centre|sports_center)$/i, "lp.gym"],
  [/^(laundry|launderette|dry_cleaning)$/i, "lp.laundry"],
];

/** Normalize MapTiler category strings to OSM-style underscored form. The
 * geocoding endpoint returns `properties.categories` with spaces
 * (`"railway station"`, `"bus stop"`, `"bus station"`) while the regex map
 * above is keyed by OSM tags (`railway_station`, `bus_stop`, `bus_station`).
 * Without normalization, every real-world Spanish transit POI gets dropped
 * by the provider as unclassified. */
export function normalizeMapTilerCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, "_").toLowerCase();
}

/** Resolve the first `lp.*` key matched by any candidate string, or `null`
 * when none match. Providers must NOT fall back to `lp.other` — the caller
 * decides whether unclassified results are dropped or parked under "other".
 *
 * Callers must pass `normalizeMapTilerCategory()`-normalized inputs (lowercase,
 * underscores). The provider boundary normalizes once and reuses the result;
 * normalizing inside this mapper too would be wasted work and risk drift if
 * the boundary stops normalizing. */
export function mapMapTilerCategoryToLp(
  candidates: ReadonlyArray<string>,
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const [pattern, key] of MAPTILER_CATEGORY_PATTERNS) {
      if (pattern.test(candidate)) return key;
    }
  }
  return null;
}
