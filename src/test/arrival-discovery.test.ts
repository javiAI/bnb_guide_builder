import { afterEach, describe, expect, it } from "vitest";
import {
  __setLocalPoiProviderForTests,
  type LocalPoiProvider,
  type PoiSuggestion,
} from "@/lib/services/places";
import {
  ARRIVAL_MODES,
  arrivalModeCategoryKey,
  discoverArrivalSuggestions,
  type ArrivalMode,
} from "@/lib/services/arrival-discovery.service";

function makeSuggestion(overrides: {
  providerPlaceId: string;
  name?: string;
  nativeCategory?: string | null;
  placeTypes?: string[];
  latitude?: number;
  longitude?: number;
}): PoiSuggestion {
  return {
    provider: "mock",
    providerPlaceId: overrides.providerPlaceId,
    name: overrides.name ?? `Pin ${overrides.providerPlaceId}`,
    // Provider emits `lp.transport` (the generic bucket) for all transit POIs;
    // the arrival-discovery service re-buckets them via per-mode regex.
    categoryKey: "lp.transport",
    latitude: overrides.latitude ?? 40.4168,
    longitude: overrides.longitude ?? -3.7038,
    address: undefined,
    website: undefined,
    distanceMeters: undefined,
    providerMetadata: {
      nativeCategory: overrides.nativeCategory ?? null,
      placeTypes: overrides.placeTypes ?? [],
      confidence: null,
      retrievedAt: "2026-05-19T10:00:00.000Z",
    },
  };
}

function provider(items: PoiSuggestion[]): LocalPoiProvider {
  return {
    name: "mock",
    search: async () => items,
  };
}

function providerByQuery(byQuery: Record<string, PoiSuggestion[]>): LocalPoiProvider {
  return {
    name: "mock",
    search: async ({ query }) => byQuery[query] ?? [],
  };
}

const ANCHOR = { latitude: 40.4168, longitude: -3.7038 };

afterEach(() => {
  __setLocalPoiProviderForTests(null);
});

