import {
  PoiProviderUnavailableError,
  PoiSuggestionSchema,
  type LocalPoiProvider,
  type PoiSuggestion,
  type ProviderMetadata,
  type ReverseGeoResult,
  type ReverseParams,
  type SearchParams,
} from "./provider";
import {
  mapMapTilerCategoryToLp,
  normalizeMapTilerCategory,
} from "./maptiler-category-mapping";
import { haversineMeters } from "./distance";

const MAPTILER_ENDPOINT = "https://api.maptiler.com/geocoding";

interface MapTilerFeature {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  center?: [number, number];
  geometry?: { coordinates?: [number, number] };
  relevance?: number;
  properties?: {
    categories?: string[];
    postcode?: string;
    website?: string;
    phone?: string;
  };
}

interface MapTilerGeocodingResponse {
  features?: MapTilerFeature[];
}

// Lower rank = more specific. Used by `reverse()` to prefer street/address
// features over city/region fallbacks when no `preferCategoryKey` matches.
// Keys are MapTiler's `place_type[0]` values (verified empirically — note
// `postal_code` not `postcode`, `municipality` not `place`).
const REVERSE_SPECIFICITY: Record<string, number> = {
  poi: 0,
  address: 1,
  street: 2,
  neighbourhood: 3,
  postal_code: 4,
  locality: 5,
  municipality: 6,
  place: 7,
  county: 8,
  subregion: 9,
  region: 10,
  country: 11,
  major_landform: 98,
  continental_marine: 99,
};

function reverseSpecificityRank(feature: MapTilerFeature): number {
  const primary = feature.place_type?.[0];
  if (!primary) return 99;
  return REVERSE_SPECIFICITY[primary] ?? 99;
}

export class MapTilerPlacesProvider implements LocalPoiProvider {
  readonly name = "maptiler";

  constructor(private readonly apiKey: string) {}

  async search(params: SearchParams): Promise<PoiSuggestion[]> {
    // MapTiler's geocoding endpoint rejects `limit > 10` with HTTP 400
    // (`querystring/limit must be <= 10`). Clamp here so callers can ask
    // for headroom without triggering an upstream validation error.
    const limit = Math.min(params.limit ?? 8, 10);
    const query = encodeURIComponent(params.query.trim());
    const { latitude, longitude } = params.anchor;
    const url =
      `${MAPTILER_ENDPOINT}/${query}.json?key=${this.apiKey}` +
      `&limit=${limit}` +
      `&language=${params.language}` +
      `&proximity=${longitude},${latitude}` +
      `&types=poi`;

    let data: MapTilerGeocodingResponse;
    try {
      const res = await fetch(url, { signal: params.signal });
      if (!res.ok) {
        throw new PoiProviderUnavailableError(
          `MapTiler returned ${res.status}`,
          this.name,
        );
      }
      data = (await res.json()) as MapTilerGeocodingResponse;
    } catch (err) {
      if (err instanceof PoiProviderUnavailableError) throw err;
      if ((err as { name?: string }).name === "AbortError") {
        throw err;
      }
      throw new PoiProviderUnavailableError(
        `MapTiler fetch failed: ${(err as Error).message}`,
        this.name,
      );
    }

    const retrievedAt = new Date().toISOString();
    const features = data.features ?? [];
    const suggestions: PoiSuggestion[] = [];

    for (const feature of features) {
      const mapped = this.mapFeature(feature, params.anchor, retrievedAt);
      if (!mapped) continue;
      const parsed = PoiSuggestionSchema.safeParse(mapped);
      if (!parsed.success) continue; // drop malformed — never surface invalid DTOs
      suggestions.push(parsed.data);
    }

    return suggestions;
  }

