import { describe, it, expect } from "vitest";
import {
  aggregateLocalEvents,
} from "@/lib/services/local-events/aggregator";
import {
  PROVIDER_PRIORITY,
  type LocalEventSourceProvider,
  type NormalizedEventCandidate,
  type SourceFetchParams,
  type SourceFetchResult,
} from "@/lib/services/local-events/contracts";

// ── Fixtures ──

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

function candidate(
  source: string,
  overrides: Partial<NormalizedEventCandidate> = {},
): NormalizedEventCandidate {
  return {
    source,
    sourceExternalId: `${source}-1`,
    sourceUrl: `https://example.com/${source}`,
    title: "Concierto Sinfónico",
    categoryKey: "le.concert",
    startsAt: new Date("2026-05-10T19:00:00.000Z"),
    confidence: 0.8,
    providerMetadata: {
      nativeCategory: "concerts",
      nativeTypes: [],
      confidence: 0.8,
      retrievedAt: "2026-05-01T00:00:00.000Z",
    },
    retrievedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function okEnvelope(source: string, events: NormalizedEventCandidate[]): SourceFetchResult {
  return {
    source,
    status: "ok",
    events,
    warnings: [],
    fetchedAt: "2026-05-01T00:00:00.000Z",
    durationMs: 10,
  };
}

function stubProvider(
  source: string,
  result: SourceFetchResult | (() => Promise<SourceFetchResult>) | (() => Promise<never>),
): LocalEventSourceProvider {
  const family = source.split(":")[0] as keyof typeof PROVIDER_PRIORITY;
  const priority = PROVIDER_PRIORITY[family] ?? 50;
  return {
    source,
    priority,
    fetch: async () => {
      if (typeof result === "function") return result();
      return result;
    },
  };
}

// ── Tests ──

describe("aggregateLocalEvents — happy path", () => {
  it("merges candidates across 3 providers into 1 canonical event", async () => {
    const phqEv = candidate("predicthq", {
      sourceExternalId: "phq1",
      sourceUrl: "https://www.predicthq.com/events/phq1",
      descriptionMd: "Desc PHQ",
      venueName: "Auditorio Nacional",
      latitude: 40.441,
      longitude: -3.676,
      confidence: 0.9,
    });
    const fcEv = candidate("firecrawl:teruel_turismo", {
      sourceExternalId: "fc1",
      sourceUrl: "https://turismoteruel.es/x",
      imageUrl: "https://turismoteruel.es/img.jpg",
      venueName: "Auditorio Nacional",
      confidence: 0.7,
    });
    const tmEv = candidate("ticketmaster", {
      sourceExternalId: "tm1",
      sourceUrl: "https://www.ticketmaster.es/event/tm1",
      venueName: "Auditorio Nacional",
      confidence: 0.6,
    });

    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [
        stubProvider("predicthq", okEnvelope("predicthq", [phqEv])),
        stubProvider("firecrawl:teruel_turismo", okEnvelope("firecrawl:teruel_turismo", [fcEv])),
        stubProvider("ticketmaster", okEnvelope("ticketmaster", [tmEv])),
      ],
    });

    expect(res.merged).toHaveLength(1);
    const m = res.merged[0];
    expect(m.primarySource).toBe("predicthq");
    expect(m.sourceUrl).toBe("https://www.ticketmaster.es/event/tm1");
    expect(m.imageUrl).toBe("https://turismoteruel.es/img.jpg");
    expect(m.descriptionMd).toBe("Desc PHQ");
    expect(m.contributingSources).toEqual([
      "firecrawl:teruel_turismo",
      "predicthq",
      "ticketmaster",
    ]);
    expect(m.confidence).toBeCloseTo(0.9, 3);
    expect(res.sourceReports.map((r) => r.source).sort()).toEqual([
      "firecrawl:teruel_turismo",
      "predicthq",
      "ticketmaster",
    ]);
    expect(res.sourceReports.every((r) => r.status === "ok")).toBe(true);
    expect(res.warnings).toEqual([]);
  });

  it("keeps distinct events on separate canonical rows", async () => {
    const phqA = candidate("predicthq", { sourceExternalId: "a", title: "Concierto A", venueName: "Teatro Real" });
    const tmB = candidate("ticketmaster", { sourceExternalId: "b", title: "Concierto B", venueName: "Teatro Real", startsAt: new Date("2026-05-15T19:00:00.000Z") });

    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [
        stubProvider("predicthq", okEnvelope("predicthq", [phqA])),
        stubProvider("ticketmaster", okEnvelope("ticketmaster", [tmB])),
      ],
    });

    expect(res.merged).toHaveLength(2);
  });
});

