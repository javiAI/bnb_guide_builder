import { afterEach, describe, expect, it } from "vitest";
import {
  __setLocalPoiProviderForTests,
  type LocalPoiProvider,
  type PoiSuggestion,
} from "@/lib/services/places";
import {
  discoverParkingSuggestions,
  PARKING_CATEGORY_KEY,
} from "@/lib/services/parking-discovery.service";
import {
  DISCOVERY_HARD_CAP,
  DISCOVERY_SOFT_WARNING_FLOOR,
} from "@/lib/services/arrival-discovery.service";

const ANCHOR = { latitude: 40.4168, longitude: -3.7038 };

function makeSuggestion(overrides: {
  providerPlaceId: string;
  name?: string;
  categoryKey?: string;
  latitude?: number;
  longitude?: number;
  parkingFee?: "free" | "paid" | null;
}): PoiSuggestion {
  return {
    provider: "mock",
    providerPlaceId: overrides.providerPlaceId,
    name: overrides.name ?? `Parking ${overrides.providerPlaceId}`,
    categoryKey: overrides.categoryKey ?? PARKING_CATEGORY_KEY,
    latitude: overrides.latitude ?? ANCHOR.latitude,
    longitude: overrides.longitude ?? ANCHOR.longitude,
    address: undefined,
    website: undefined,
    distanceMeters: undefined,
    parkingFee: overrides.parkingFee ?? null,
    providerMetadata: {
      nativeCategory: null,
      placeTypes: [],
      confidence: null,
      retrievedAt: "2026-05-22T10:00:00.000Z",
    },
  };
}

function provider(items: PoiSuggestion[]): LocalPoiProvider {
  return {
    name: "mock",
    search: async () => items,
  };
}

afterEach(() => {
  __setLocalPoiProviderForTests(null);
});

describe("discoverParkingSuggestions", () => {
  it("filters by parking category, excluding non-parking results", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({ providerPlaceId: "p1" }),
        makeSuggestion({ providerPlaceId: "t1", categoryKey: "lp.transport" }),
        makeSuggestion({ providerPlaceId: "p2" }),
      ]),
    );

    const result = await discoverParkingSuggestions({
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });

    expect(result.suggestions.map((s) => s.providerPlaceId).sort()).toEqual([
      "p1",
      "p2",
    ]);
  });

  it("excludes provider IDs already persisted to the property", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({ providerPlaceId: "p1" }),
        makeSuggestion({ providerPlaceId: "p2" }),
        makeSuggestion({ providerPlaceId: "p3" }),
      ]),
    );

    const result = await discoverParkingSuggestions({
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(["p1", "p3"]),
    });

    expect(result.suggestions.map((s) => s.providerPlaceId)).toEqual(["p2"]);
  });

  it("deduplicates by providerPlaceId when provider emits duplicates", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({ providerPlaceId: "p1", name: "First" }),
        makeSuggestion({ providerPlaceId: "p1", name: "Duplicate" }),
        makeSuggestion({ providerPlaceId: "p2" }),
      ]),
    );

    const result = await discoverParkingSuggestions({
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0].providerPlaceId).toBe("p1");
    expect(result.suggestions[0].name).toBe("First");
  });

  it("drops results outside the requested radius", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({ providerPlaceId: "near" }),
        // ~111km east of anchor — outside 30km default
        makeSuggestion({
          providerPlaceId: "far",
          latitude: ANCHOR.latitude,
          longitude: ANCHOR.longitude + 1,
        }),
      ]),
    );

    const result = await discoverParkingSuggestions({
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
      radiusMeters: 30_000,
    });

    expect(result.suggestions.map((s) => s.providerPlaceId)).toEqual(["near"]);
  });

  it("sorts suggestions by distance ascending", async () => {
    __setLocalPoiProviderForTests(
      provider([
        // Increasing distance from anchor
        makeSuggestion({
          providerPlaceId: "c",
          latitude: ANCHOR.latitude + 0.02,
          longitude: ANCHOR.longitude,
        }),
        makeSuggestion({
          providerPlaceId: "a",
          latitude: ANCHOR.latitude + 0.001,
          longitude: ANCHOR.longitude,
        }),
        makeSuggestion({
          providerPlaceId: "b",
          latitude: ANCHOR.latitude + 0.01,
          longitude: ANCHOR.longitude,
        }),
      ]),
    );

    const result = await discoverParkingSuggestions({
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });

    expect(result.suggestions.map((s) => s.providerPlaceId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("caps suggestions at DISCOVERY_HARD_CAP and reports totalBeforeCap", async () => {
    const oversupply = Array.from({ length: DISCOVERY_HARD_CAP + 3 }, (_, i) =>
      makeSuggestion({
        providerPlaceId: `p${i}`,
        latitude: ANCHOR.latitude + (i + 1) * 0.0005,
      }),
    );
    __setLocalPoiProviderForTests(provider(oversupply));

    const result = await discoverParkingSuggestions({
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });

    expect(result.suggestions).toHaveLength(DISCOVERY_HARD_CAP);
    expect(result.totalBeforeCap).toBe(DISCOVERY_HARD_CAP + 3);
  });

  it("emits 'few_results' warning when pool is below the soft floor", async () => {
    const items = Array.from(
      { length: DISCOVERY_SOFT_WARNING_FLOOR - 1 },
      (_, i) =>
        makeSuggestion({
          providerPlaceId: `p${i}`,
          latitude: ANCHOR.latitude + (i + 1) * 0.0005,
        }),
    );
    __setLocalPoiProviderForTests(provider(items));

    const result = await discoverParkingSuggestions({
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });

    expect(result.warningKey).toBe("few_results");
    expect(result.totalBeforeCap).toBe(items.length);
  });

  it("returns null warningKey when pool meets the soft floor", async () => {
    const items = Array.from(
      { length: DISCOVERY_SOFT_WARNING_FLOOR },
      (_, i) =>
        makeSuggestion({
          providerPlaceId: `p${i}`,
          latitude: ANCHOR.latitude + (i + 1) * 0.0005,
        }),
    );
    __setLocalPoiProviderForTests(provider(items));

    const result = await discoverParkingSuggestions({
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });

    expect(result.warningKey).toBeNull();
  });

  it("preserves provider-emitted parkingFee hint when present", async () => {
    __setLocalPoiProviderForTests(
      provider([
        makeSuggestion({ providerPlaceId: "free1", parkingFee: "free" }),
        makeSuggestion({ providerPlaceId: "paid1", parkingFee: "paid" }),
        makeSuggestion({ providerPlaceId: "unknown1", parkingFee: null }),
      ]),
    );

    const result = await discoverParkingSuggestions({
      anchor: ANCHOR,
      language: "es",
      excludeProviderPlaceIds: new Set(),
    });

    const byId = Object.fromEntries(
      result.suggestions.map((s) => [s.providerPlaceId, s.parkingFee]),
    );
    expect(byId.free1).toBe("free");
    expect(byId.paid1).toBe("paid");
    expect(byId.unknown1).toBeNull();
  });
});
