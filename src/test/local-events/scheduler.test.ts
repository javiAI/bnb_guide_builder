import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Prisma ──

const mocks = vi.hoisted(() => {
  const propertyFindMany = vi.fn();
  const localEventFindMany = vi.fn();
  const localEventUpsert = vi.fn();
  const localEventDeleteMany = vi.fn();
  const linkFindMany = vi.fn();
  const linkUpsert = vi.fn();
  const linkDeleteMany = vi.fn();

  const tx: {
    localEvent: {
      findMany: typeof localEventFindMany;
      upsert: typeof localEventUpsert;
      deleteMany: typeof localEventDeleteMany;
    };
    localEventSourceLink: {
      findMany: typeof linkFindMany;
      upsert: typeof linkUpsert;
      deleteMany: typeof linkDeleteMany;
    };
  } = {
    localEvent: {
      findMany: localEventFindMany,
      upsert: localEventUpsert,
      deleteMany: localEventDeleteMany,
    },
    localEventSourceLink: {
      findMany: linkFindMany,
      upsert: linkUpsert,
      deleteMany: linkDeleteMany,
    },
  };
  const transactionMock = vi.fn(
    async (cb: (txArg: typeof tx) => Promise<unknown>) => cb(tx),
  );

  return {
    propertyFindMany,
    tx,
    transactionMock,
    localEventFindMany,
    localEventUpsert,
    localEventDeleteMany,
    linkFindMany,
    linkUpsert,
    linkDeleteMany,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transactionMock,
    property: { findMany: mocks.propertyFindMany },
    localEvent: mocks.tx.localEvent,
    localEventSourceLink: mocks.tx.localEventSourceLink,
  },
}));

import {
  buildProvidersFromEnv,
  runLocalEventsTick,
} from "@/lib/services/local-events/scheduler";
import type {
  LocalEventSourceProvider,
  NormalizedEventCandidate,
  SourceFetchParams,
  SourceFetchResult,
} from "@/lib/services/local-events/contracts";
import { PROVIDER_PRIORITY } from "@/lib/services/local-events/contracts";

// ── Fixtures ──

function candidate(
  source: string,
  overrides: Partial<NormalizedEventCandidate> = {},
): NormalizedEventCandidate {
  return {
    source,
    sourceExternalId: `${source}-1`,
    sourceUrl: `https://example.com/${source}`,
    title: "Concert",
    categoryKey: "le.concert",
    startsAt: new Date("2026-05-10T19:00:00.000Z"),
    confidence: 0.7,
    providerMetadata: {
      nativeCategory: "concerts",
      nativeTypes: [],
      confidence: 0.7,
      retrievedAt: "2026-04-21T20:00:00.000Z",
    },
    retrievedAt: "2026-04-21T20:00:00.000Z",
    ...overrides,
  };
}

function stubProvider(
  source: string,
  result: SourceFetchResult | (() => Promise<SourceFetchResult>) | (() => never),
): LocalEventSourceProvider {
  const family = source.split(":")[0] as keyof typeof PROVIDER_PRIORITY;
  const priority = PROVIDER_PRIORITY[family] ?? 50;
  return {
    source,
    priority,
    fetch: async (_params: SourceFetchParams) => {
      if (typeof result === "function") return result();
      return result;
    },
  };
}

function okEnvelope(
  source: string,
  events: NormalizedEventCandidate[],
): SourceFetchResult {
  return {
    source,
    status: "ok",
    events,
    warnings: [],
    fetchedAt: "2026-04-21T20:00:00.000Z",
    durationMs: 5,
  };
}

