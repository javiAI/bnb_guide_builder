import { describe, it, expect } from "vitest";
import {
  TicketmasterEventsProvider,
  mapTicketmasterSegment,
} from "@/lib/services/local-events/ticketmaster-provider";
import type { SourceFetchParams } from "@/lib/services/local-events/contracts";

function baseParams(overrides: Partial<SourceFetchParams> = {}): SourceFetchParams {
  return {
    anchor: { latitude: 40.41, longitude: -3.70 },
    locale: "es",
    city: "Madrid",
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
    new Response(JSON.stringify({ fault: { faultstring: `HTTP ${status}` } }), {
      status,
      headers: { "content-type": "application/json", ...extraHeaders },
    })) as unknown as typeof fetch;
}

describe("mapTicketmasterSegment", () => {
  it("maps top-level segments to le.* keys", () => {
    expect(mapTicketmasterSegment("Music", undefined)).toBe("le.concert");
    expect(mapTicketmasterSegment("Sports", undefined)).toBe("le.sports");
    expect(mapTicketmasterSegment("Arts & Theatre", undefined)).toBe("le.arts");
    expect(mapTicketmasterSegment("Family", undefined)).toBe("le.family");
  });

  it("uses genre hints when segment is unknown/missing", () => {
    expect(mapTicketmasterSegment(undefined, "Festival")).toBe("le.festival");
    expect(mapTicketmasterSegment("Miscellaneous", "Stand-up Comedy")).toBe("le.other");
    expect(mapTicketmasterSegment(undefined, "comedy show")).toBe("le.nightlife");
  });

  it("falls back to le.other for unknown segment + genre", () => {
    expect(mapTicketmasterSegment("Weirdness", "Bizarre")).toBe("le.other");
    expect(mapTicketmasterSegment(undefined, undefined)).toBe("le.other");
  });
});