describe("aggregateLocalEvents — partial failure", () => {
  it("continues with remaining sources when one rejects (throws)", async () => {
    const phqEv = candidate("predicthq");
    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [
        stubProvider("predicthq", okEnvelope("predicthq", [phqEv])),
        stubProvider("ticketmaster", async () => {
          throw new Error("boom");
        }),
      ],
    });

    expect(res.merged).toHaveLength(1);
    expect(res.merged[0].primarySource).toBe("predicthq");

    const tmReport = res.sourceReports.find((r) => r.source === "ticketmaster")!;
    expect(tmReport.status).toBe("unavailable");
    expect(tmReport.error?.kind).toBe("network");
    expect(tmReport.error?.message).toContain("boom");
    expect(tmReport.candidateCount).toBe(0);

    expect(res.warnings.some((w) => /ticketmaster.*unexpected/.test(w))).toBe(true);
  });

  it("surfaces provider-reported config_error without failing the tick", async () => {
    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [
        stubProvider("predicthq", {
          source: "predicthq",
          status: "config_error",
          events: [],
          warnings: [],
          error: { kind: "config", message: "PREDICTHQ_API_KEY is not set" },
          fetchedAt: "2026-05-01T00:00:00.000Z",
          durationMs: 1,
        }),
        stubProvider("ticketmaster", okEnvelope("ticketmaster", [candidate("ticketmaster")])),
      ],
    });

    expect(res.merged).toHaveLength(1);
    expect(res.merged[0].primarySource).toBe("ticketmaster");
    const phqReport = res.sourceReports.find((r) => r.source === "predicthq")!;
    expect(phqReport.status).toBe("config_error");
    expect(phqReport.error?.kind).toBe("config");
  });

  it("surfaces rate_limited envelope with retryAfterSeconds preserved", async () => {
    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [
        stubProvider("ticketmaster", {
          source: "ticketmaster",
          status: "rate_limited",
          events: [],
          warnings: [],
          error: { kind: "rate_limit", message: "HTTP 429", retryAfterSeconds: 12 },
          fetchedAt: "2026-05-01T00:00:00.000Z",
          durationMs: 1,
        }),
      ],
    });

    const r = res.sourceReports[0];
    expect(r.status).toBe("rate_limited");
    expect(r.error?.retryAfterSeconds).toBe(12);
  });

  it("treats a provider that returns a malformed envelope as unavailable", async () => {
    const provider: LocalEventSourceProvider = {
      source: "broken",
      priority: 10,
      fetch: async () =>
        ({
          source: "broken",
          status: "ok",
          events: [],
          warnings: [],
          error: { kind: "config", message: "should be forbidden on ok" },
          fetchedAt: "2026-05-01T00:00:00.000Z",
          durationMs: 1,
        }) as unknown as SourceFetchResult,
    };

    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [provider],
    });

    const report = res.sourceReports[0];
    expect(report.status).toBe("unavailable");
    expect(report.error?.kind).toBe("parse");
    expect(res.warnings.some((w) => /malformed envelope/.test(w))).toBe(true);
  });

  it("drops out-of-window candidates as defense and warns", async () => {
    const inWindow = candidate("predicthq", { sourceExternalId: "in" });
    const outWindow = candidate("predicthq", {
      sourceExternalId: "out",
      startsAt: new Date("2027-01-01T00:00:00.000Z"),
    });

    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [
        stubProvider("predicthq", okEnvelope("predicthq", [inWindow, outWindow])),
      ],
    });

    expect(res.merged).toHaveLength(1);
    expect(res.sourceReports[0].candidateCount).toBe(1);
    expect(res.warnings.some((w) => /out-of-window/.test(w))).toBe(true);
  });
});

describe("aggregateLocalEvents — empty / edge cases", () => {
  it("returns empty merged when no sources are configured", async () => {
    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [],
    });
    expect(res.merged).toEqual([]);
    expect(res.sourceReports).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it("returns empty merged when all sources return zero events", async () => {
    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [
        stubProvider("predicthq", okEnvelope("predicthq", [])),
        stubProvider("ticketmaster", okEnvelope("ticketmaster", [])),
      ],
    });
    expect(res.merged).toEqual([]);
    expect(res.sourceReports.every((r) => r.status === "ok")).toBe(true);
    expect(res.sourceReports.every((r) => r.candidateCount === 0)).toBe(true);
  });

  it("preserves per-source warnings verbatim", async () => {
    const res = await aggregateLocalEvents({
      params: baseParams(),
      providers: [
        stubProvider("predicthq", {
          source: "predicthq",
          status: "ok",
          events: [],
          warnings: ["predicthq skipped event (no/invalid start): X"],
          fetchedAt: "2026-05-01T00:00:00.000Z",
          durationMs: 1,
        }),
      ],
    });
    expect(res.sourceReports[0].warnings).toEqual([
      "predicthq skipped event (no/invalid start): X",
    ]);
  });

  it("runs providers in parallel (total duration ~max not sum)", async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const slow = (source: string, ms: number): LocalEventSourceProvider => ({
      source,
      priority: PROVIDER_PRIORITY[source as keyof typeof PROVIDER_PRIORITY] ?? 10,
      fetch: async () => {
        await delay(ms);
        return okEnvelope(source, []);
      },
    });

    const t0 = Date.now();
    await aggregateLocalEvents({
      params: baseParams(),
      providers: [slow("predicthq", 30), slow("ticketmaster", 30), slow("firecrawl", 30)],
    });
    const elapsed = Date.now() - t0;
    // 30ms each; parallel should be well under 90ms (sum). Use generous cap.
    expect(elapsed).toBeLessThan(80);
  });
});