function resetMocks() {
  mocks.transactionMock.mockClear();
  mocks.propertyFindMany.mockReset();
  mocks.localEventFindMany.mockReset();
  mocks.localEventUpsert.mockReset();
  mocks.localEventDeleteMany.mockReset();
  mocks.linkFindMany.mockReset();
  mocks.linkUpsert.mockReset();
  mocks.linkDeleteMany.mockReset();

  mocks.localEventFindMany.mockResolvedValue([]);
  mocks.linkFindMany.mockResolvedValue([]);
  mocks.localEventDeleteMany.mockResolvedValue({ count: 0 });
  mocks.linkDeleteMany.mockResolvedValue({ count: 0 });
  mocks.localEventUpsert.mockImplementation(
    async (args: { create: { canonicalKey: string } }) => ({
      id: `ev_${args.create.canonicalKey}`,
    }),
  );
  mocks.linkUpsert.mockResolvedValue({ id: "link_x" });
}

beforeEach(resetMocks);

// ── Tests ──

describe("runLocalEventsTick", () => {
  it("scans geo-anchored properties and runs aggregate+sync per property", async () => {
    mocks.propertyFindMany.mockResolvedValue([
      {
        id: "p_1",
        propertyNickname: "Casa Albarracín",
        latitude: 40.41,
        longitude: -1.44,
        city: "Albarracín",
        defaultLocale: "es",
      },
      {
        id: "p_2",
        propertyNickname: "Casa Teruel",
        latitude: 40.34,
        longitude: -1.11,
        city: "Teruel",
        defaultLocale: "es",
      },
    ]);

    const report = await runLocalEventsTick({
      now: new Date("2026-04-21T20:00:00.000Z"),
      providers: [
        stubProvider("predicthq", okEnvelope("predicthq", [candidate("predicthq")])),
      ],
    });

    expect(report.propertiesScanned).toBe(2);
    expect(report.perProperty).toHaveLength(2);
    expect(report.perProperty.every((r) => r.error === undefined)).toBe(true);
    expect(report.perProperty.every((r) => r.mergedEventsCount === 1)).toBe(true);
    expect(report.perProperty.every((r) => r.sync?.eventsCreated === 1)).toBe(true);
    expect(report.providersConfigured).toEqual(["predicthq"]);
    expect(report.horizonDays).toBe(60);
  });

  it("filters out properties missing latitude/longitude via where clause", async () => {
    mocks.propertyFindMany.mockResolvedValue([]);

    await runLocalEventsTick({
      now: new Date("2026-04-21T20:00:00.000Z"),
      providers: [],
    });

    expect(mocks.propertyFindMany).toHaveBeenCalledTimes(1);
    const args = mocks.propertyFindMany.mock.calls[0][0];
    expect(args.where).toEqual({
      latitude: { not: null },
      longitude: { not: null },
    });
  });

  it("passes a 60-day window to providers", async () => {
    mocks.propertyFindMany.mockResolvedValue([
      {
        id: "p_1",
        propertyNickname: "X",
        latitude: 40,
        longitude: -3,
        city: "Madrid",
        defaultLocale: "es",
      },
    ]);

    let capturedParams: SourceFetchParams | null = null;
    const capturingProvider: LocalEventSourceProvider = {
      source: "predicthq",
      priority: 100,
      fetch: async (params) => {
        capturedParams = params;
        return okEnvelope("predicthq", []);
      },
    };

    await runLocalEventsTick({
      now: new Date("2026-04-21T20:00:00.000Z"),
      providers: [capturingProvider],
    });

    expect(capturedParams).not.toBeNull();
    const p = capturedParams as unknown as SourceFetchParams;
    const diffDays =
      (p.window.to.getTime() - p.window.from.getTime()) / (86400 * 1000);
    expect(diffDays).toBe(60);
    expect(p.anchor).toEqual({ latitude: 40, longitude: -3 });
    expect(p.city).toBe("Madrid");
    expect(p.locale).toBe("es");
  });

  it("isolates a per-property failure without halting the tick", async () => {
    mocks.propertyFindMany.mockResolvedValue([
      {
        id: "p_1",
        propertyNickname: "Ok",
        latitude: 40,
        longitude: -3,
        city: "Madrid",
        defaultLocale: "es",
      },
      {
        id: "p_2",
        propertyNickname: "Bad",
        latitude: 40,
        longitude: -3,
        city: "Madrid",
        defaultLocale: "es",
      },
    ]);

    // Fail sync on the second property — transaction callback throws.
    let calls = 0;
    mocks.transactionMock.mockImplementation(
      async (cb: (tx: typeof mocks.tx) => Promise<unknown>) => {
        calls += 1;
        if (calls === 2) throw new Error("simulated DB failure");
        return cb(mocks.tx);
      },
    );

    const report = await runLocalEventsTick({
      now: new Date("2026-04-21T20:00:00.000Z"),
      providers: [stubProvider("predicthq", okEnvelope("predicthq", []))],
    });

    expect(report.perProperty).toHaveLength(2);
    expect(report.perProperty[0].error).toBeUndefined();
    expect(report.perProperty[1].error).toContain("simulated DB failure");
    expect(report.perProperty[1].sync).toBeNull();
  });

  it("honors defaultLocale=en for locale mapping", async () => {
    mocks.propertyFindMany.mockResolvedValue([
      {
        id: "p_en",
        propertyNickname: "Z",
        latitude: 40,
        longitude: -3,
        city: "London",
        defaultLocale: "en",
      },
    ]);

    let capturedLocale: string | null = null;
    const p: LocalEventSourceProvider = {
      source: "predicthq",
      priority: 100,
      fetch: async (params) => {
        capturedLocale = params.locale;
        return okEnvelope("predicthq", []);
      },
    };

    await runLocalEventsTick({
      now: new Date("2026-04-21T20:00:00.000Z"),
      providers: [p],
    });

    expect(capturedLocale).toBe("en");
  });

  it("carries aggregator source reports into perProperty output", async () => {
    mocks.propertyFindMany.mockResolvedValue([
      {
        id: "p_1",
        propertyNickname: "X",
        latitude: 40,
        longitude: -3,
        city: "Madrid",
        defaultLocale: "es",
      },
    ]);

    const report = await runLocalEventsTick({
      now: new Date("2026-04-21T20:00:00.000Z"),
      providers: [
        stubProvider("predicthq", {
          source: "predicthq",
          status: "config_error",
          events: [],
          warnings: [],
          error: { kind: "config", message: "PREDICTHQ_API_KEY is not set" },
          fetchedAt: "2026-04-21T20:00:00.000Z",
          durationMs: 1,
        }),
      ],
    });

    const perProp = report.perProperty[0];
    expect(perProp.sourceReports).toHaveLength(1);
    expect(perProp.sourceReports[0].status).toBe("config_error");
    expect(perProp.mergedEventsCount).toBe(0);
  });
});

describe("buildProvidersFromEnv", () => {
  const ORIGINAL_ENV = { ...process.env };
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("instantiates all 3 providers even when keys are missing", () => {
    delete process.env.PREDICTHQ_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.TICKETMASTER_API_KEY;

    const providers = buildProvidersFromEnv();
    expect(providers.map((p) => p.source)).toEqual([
      "predicthq",
      "firecrawl",
      "ticketmaster",
    ]);
  });

  it("returns providers that degrade to config_error when called with empty keys", async () => {
    delete process.env.PREDICTHQ_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.TICKETMASTER_API_KEY;

    const providers = buildProvidersFromEnv();
    const results = await Promise.all(
      providers.map((p) =>
        p.fetch({
          anchor: { latitude: 40, longitude: -3 },
          locale: "es",
          city: "Madrid",
          window: {
            from: new Date("2026-05-01T00:00:00Z"),
            to: new Date("2026-05-10T00:00:00Z"),
          },
        }),
      ),
    );
    expect(results.every((r) => r.status === "config_error")).toBe(true);
    expect(results.every((r) => r.error?.kind === "config")).toBe(true);
  });
});