describe("TicketmasterEventsProvider", () => {
  it("returns config_error when API key is missing", async () => {
    const provider = new TicketmasterEventsProvider({ apiKey: "" });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("config_error");
    expect(res.error?.kind).toBe("config");
    expect(res.events).toEqual([]);
  });

  it("normalizes a well-formed TM response", async () => {
    let capturedUrl: string | null = null;
    const fetchImpl = (async (input: string | URL | Request) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      return new Response(
        JSON.stringify({
          _embedded: {
            events: [
              {
                id: "vv1",
                name: "Concierto de Prueba",
                url: "https://www.ticketmaster.es/event/vv1",
                info: "Un concierto inolvidable.",
                dates: {
                  start: { dateTime: "2026-05-10T19:00:00Z" },
                  end: { dateTime: "2026-05-10T22:00:00Z" },
                },
                images: [
                  { url: "https://tm/img/1_1024.jpg", width: 1024 },
                  { url: "https://tm/img/1_400.jpg", width: 400 },
                ],
                priceRanges: [{ currency: "EUR", min: 20, max: 50 }],
                classifications: [
                  {
                    segment: { name: "Music" },
                    genre: { name: "Rock" },
                    subGenre: { name: "Alternative" },
                  },
                ],
                _embedded: {
                  venues: [
                    {
                      name: "Sala WiZink",
                      address: { line1: "Av Felipe II s/n" },
                      city: { name: "Madrid" },
                      location: { latitude: "40.423", longitude: "-3.672" },
                    },
                  ],
                },
              },
            ],
          },
          page: { totalElements: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const provider = new TicketmasterEventsProvider({ apiKey: "tm-key", fetchImpl });
    const res = await provider.fetch(baseParams());

    expect(res.status).toBe("ok");
    expect(res.events.length).toBe(1);
    const e = res.events[0];
    expect(e.source).toBe("ticketmaster");
    expect(e.sourceExternalId).toBe("vv1");
    expect(e.categoryKey).toBe("le.concert");
    expect(e.venueName).toBe("Sala WiZink");
    expect(e.venueAddress).toBe("Av Felipe II s/n, Madrid");
    expect(e.latitude).toBeCloseTo(40.423, 3);
    expect(e.longitude).toBeCloseTo(-3.672, 3);
    expect(e.imageUrl).toBe("https://tm/img/1_1024.jpg");
    expect(e.priceInfo).toEqual({ minAmount: 20, maxAmount: 50, currency: "EUR" });
    expect(e.providerMetadata.nativeTypes).toContain("Rock");
    expect(e.providerMetadata.nativeTypes).toContain("Alternative");

    expect(capturedUrl).toContain("latlong=40.41%2C-3.7");
    expect(capturedUrl).toContain("radius=25");
    expect(capturedUrl).toContain("unit=km");
    expect(capturedUrl).toContain("locale=es");
    expect(capturedUrl).toMatch(/startDateTime=2026-05-01T00%3A00%3A00Z/);
    expect(capturedUrl).toMatch(/endDateTime=2026-06-30T23%3A59%3A59Z/);
  });

  it("accepts localDate-only events by treating as UTC midnight", async () => {
    const provider = new TicketmasterEventsProvider({
      apiKey: "tm-key",
      fetchImpl: mockOk({
        _embedded: {
          events: [
            {
              id: "ld1",
              name: "All-day Festival",
              dates: { start: { localDate: "2026-05-15" } },
              classifications: [{ segment: { name: "Music" }, genre: { name: "Festival" } }],
            },
          ],
        },
      }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.events.length).toBe(1);
    expect(res.events[0].startsAt.toISOString()).toBe("2026-05-15T00:00:00.000Z");
  });

  it("falls back to public deep-link when ev.url is missing", async () => {
    const provider = new TicketmasterEventsProvider({
      apiKey: "tm-key",
      fetchImpl: mockOk({
        _embedded: {
          events: [
            {
              id: "no-url-1",
              name: "Evento sin URL",
              // no `url` field — provider must synthesize a fallback
              dates: { start: { dateTime: "2026-05-10T19:00:00Z" } },
              classifications: [{ segment: { name: "Music" } }],
            },
          ],
        },
      }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.events.length).toBe(1);
    expect(res.events[0].sourceUrl).toBe(
      "https://www.ticketmaster.com/event/no-url-1",
    );
  });

  it("falls back to public deep-link when ev.url is not a valid http URL", async () => {
    const provider = new TicketmasterEventsProvider({
      apiKey: "tm-key",
      fetchImpl: mockOk({
        _embedded: {
          events: [
            {
              id: "bad-url-1",
              name: "URL inválida",
              url: "not-a-real-url",
              dates: { start: { dateTime: "2026-05-10T19:00:00Z" } },
              classifications: [{ segment: { name: "Music" } }],
            },
          ],
        },
      }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.events[0].sourceUrl).toBe(
      "https://www.ticketmaster.com/event/bad-url-1",
    );
  });

  it("drops events outside the window", async () => {
    const provider = new TicketmasterEventsProvider({
      apiKey: "tm-key",
      fetchImpl: mockOk({
        _embedded: {
          events: [
            { id: "a", name: "In", dates: { start: { dateTime: "2026-05-10T19:00:00Z" } }, classifications: [{ segment: { name: "Music" } }] },
            { id: "b", name: "Out", dates: { start: { dateTime: "2027-01-10T19:00:00Z" } }, classifications: [{ segment: { name: "Music" } }] },
          ],
        },
      }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.events.length).toBe(1);
    expect(res.events[0].title).toBe("In");
  });

  it("drops free price range (min=max=0) as free=true", async () => {
    const provider = new TicketmasterEventsProvider({
      apiKey: "tm-key",
      fetchImpl: mockOk({
        _embedded: {
          events: [
            {
              id: "free1",
              name: "Charla gratuita",
              dates: { start: { dateTime: "2026-05-10T18:00:00Z" } },
              priceRanges: [{ currency: "EUR", min: 0, max: 0 }],
              classifications: [{ segment: { name: "Arts & Theatre" } }],
            },
          ],
        },
      }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.events[0].priceInfo).toEqual({ free: true, minAmount: 0, maxAmount: 0, currency: "EUR" });
  });

  it("maps 401 to auth error, 429 to rate_limited with retry-after", async () => {
    const p401 = new TicketmasterEventsProvider({ apiKey: "x", fetchImpl: mockStatus(401) });
    const r401 = await p401.fetch(baseParams());
    expect(r401.status).toBe("unavailable");
    expect(r401.error?.kind).toBe("auth");

    const p429 = new TicketmasterEventsProvider({
      apiKey: "x",
      fetchImpl: mockStatus(429, { "retry-after": "13" }),
    });
    const r429 = await p429.fetch(baseParams());
    expect(r429.status).toBe("rate_limited");
    expect(r429.error?.kind).toBe("rate_limit");
    expect(r429.error?.retryAfterSeconds).toBe(13);
  });

  it("maps 5xx to unavailable (network)", async () => {
    const provider = new TicketmasterEventsProvider({
      apiKey: "x",
      fetchImpl: mockStatus(503),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("unavailable");
    expect(res.error?.kind).toBe("network");
  });

  it("maps shape mismatch to parse_error", async () => {
    const provider = new TicketmasterEventsProvider({
      apiKey: "x",
      fetchImpl: mockOk({ _embedded: { events: "not an array" } }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("parse_error");
    expect(res.error?.kind).toBe("parse");
  });

  it("maps thrown network error to unavailable (network)", async () => {
    const provider = new TicketmasterEventsProvider({
      apiKey: "x",
      fetchImpl: (async () => {
        throw new Error("ECONNRESET");
      }) as unknown as typeof fetch,
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("unavailable");
    expect(res.error?.kind).toBe("network");
    expect(res.error?.message).toContain("ECONNRESET");
  });

  it("returns ok with no events when TM returns empty page", async () => {
    const provider = new TicketmasterEventsProvider({
      apiKey: "x",
      fetchImpl: mockOk({ _embedded: { events: [] }, page: { totalElements: 0 } }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("ok");
    expect(res.events).toEqual([]);
  });
});
