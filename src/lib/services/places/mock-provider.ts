import {
  PoiSuggestionSchema,
  type LocalPoiProvider,
  type PoiSuggestion,
  type SearchParams,
} from "./provider";
import { haversineMeters } from "./distance";

/** Deterministic in-memory provider for dev/test. Returns a seeded list
 * filtered by case-insensitive `query` substring match on `name`. The mock
 * never makes network calls and always succeeds — use it in tests to
 * exercise endpoint + UI paths without mocking `fetch`. */
export class MockPlacesProvider implements LocalPoiProvider {
  readonly name = "mock";

  constructor(private readonly seed: ReadonlyArray<SeedPlace> = DEFAULT_SEED) {}

  async search(params: SearchParams): Promise<PoiSuggestion[]> {
    const needle = params.query.trim().toLowerCase();
    if (!needle) return [];
    const limit = params.limit ?? 8;
    const retrievedAt = new Date().toISOString();
    const out: PoiSuggestion[] = [];
    for (const entry of this.seed) {
      if (!entry.name.toLowerCase().includes(needle)) continue;
      const suggestion = {
        provider: this.name,
        providerPlaceId: entry.id,
        name: entry.name,
        categoryKey: entry.categoryKey,
        latitude: entry.latitude,
        longitude: entry.longitude,
        address: entry.address,
        website: entry.website,
        distanceMeters: haversineMeters(params.anchor, {
          latitude: entry.latitude,
          longitude: entry.longitude,
        }),
        providerMetadata: {
          nativeCategory: entry.categoryKey.replace(/^lp\./, ""),
          placeTypes: ["poi", entry.categoryKey.replace(/^lp\./, "")],
          confidence: 1,
          retrievedAt,
        },
      };
      const parsed = PoiSuggestionSchema.safeParse(suggestion);
      if (parsed.success) out.push(parsed.data);
      if (out.length >= limit) break;
    }
    return out;
  }
}

interface SeedPlace {
  id: string;
  name: string;
  categoryKey: string;
  latitude: number;
  longitude: number;
  address?: string;
  website?: string;
}

const DEFAULT_SEED: ReadonlyArray<SeedPlace> = [
  {
    id: "mock-rest-1",
    name: "Restaurante La Marina",
    categoryKey: "lp.restaurant",
    latitude: 41.385,
    longitude: 2.173,
    address: "Carrer Marina 10, Barcelona",
  },
  {
    id: "mock-cafe-1",
    name: "Café Central",
    categoryKey: "lp.cafe",
    latitude: 41.384,
    longitude: 2.174,
  },
  {
    id: "mock-super-1",
    name: "Supermercado Mercadona",
    categoryKey: "lp.supermarket",
    latitude: 41.386,
    longitude: 2.172,
  },
];
