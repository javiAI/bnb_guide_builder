import {
  PoiProviderUnavailableError,
  PoiSuggestionSchema,
  type LocalPoiProvider,
  type PoiSuggestion,
  type ProviderMetadata,
  type SearchParams,
} from "./provider";
import { mapMapTilerCategoryToLp } from "./maptiler-category-mapping";
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

export class MapTilerPlacesProvider implements LocalPoiProvider {
  readonly name = "maptiler";

  constructor(private readonly apiKey: string) {}

  async search(params: SearchParams): Promise<PoiSuggestion[]> {
    const limit = params.limit ?? 8;
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

    const categoryCandidates = [
      ...(feature.properties?.categories ?? []),
      ...(feature.place_type ?? []),
    ];
    const categoryKey = mapMapTilerCategoryToLp(categoryCandidates);
    if (!categoryKey) return null; // provider drops unclassified POIs

    const providerPlaceId =
      feature.id ?? `${this.name}:${latitude.toFixed(6)},${longitude.toFixed(6)}`;

    const nativeCategory =
      feature.properties?.categories?.[0] ??
      feature.place_type?.[0] ??
      null;

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