  async reverse(params: ReverseParams): Promise<ReverseGeoResult | null> {
    const { latitude, longitude, language, preferCategoryKey, signal } = params;
    // No `types=` filter and no `limit`: MapTiler reverse rejects `limit`
    // unless paired with exactly one `types` value (HTTP 400
    // `ERR_VALIDATION: Parameter limit must be combined with a single type`).
    // Without filters MapTiler returns its full candidate set (≤8 features
    // typically); we pick the most specific via `reverseSpecificityRank` so
    // rural/edge clicks still resolve to street → locality → place instead
    // of failing silently to "no address".
    const url =
      `${MAPTILER_ENDPOINT}/${longitude},${latitude}.json?key=${this.apiKey}` +
      `&language=${language}`;

    let data: MapTilerGeocodingResponse;
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new PoiProviderUnavailableError(
          `MapTiler returned ${res.status}`,
          this.name,
        );
      }
      data = (await res.json()) as MapTilerGeocodingResponse;
    } catch (err) {
      if (err instanceof PoiProviderUnavailableError) throw err;
      if ((err as { name?: string }).name === "AbortError") {
        throw err;
      }
      throw new PoiProviderUnavailableError(
        `MapTiler reverse fetch failed: ${(err as Error).message}`,
        this.name,
      );
    }

    const features = data.features ?? [];
    const candidates: Array<ReverseGeoResult & { specificity: number }> = [];
    for (const feature of features) {
      const mapped = this.mapReverseFeature(feature);
      if (!mapped) continue;
      candidates.push({
        ...mapped,
        specificity: reverseSpecificityRank(feature),
      });
    }

    if (candidates.length === 0) return null;

    if (preferCategoryKey) {
      const matching = candidates.find(
        (c) => c.categoryKey === preferCategoryKey,
      );
      if (matching) {
        const { specificity: _s, ...rest } = matching;
        return rest;
      }
    }

    candidates.sort((a, b) => a.specificity - b.specificity);
    const { specificity: _s, ...best } = candidates[0]!;
    return best;
  }

  /** Loose mapper used by `reverse()`. Unlike `mapFeature()`, this preserves
   * features that don't map to a known `lp.*` category (street/address hits)
   * because the reverse path uses them to autofill manual pin name+address. */
  private mapReverseFeature(feature: MapTilerFeature): ReverseGeoResult | null {
    const coords = feature.center ?? feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return null;
    const [longitude, latitude] = coords;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    const name = feature.text ?? feature.place_name;
    if (!name) return null;

    const categoryCandidates = [
      ...(feature.properties?.categories ?? []),
      ...(feature.place_type ?? []),
    ];
    const categoryKey = mapMapTilerCategoryToLp(categoryCandidates);

    return {
      name,
      address: feature.place_name ?? null,
      latitude,
      longitude,
      categoryKey,
    };
  }

  private mapFeature(
    feature: MapTilerFeature,
    anchor: { latitude: number; longitude: number },
    retrievedAt: string,
  ): PoiSuggestion | null {
    const coords = feature.center ?? feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return null;
    const [longitude, latitude] = coords;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    const name = feature.text ?? feature.place_name;
    if (!name) return null;

    const rawCandidates = [
      ...(feature.properties?.categories ?? []),
      ...(feature.place_type ?? []),
    ];
    // Normalize OSM-style: MapTiler returns "railway station" / "bus stop"
    // with spaces, but every downstream regex matcher (mode buckets in
    // arrival-discovery, the lp.* mapper here) is keyed by underscored OSM
    // tags. Normalize once at the provider boundary so callers see a
    // consistent shape.
    const categoryCandidates = rawCandidates
      .map((c) => normalizeMapTilerCategory(c))
      .filter((c) => c.length > 0);
    const categoryKey = mapMapTilerCategoryToLp(categoryCandidates);
    if (!categoryKey) return null; // provider drops unclassified POIs

    const providerPlaceId =
      feature.id ?? `${this.name}:${latitude.toFixed(6)},${longitude.toFixed(6)}`;

    const nativeCategory = categoryCandidates[0] ?? null;

    const metadata: ProviderMetadata = {
      nativeCategory,
      placeTypes: categoryCandidates.slice(0, 8),
      confidence:
        typeof feature.relevance === "number" &&
        feature.relevance >= 0 &&
        feature.relevance <= 1
          ? feature.relevance
          : null,
      retrievedAt,
    };

    const website = feature.properties?.website?.trim();

    return {
      provider: this.name,
      providerPlaceId,
      name,
      categoryKey,
      latitude,
      longitude,
      address: feature.place_name ?? undefined,
      website: website && /^https?:\/\//i.test(website) ? website : undefined,
      distanceMeters: haversineMeters(anchor, { latitude, longitude }),
      providerMetadata: metadata,
    };
  }
}
