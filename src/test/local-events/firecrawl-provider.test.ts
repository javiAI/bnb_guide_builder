import { describe, it, expect } from "vitest";
import type { LocalEventSource } from "@/lib/taxonomy-loader";
import {
  FirecrawlLocalEventsProvider,
  deriveFirecrawlExternalId,
  mapFirecrawlCategory,
  selectApplicableSources,
} from "@/lib/services/local-events/firecrawl-provider";
import type { SourceFetchParams } from "@/lib/services/local-events/contracts";

const TERUEL: LocalEventSource = {
  key: "teruel_turismo",
  sourceUrl: "https://www.turismo.teruel.es/agenda",
  city: "Teruel",
  latitude: 40.3456,
  longitude: -1.1065,
  radiusKm: 15,
  language: "es",
};

const VALENCIA: LocalEventSource = {
  key: "valencia_turismo",
  sourceUrl: "https://www.visitvalencia.com/agenda",
  city: "Valencia",
  latitude: 39.4699,
  longitude: -0.3763,
  radiusKm: 25,
  language: "es",
};

function baseParams(overrides: Partial<SourceFetchParams> = {}): SourceFetchParams {
  return {
    anchor: { latitude: 40.34, longitude: -1.10 },
    locale: "es",
    city: "Teruel",
    window: {
      from: new Date("2026-05-01T00:00:00.000Z"),
      to: new Date("2026-06-30T23:59:59.000Z"),
    },
    ...overrides,
  };
}

function mockOk(payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

function mockStatus(status: number, extraHeaders: Record<string, string> = {}): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ error: `HTTP ${status}` }), {
      status,
      headers: { "content-type": "application/json", ...extraHeaders },
    })) as unknown as typeof fetch;
}

describe("selectApplicableSources", () => {
  it("matches by city (case-insensitive, accent-insensitive)", () => {
    const applicable = selectApplicableSources(
      [TERUEL, VALENCIA],
      { anchor: { latitude: 0, longitude: 0 }, city: "teruel" },
    );
    expect(applicable.map((s) => s.key)).toEqual(["teruel_turismo"]);
  });

  it("falls back to haversine radius when city is null", () => {
    const applicable = selectApplicableSources(
      [TERUEL, VALENCIA],
      { anchor: { latitude: 40.34, longitude: -1.10 }, city: null },
    );
    expect(applicable.map((s) => s.key)).toEqual(["teruel_turismo"]);
  });

  it("returns nothing when far from every source and city doesn't match", () => {
    const applicable = selectApplicableSources(
      [TERUEL, VALENCIA],
      { anchor: { latitude: 48.85, longitude: 2.35 }, city: "Paris" },
    );
    expect(applicable).toEqual([]);
  });
});

describe("mapFirecrawlCategory", () => {
  it("maps known keywords to canonical le.* keys", () => {
    expect(mapFirecrawlCategory("concierto de jazz")).toBe("le.concert");
    expect(mapFirecrawlCategory("Fútbol - partido")).toBe("le.sports");
    expect(mapFirecrawlCategory("exposición")).toBe("le.exhibition");
    expect(mapFirecrawlCategory("mercado medieval")).toBe("le.community");
    expect(mapFirecrawlCategory("Festival de cine")).toBe("le.festival");
    expect(mapFirecrawlCategory("Fallas 2026")).toBe("le.festival");
  });

  it("falls back to le.other for unknown categories", () => {
    expect(mapFirecrawlCategory(undefined)).toBe("le.other");
    expect(mapFirecrawlCategory("zarzuela contemporánea lunar")).toBe("le.other");
  });

  it("matches accented raw inputs via accent-stripped keywords", () => {
    // Keywords with Spanish accents/ñ (niños, niñas, galería, exposición)
    // must still match after `stripAccents` is applied to the raw input.
    // Regression for the pre-fix bug where keywords were compared unstripped.
    expect(mapFirecrawlCategory("Actividad para niños")).toBe("le.family");
    expect(mapFirecrawlCategory("Evento con niñas")).toBe("le.family");
    expect(mapFirecrawlCategory("Galería municipal")).toBe("le.exhibition");
    expect(mapFirecrawlCategory("Exposición itinerante")).toBe("le.exhibition");
  });
});

describe("deriveFirecrawlExternalId", () => {
  it("is stable for same title+time+venue+url", () => {
    const a = deriveFirecrawlExternalId({
      title: "Concierto Orquesta",
      startsAt: new Date("2026-05-10T19:00:00.000Z"),
      venueName: "Palau",
      detailUrl: "https://x/e/1",
    });
    const b = deriveFirecrawlExternalId({
      title: "  CONCIERTO  Orquesta ",
      startsAt: new Date("2026-05-10T19:04:00.000Z"),
      venueName: "palau",
      detailUrl: "https://x/e/1",
    });
    expect(a).toBe(b);
  });

  it("changes when the 15-min slot changes", () => {
    const a = deriveFirecrawlExternalId({
      title: "X",
      startsAt: new Date("2026-05-10T19:00:00.000Z"),
    });
    const b = deriveFirecrawlExternalId({
      title: "X",
      startsAt: new Date("2026-05-10T19:20:00.000Z"),
    });
    expect(a).not.toBe(b);
  });

  it("changes when venue changes", () => {
    const a = deriveFirecrawlExternalId({
      title: "X",
      startsAt: new Date("2026-05-10T19:00:00.000Z"),
      venueName: "A",
    });
    const b = deriveFirecrawlExternalId({
      title: "X",
      startsAt: new Date("2026-05-10T19:00:00.000Z"),
      venueName: "B",
    });
    expect(a).not.toBe(b);
  });
});

