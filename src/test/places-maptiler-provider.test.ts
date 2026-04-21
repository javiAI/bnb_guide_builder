import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MapTilerPlacesProvider } from "@/lib/services/places/maptiler-provider";
import { mapMapTilerCategoryToLp } from "@/lib/services/places/maptiler-category-mapping";
import { PoiProviderUnavailableError } from "@/lib/services/places/provider";

const ANCHOR = { latitude: 41.385, longitude: 2.173 };

describe("mapMapTilerCategoryToLp", () => {
  it("prioritizes pharmacy over generic shop", () => {
    expect(mapMapTilerCategoryToLp(["shop", "pharmacy"])).toBe("lp.pharmacy");
  });

  it("maps supermarket to lp.supermarket", () => {
    expect(mapMapTilerCategoryToLp(["supermarket"])).toBe("lp.supermarket");
  });

  it("maps transport variants to lp.transport", () => {
    expect(mapMapTilerCategoryToLp(["subway"])).toBe("lp.transport");
    expect(mapMapTilerCategoryToLp(["bus_station"])).toBe("lp.transport");
    expect(mapMapTilerCategoryToLp(["train_station"])).toBe("lp.transport");
  });

  it("returns null when no candidate matches", () => {
    expect(mapMapTilerCategoryToLp(["unknown_tag", "poi"])).toBeNull();
    expect(mapMapTilerCategoryToLp([])).toBeNull();
  });

  it("ignores empty strings in candidate list", () => {
    expect(mapMapTilerCategoryToLp(["", "  ", "bar"])).toBe("lp.bar");
  });
});

describe("MapTilerPlacesProvider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetchOk(body: unknown) {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => body,
    });
  }

  it("parses a minimal feature with a mappable category", async () => {
    mockFetchOk({
      features: [
        {
          id: "poi.123",
          text: "Bar El Rincón",
          place_name: "Bar El Rincón, Carrer Foo 1, Barcelona",
          place_type: ["poi"],
          center: [2.174, 41.386], // [lng, lat]
          relevance: 0.9,
          properties: { categories: ["bar"] },
        },
      ],
    });

    const provider = new MapTilerPlacesProvider("test-key");
    const result = await provider.search({
      query: "bar",
      anchor: ANCHOR,
      language: "es",
    });

    expect(result.length).toBe(1);
    const [s] = result;
    expect(s.provider).toBe("maptiler");
    expect(s.providerPlaceId).toBe("poi.123");
    expect(s.name).toBe("Bar El Rincón");
    expect(s.categoryKey).toBe("lp.bar");
    expect(s.latitude).toBeCloseTo(41.386, 5);
    expect(s.longitude).toBeCloseTo(2.174, 5);
    expect(s.address).toBe("Bar El Rincón, Carrer Foo 1, Barcelona");
    expect(s.distanceMeters).toBeGreaterThan(0);
    expect(s.providerMetadata.nativeCategory).toBe("bar");
    expect(s.providerMetadata.confidence).toBe(0.9);
    expect(s.providerMetadata.placeTypes).toContain("bar");
    expect(s.providerMetadata.placeTypes).toContain("poi");
  });

  it("drops features whose categories cannot be mapped to lp.*", async () => {
    mockFetchOk({
      features: [
        {
          id: "poi.1",
          text: "Unknown Thing",
          place_type: ["poi"],
          center: [2.174, 41.386],
          properties: { categories: ["obscure_unmapped_tag"] },
        },
      ],
    });

    const provider = new MapTilerPlacesProvider("test-key");
    const result = await provider.search({
      query: "x",
      anchor: ANCHOR,
      language: "es",
    });
    expect(result).toEqual([]);
  });

  it("drops features with invalid coordinates", async () => {
    mockFetchOk({
      features: [
        {
          id: "poi.1",
          text: "Broken",
          place_type: ["poi"],
          center: [NaN, 41.386],
          properties: { categories: ["restaurant"] },
        },
      ],
    });

    const provider = new MapTilerPlacesProvider("test-key");
    const result = await provider.search({
      query: "x",
      anchor: ANCHOR,
      language: "es",
    });
    expect(result).toEqual([]);
  });

  it("throws PoiProviderUnavailableError on non-2xx response", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const provider = new MapTilerPlacesProvider("test-key");
    await expect(
      provider.search({ query: "x", anchor: ANCHOR, language: "es" }),
    ).rejects.toBeInstanceOf(PoiProviderUnavailableError);
  });

  it("throws PoiProviderUnavailableError when fetch rejects", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("network down"),
    );

    const provider = new MapTilerPlacesProvider("test-key");
    await expect(
      provider.search({ query: "x", anchor: ANCHOR, language: "es" }),
    ).rejects.toBeInstanceOf(PoiProviderUnavailableError);
  });

  it("filters out website values that are not http(s) URLs", async () => {
    mockFetchOk({
      features: [
        {
          id: "poi.w",
          text: "Has Website",
          place_type: ["poi"],
          center: [2.174, 41.386],
          properties: {
            categories: ["restaurant"],
            website: "not a url",
          },
        },
      ],
    });

    const provider = new MapTilerPlacesProvider("test-key");
    const [s] = await provider.search({
      query: "x",
      anchor: ANCHOR,
      language: "es",
    });
    expect(s.website).toBeUndefined();
  });

  it("passes proximity, language, types and limit to MapTiler", async () => {
    mockFetchOk({ features: [] });

    const provider = new MapTilerPlacesProvider("test-key");
    await provider.search({
      query: "pizza",
      anchor: ANCHOR,
      language: "es",
      limit: 5,
    });

    const callArg = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(callArg).toContain("/geocoding/pizza.json");
    expect(callArg).toContain("key=test-key");
    expect(callArg).toContain("language=es");
    expect(callArg).toContain("limit=5");
    expect(callArg).toContain("types=poi");
    expect(callArg).toContain(`proximity=${ANCHOR.longitude},${ANCHOR.latitude}`);
  });
});