describe("discoverArrivalSuggestions", () => {
  it("filters provider results by per-mode regex against nativeCategory", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "t1",
          nativeCategory: "train_station",
        }),
        makeSuggestion({
          providerPlaceId: "t2",
          nativeCategory: "railway_station",
        }),
        makeSuggestion({
          providerPlaceId: "b1",
          nativeCategory: "bus_stop",
        }),
        makeSuggestion({
          providerPlaceId: "a1",
          nativeCategory: "airport",
        }),
      ]),
    );

    const trainResult = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(trainResult.suggestions.map((s) => s.providerPlaceId)).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("matches against placeTypes when nativeCategory misses", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "t-types",
          nativeCategory: "transport",
          placeTypes: ["transit_station", "train_station"],
        }),
      ]),
    );

    const trainResult = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(trainResult.suggestions).toHaveLength(1);
    expect(trainResult.suggestions[0].providerPlaceId).toBe("t-types");
  });

  it("drops results that match no per-mode pattern", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "b1",
          nativeCategory: "bus_stop",
        }),
      ]),
    );

    const result = await discoverArrivalSuggestions({
      mode: "airport",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.suggestions).toEqual([]);
    expect(result.totalBeforeCap).toBe(0);
    expect(result.warningKey).toBe("none");
  });

  it("emits 'none' warning when pool is empty", async () => {
    __setLocalPoiProviderForTests(provider([]));
    const result = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.warningKey).toBe("none");
    expect(result.totalBeforeCap).toBe(0);
  });

  it("excludes already-persisted providerPlaceIds", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({ providerPlaceId: "t1", nativeCategory: "train_station" }),
        makeSuggestion({ providerPlaceId: "t2", nativeCategory: "train_station" }),
      ]),
    );

    const result = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(["t1"]),
    });
    expect(result.suggestions.map((s) => s.providerPlaceId)).toEqual(["t2"]);
  });

  it("dedupes by providerPlaceId within a single call", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({ providerPlaceId: "x", nativeCategory: "train_station" }),
        makeSuggestion({ providerPlaceId: "x", nativeCategory: "train_station" }),
      ]),
    );

    const result = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.suggestions).toHaveLength(1);
  });

  it("caps suggestions to 8 and exposes totalBeforeCap", async () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      makeSuggestion({
        providerPlaceId: `t${i}`,
        nativeCategory: "train_station",
        latitude: ANCHOR.latitude + i * 0.001,
      }),
    );
    __setLocalPoiProviderForTests(provider(items));

    const result = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.suggestions).toHaveLength(8);
    expect(result.totalBeforeCap).toBe(12);
    expect(result.warningKey).toBeNull();
  });

  it("emits few_results warning when pool size < 4", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({ providerPlaceId: "t1", nativeCategory: "train_station" }),
        makeSuggestion({ providerPlaceId: "t2", nativeCategory: "train_station" }),
      ]),
    );
    const result = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.warningKey).toBe("few_results");
    expect(result.totalBeforeCap).toBe(2);
  });

  it("filters results beyond the shared distance cap", async () => {
    // ~0.6° lat ≈ 67km. Default radius is 30km (DEFAULT_DISCOVERY_RADIUS_M) —
    // single shared cap across modes, so the far one must drop.
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "near",
          nativeCategory: "airport",
          latitude: ANCHOR.latitude + 0.1, // ~11km
        }),
        makeSuggestion({
          providerPlaceId: "far",
          nativeCategory: "airport",
          latitude: ANCHOR.latitude + 0.6, // ~67km — over cap
        }),
      ]),
    );
    const result = await discoverArrivalSuggestions({
      mode: "airport",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.suggestions.map((s) => s.providerPlaceId)).toEqual(["near"]);
    expect(result.totalBeforeCap).toBe(1);
  });

  it("honors caller-supplied radiusMeters (overrides default)", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "near",
          nativeCategory: "bus_station",
          latitude: ANCHOR.latitude + 0.01, // ~1.1km
        }),
        makeSuggestion({
          providerPlaceId: "far",
          nativeCategory: "bus_station",
          latitude: ANCHOR.latitude + 0.1, // ~11km
        }),
      ]),
    );
    const result = await discoverArrivalSuggestions({
      mode: "bus",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
      radiusMeters: 5_000,
    });
    expect(result.suggestions.map((s) => s.providerPlaceId)).toEqual(["near"]);
  });

  it("clamps an absurdly large radiusMeters to MAX_DISCOVERY_RADIUS_M", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "very-far",
          nativeCategory: "airport",
          latitude: ANCHOR.latitude + 3, // ~333km — beyond 200km MAX
        }),
      ]),
    );
    const result = await discoverArrivalSuggestions({
      mode: "airport",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
      radiusMeters: 10_000_000, // clamped down to 200km
    });
    expect(result.suggestions).toEqual([]);
  });

  it("unions results across multi-query fallbacks (rural train search)", async () => {
    // First canonical query returns nothing; a later synonym surfaces the
    // station. Covers the rural-Spain case where MapTiler's POI index only
    // matches one of the synonyms (canonical English misses; Spanish hits).
    __setLocalPoiProviderForTests(
      providerByQuery({
        "train station": [],
        "railway station": [],
        "estación de tren": [
          makeSuggestion({
            providerPlaceId: "renfe1",
            nativeCategory: "train_station",
            latitude: ANCHOR.latitude + 0.001,
          }),
        ],
      }),
    );
    const result = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.suggestions.map((s) => s.providerPlaceId)).toEqual(["renfe1"]);
  });

  it("falls back to name matching when nativeCategory is generic 'transport'", async () => {
    // Real-world MapTiler responses for Spanish queries often return only the
    // broad "transport" category (mapped to lp.transport by the provider).
    // The strict per-mode native-cat regex rejects them, so without the
    // name-fallback the Sugeridos column is empty. Each fixture below has the
    // mode keyword in its name and a generic nativeCategory.
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "atocha",
          name: "Estación de Madrid-Puerta de Atocha",
          nativeCategory: "transport",
          placeTypes: ["transport", "poi"],
        }),
        makeSuggestion({
          providerPlaceId: "sants",
          name: "Estación de Sants - Renfe",
          nativeCategory: "transport",
          placeTypes: ["transport", "poi"],
        }),
      ]),
    );

    const result = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.suggestions.map((s) => s.providerPlaceId).sort()).toEqual([
      "atocha",
      "sants",
    ]);
  });

  it("name fallback keeps bus terminals out of train results", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "atocha-tren",
          name: "Estación de tren Atocha",
          nativeCategory: "transport",
        }),
        makeSuggestion({
          providerPlaceId: "mendez-bus",
          name: "Estación de autobuses Méndez Álvaro",
          nativeCategory: "transport",
        }),
      ]),
    );

    const trainResult = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(trainResult.suggestions.map((s) => s.providerPlaceId)).toEqual([
      "atocha-tren",
    ]);

    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "atocha-tren",
          name: "Estación de tren Atocha",
          nativeCategory: "transport",
        }),
        makeSuggestion({
          providerPlaceId: "mendez-bus",
          name: "Estación de autobuses Méndez Álvaro",
          nativeCategory: "transport",
        }),
      ]),
    );
    const busResult = await discoverArrivalSuggestions({
      mode: "bus",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(busResult.suggestions.map((s) => s.providerPlaceId)).toEqual([
      "mendez-bus",
    ]);
  });

  it("name fallback recognizes 'aeropuerto' for airport mode", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "barajas",
          name: "Aeropuerto Adolfo Suárez Madrid-Barajas",
          nativeCategory: "transport",
          latitude: ANCHOR.latitude + 0.05,
        }),
      ]),
    );
    const result = await discoverArrivalSuggestions({
      mode: "airport",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.suggestions.map((s) => s.providerPlaceId)).toEqual([
      "barajas",
    ]);
  });

  it("sorts results by ascending distance from the anchor", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({
          providerPlaceId: "far",
          nativeCategory: "train_station",
          latitude: ANCHOR.latitude + 0.05,
        }),
        makeSuggestion({
          providerPlaceId: "near",
          nativeCategory: "train_station",
          latitude: ANCHOR.latitude + 0.001,
        }),
      ]),
    );

    const result = await discoverArrivalSuggestions({
      mode: "train",
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });
    expect(result.suggestions.map((s) => s.providerPlaceId)).toEqual([
      "near",
      "far",
    ]);
    expect(result.suggestions[0].distanceMeters).toBeLessThan(
      result.suggestions[1].distanceMeters,
    );
  });
});

describe("arrivalModeCategoryKey", () => {
  it("maps every mode to its lp.arrival_<mode> key", () => {
    const expected: Record<ArrivalMode, string> = {
      train: "lp.arrival_train",
      bus: "lp.arrival_bus",
      airport: "lp.arrival_airport",
    };
    for (const mode of ARRIVAL_MODES) {
      expect(arrivalModeCategoryKey(mode)).toBe(expected[mode]);
    }
  });
});