describe("FirecrawlLocalEventsProvider", () => {
  it("returns config_error when API key is missing", async () => {
    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "",
      sources: [TERUEL],
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("config_error");
    expect(res.events).toEqual([]);
    expect(res.error?.kind).toBe("config");
  });

  it("returns no_sources_applicable (not ok) when no curated source applies to the property anchor/city", async () => {
    // Distinct status from `ok (0 events)`: operators need to tell apart
    // "scrape ran → page had nothing" vs. "no source covers this property".
    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "fc-key",
      sources: [TERUEL],
      fetchImpl: (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch,
    });
    const res = await provider.fetch(baseParams({ city: "Paris", anchor: { latitude: 48.85, longitude: 2.35 } }));
    expect(res.status).toBe("no_sources_applicable");
    expect(res.events).toEqual([]);
    expect(res.error).toBeUndefined();
    expect(res.warnings[0]).toMatch(/no curated sources applicable/);
  });

  it("scrapes + normalizes a well-formed Firecrawl response", async () => {
    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "fc-key",
      sources: [TERUEL],
      fetchImpl: mockOk({
        success: true,
        data: {
          extract: {
            events: [
              {
                title: "Concierto en la Plaza del Torico",
                startDate: "2026-05-15T21:00:00.000Z",
                endDate: "2026-05-15T23:00:00.000Z",
                category: "concierto",
                venueName: "Plaza del Torico",
                venueAddress: "Plaza del Torico, Teruel",
                detailUrl: "https://www.turismo.teruel.es/agenda/concierto-torico",
                imageUrl: "https://cdn.turismo.teruel.es/img/torico.jpg",
                priceText: "Gratuito",
              },
              {
                title: "Mercado Medieval",
                startDate: "2026-05-20",
                category: "mercado",
              },
            ],
          },
        },
      }),
    });

    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("ok");
    expect(res.events.length).toBe(2);
    const concert = res.events[0];
    expect(concert.source).toBe("firecrawl:teruel_turismo");
    expect(concert.categoryKey).toBe("le.concert");
    expect(concert.venueName).toBe("Plaza del Torico");
    expect(concert.sourceUrl).toBe("https://www.turismo.teruel.es/agenda/concierto-torico");
    expect(concert.imageUrl).toBe("https://cdn.turismo.teruel.es/img/torico.jpg");
    expect(concert.providerMetadata.nativeCategory).toBe("concierto");

    const market = res.events[1];
    expect(market.categoryKey).toBe("le.community");
    // detailUrl absent → falls back to the curated source URL
    expect(market.sourceUrl).toBe(TERUEL.sourceUrl);
  });

  it("drops events outside the requested window", async () => {
    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "fc-key",
      sources: [TERUEL],
      fetchImpl: mockOk({
        success: true,
        data: {
          extract: {
            events: [
              { title: "In window", startDate: "2026-05-10T10:00:00.000Z", category: "concierto" },
              { title: "Way past window", startDate: "2027-01-10T10:00:00.000Z", category: "concierto" },
            ],
          },
        },
      }),
    });

    const res = await provider.fetch(baseParams());
    expect(res.events.length).toBe(1);
    expect(res.events[0].title).toBe("In window");
  });

  it("warns and drops candidates with unparseable startDate", async () => {
    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "fc-key",
      sources: [TERUEL],
      fetchImpl: mockOk({
        success: true,
        data: {
          extract: {
            events: [
              { title: "Bad", startDate: "pronto", category: "concierto" },
              { title: "Good", startDate: "2026-05-15T21:00:00.000Z", category: "concierto" },
            ],
          },
        },
      }),
    });

    const res = await provider.fetch(baseParams());
    expect(res.events.length).toBe(1);
    expect(res.events[0].title).toBe("Good");
    expect(res.warnings.some((w: string) => /unparseable startDate/.test(w))).toBe(true);
  });

  it("maps 401 to unavailable envelope with auth error kind", async () => {
    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "fc-key",
      sources: [TERUEL],
      fetchImpl: mockStatus(401),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("unavailable");
    expect(res.error?.kind).toBe("auth");
    expect(res.events).toEqual([]);
  });

  it("maps 429 to rate_limited + propagates retry-after", async () => {
    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "fc-key",
      sources: [TERUEL],
      fetchImpl: mockStatus(429, { "retry-after": "42" }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("rate_limited");
    expect(res.error?.kind).toBe("rate_limit");
    expect(res.error?.retryAfterSeconds).toBe(42);
  });

  it("maps 5xx to unavailable", async () => {
    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "fc-key",
      sources: [TERUEL],
      fetchImpl: mockStatus(503),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("unavailable");
    expect(res.error?.kind).toBe("network");
  });

  it("maps shape mismatch to parse_error", async () => {
    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "fc-key",
      sources: [TERUEL],
      fetchImpl: mockOk({ success: true, data: { extract: { events: "not an array" } } }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("parse_error");
    expect(res.error?.kind).toBe("parse");
  });

  it("reuses the per-instance scrape cache across fetch() calls", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({
        success: true,
        data: { extract: { events: [
          { title: "E", startDate: "2026-05-15T21:00:00.000Z", category: "concierto" },
        ] } },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new FirecrawlLocalEventsProvider({
      apiKey: "fc-key",
      sources: [TERUEL],
      fetchImpl,
    });

    const p1 = baseParams({ anchor: { latitude: 40.34, longitude: -1.10 }, city: "Teruel" });
    const p2 = baseParams({ anchor: { latitude: 40.35, longitude: -1.11 }, city: "Teruel" });

    await provider.fetch(p1);
    await provider.fetch(p2);
    expect(calls).toBe(1);

    provider.resetScrapeCache();
    await provider.fetch(p1);
    expect(calls).toBe(2);
  });
});
