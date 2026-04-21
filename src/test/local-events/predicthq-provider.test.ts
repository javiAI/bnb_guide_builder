import { describe, it, expect } from "vitest";
import {
  PredictHqEventsProvider,
  mapPredictHqCategory,
  phqRankToConfidence,
} from "@/lib/services/local-events/predicthq-provider";
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
    new Response(JSON.stringify({ error: `HTTP ${status}` }), {
      status,
      headers: { "content-type": "application/json", ...extraHeaders },
    })) as unknown as typeof fetch;
}

describe("mapPredictHqCategory", () => {
  it("maps known PHQ categories to le.* keys", () => {
    expect(mapPredictHqCategory("concerts", [])).toBe("le.concert");
    expect(mapPredictHqCategory("sports", [])).toBe("le.sports");
    expect(mapPredictHqCategory("performing-arts", [])).toBe("le.arts");
    expect(mapPredictHqCategory("festivals", [])).toBe("le.festival");
    expect(mapPredictHqCategory("community", [])).toBe("le.community");
    expect(mapPredictHqCategory("expos", [])).toBe("le.exhibition");
    expect(mapPredictHqCategory("conferences", [])).toBe("le.workshop");
  });

  it("upgrades to le.family/le.nightlife when those labels are present", () => {
    expect(mapPredictHqCategory("concerts", ["family"])).toBe("le.family");
    expect(mapPredictHqCategory("performing-arts", ["family", "kid-friendly"])).toBe("le.family");
    expect(mapPredictHqCategory("concerts", ["nightlife"])).toBe("le.nightlife");
  });

  it("falls back to le.other for unknown categories and undefined", () => {
    expect(mapPredictHqCategory("severe-weather", [])).toBe("le.other");
    expect(mapPredictHqCategory(undefined, [])).toBe("le.other");
  });
});

describe("phqRankToConfidence", () => {
  it("maps 0..100 rank to [0,1]", () => {
    expect(phqRankToConfidence(0)).toBe(0);
    expect(phqRankToConfidence(50)).toBe(0.5);
    expect(phqRankToConfidence(100)).toBe(1);
  });

  it("clamps out-of-range and defaults for null/undefined", () => {
    expect(phqRankToConfidence(150)).toBe(1);
    expect(phqRankToConfidence(-10)).toBe(0);
    expect(phqRankToConfidence(null)).toBe(0.65);
    expect(phqRankToConfidence(undefined)).toBe(0.65);
    expect(phqRankToConfidence(Number.NaN)).toBe(0.65);
  });
});

