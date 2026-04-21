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

  // Transport
  [
    /^(subway|metro_station|train_station|bus_station|bus_stop|tram_stop|taxi|ferry_terminal|railway_station|transit_station)$/i,
    "lp.transport",
  ],
  [/^(parking|parking_lot|parking_garage|car_park)$/i, "lp.parking"],

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

/** Resolve the first `lp.*` key matched by any candidate string, or `null`
 * when none match. Providers must NOT fall back to `lp.other` — the caller
 * decides whether unclassified results are dropped or parked under "other". */
export function mapMapTilerCategoryToLp(
  candidates: ReadonlyArray<string>,
): string | null {
  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    for (const [pattern, key] of MAPTILER_CATEGORY_PATTERNS) {
      if (pattern.test(trimmed)) return key;
    }
  }
  return null;
}