describe("PredictHqEventsProvider", () => {
  it("returns config_error when API key is missing", async () => {
    const provider = new PredictHqEventsProvider({ apiKey: "" });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("config_error");
    expect(res.error?.kind).toBe("config");
    expect(res.events).toEqual([]);
  });

  it("normalizes a well-formed PHQ response", async () => {
    let capturedUrl: string | null = null;
    let capturedAuth: string | null = null;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      const headers = (init?.headers ?? {}) as Record<string, string>;
      capturedAuth = headers.Authorization ?? null;
      return new Response(
        JSON.stringify({
          count: 1,
          results: [
            {
              id: "phq1",
              title: "Orquesta Nacional",
              description: "Concierto sinfonico.",
              category: "concerts",
              labels: ["music", "classical"],
              start: "2026-05-10T19:00:00Z",
              end: "2026-05-10T21:00:00Z",
              timezone: "Europe/Madrid",
              entities: [
                { name: "Auditorio Nacional", type: "venue", formatted_address: "C/ Principe de Vergara 146, Madrid" },
                { name: "Orquesta Nacional", type: "performer" },
              ],
              geo: { geometry: { type: "Point", coordinates: [-3.676, 40.441] } },
              local_rank: 72,
              rank: 55,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const provider = new PredictHqEventsProvider({ apiKey: "phq-key", fetchImpl });
    const res = await provider.fetch(baseParams());

    expect(res.status).toBe("ok");
    expect(res.events.length).toBe(1);
    const e = res.events[0];
    expect(e.source).toBe("predicthq");
    expect(e.sourceExternalId).toBe("phq1");
    expect(e.sourceUrl).toBe("https://www.predicthq.com/events/phq1");
    expect(e.categoryKey).toBe("le.concert");
    expect(e.venueName).toBe("Auditorio Nacional");
    expect(e.venueAddress).toContain("Principe de Vergara");
    expect(e.latitude).toBeCloseTo(40.441, 3);
    expect(e.longitude).toBeCloseTo(-3.676, 3);
    // local_rank wins over rank
    expect(e.confidence).toBeCloseTo(0.72, 2);
    expect(e.providerMetadata.nativeCategory).toBe("concerts");
    expect(e.providerMetadata.nativeTypes).toEqual(["music", "classical"]);

    expect(capturedAuth).toBe("Bearer phq-key");
    expect(capturedUrl).toMatch(/within=25km%4040.41%2C-3.7/);
    expect(capturedUrl).toMatch(/active.gte=2026-05-01T00%3A00%3A00Z/);
    expect(capturedUrl).toMatch(/active.lte=2026-06-30T23%3A59%3A59Z/);
    expect(capturedUrl).toContain("category=concerts%2Csports%2Cperforming-arts%2Cfestivals%2Ccommunity%2Cexpos%2Cconferences");
  });

  it("falls back to rank when local_rank is missing", async () => {
    const provider = new PredictHqEventsProvider({
      apiKey: "x",
      fetchImpl: mockOk({
        results: [
          {
            id: "phq2",
            title: "X",
            category: "concerts",
            start: "2026-05-10T19:00:00Z",
            rank: 30,
          },
        ],
      }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.events[0].confidence).toBeCloseTo(0.3, 2);
  });

  it("drops events outside the window", async () => {
    const provider = new PredictHqEventsProvider({
      apiKey: "x",
      fetchImpl: mockOk({
        results: [
          { id: "in", title: "In", category: "concerts", start: "2026-05-10T19:00:00Z" },
          { id: "out", title: "Out", category: "concerts", start: "2027-01-10T19:00:00Z" },
        ],
      }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.events.length).toBe(1);
    expect(res.events[0].title).toBe("In");
  });

  it("drops candidates with unparseable start and warns", async () => {
    const provider = new PredictHqEventsProvider({
      apiKey: "x",
      fetchImpl: mockOk({
        results: [
          { id: "bad", title: "Bad", category: "concerts", start: "not-a-date" },
          { id: "good", title: "Good", category: "concerts", start: "2026-05-10T19:00:00Z" },
        ],
      }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.events.length).toBe(1);
    expect(res.events[0].title).toBe("Good");
    expect(res.warnings.some((w: string) => /no\/invalid start/.test(w))).toBe(true);
  });

  it("maps 402 (trial expired) to unavailable + auth, never fatal", async () => {
    const provider = new PredictHqEventsProvider({
      apiKey: "x",
      fetchImpl: mockStatus(402),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("unavailable");
    expect(res.error?.kind).toBe("auth");
    expect(res.error?.message).toContain("402");
    expect(res.events).toEqual([]);
  });

  it("maps 401 and 403 to unavailable + auth", async () => {
    const p401 = new PredictHqEventsProvider({ apiKey: "x", fetchImpl: mockStatus(401) });
    const r401 = await p401.fetch(baseParams());
    expect(r401.status).toBe("unavailable");
    expect(r401.error?.kind).toBe("auth");

    const p403 = new PredictHqEventsProvider({ apiKey: "x", fetchImpl: mockStatus(403) });
    const r403 = await p403.fetch(baseParams());
    expect(r403.status).toBe("unavailable");
    expect(r403.error?.kind).toBe("auth");
  });

  it("maps 429 to rate_limited with retry-after", async () => {
    const provider = new PredictHqEventsProvider({
      apiKey: "x",
      fetchImpl: mockStatus(429, { "retry-after": "7" }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("rate_limited");
    expect(res.error?.retryAfterSeconds).toBe(7);
  });

  it("maps 5xx to unavailable (network)", async () => {
    const provider = new PredictHqEventsProvider({
      apiKey: "x",
      fetchImpl: mockStatus(503),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("unavailable");
    expect(res.error?.kind).toBe("network");
  });

  it("maps shape mismatch to parse_error", async () => {
    const provider = new PredictHqEventsProvider({
      apiKey: "x",
      fetchImpl: mockOk({ results: "not an array" }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("parse_error");
    expect(res.error?.kind).toBe("parse");
  });

  it("maps thrown network error to unavailable", async () => {
    const provider = new PredictHqEventsProvider({
      apiKey: "x",
      fetchImpl: (async () => {
        throw new Error("ETIMEDOUT");
      }) as unknown as typeof fetch,
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("unavailable");
    expect(res.error?.kind).toBe("network");
    expect(res.error?.message).toContain("ETIMEDOUT");
  });

  it("handles empty results gracefully", async () => {
    const provider = new PredictHqEventsProvider({
      apiKey: "x",
      fetchImpl: mockOk({ count: 0, results: [] }),
    });
    const res = await provider.fetch(baseParams());
    expect(res.status).toBe("ok");
    expect(res.events).toEqual([]);
  });
});
