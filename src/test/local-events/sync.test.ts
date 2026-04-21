import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Prisma ──
// The sync service issues all writes inside `$transaction(async (tx) => ...)`.
// The mock wires `tx` to point to the same collection of jest-style fns so
// call counts/args are inspectable after the callback resolves.

const mocks = vi.hoisted(() => {
  const localEventFindMany = vi.fn();
  const localEventUpsert = vi.fn();
  const localEventDeleteMany = vi.fn();
  const linkFindMany = vi.fn();
  const linkUpsert = vi.fn();
  const linkDeleteMany = vi.fn();

  const tx: {
    localEvent: { findMany: typeof localEventFindMany; upsert: typeof localEventUpsert; deleteMany: typeof localEventDeleteMany };
    localEventSourceLink: { findMany: typeof linkFindMany; upsert: typeof linkUpsert; deleteMany: typeof linkDeleteMany };
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
    localEvent: mocks.tx.localEvent,
    localEventSourceLink: mocks.tx.localEventSourceLink,
  },
}));

import { syncLocalEventsForProperty } from "@/lib/services/local-events/sync";
import type { MergedCanonicalEvent } from "@/lib/services/local-events/merge";
import type { CanonicalEventGroup } from "@/lib/services/local-events/canonicalize";
import type { NormalizedEventCandidate } from "@/lib/services/local-events/contracts";
import type { AggregatedLocalEventsResult } from "@/lib/services/local-events/aggregator";

// ── Fixtures ──

function candidate(
  overrides: Partial<NormalizedEventCandidate> = {},
): NormalizedEventCandidate {
  return {
    source: "predicthq",
    sourceExternalId: "phq1",
    sourceUrl: "https://www.predicthq.com/events/phq1",
    title: "Concierto",
    categoryKey: "le.concert",
    startsAt: new Date("2026-05-10T19:00:00.000Z"),
    confidence: 0.8,
    providerMetadata: {
      nativeCategory: "concerts",
      nativeTypes: ["music"],
      confidence: 0.8,
      retrievedAt: "2026-04-21T20:00:00.000Z",
    },
    retrievedAt: "2026-04-21T20:00:00.000Z",
    ...overrides,
  };
}

function mergedFixture(
  overrides: Partial<MergedCanonicalEvent> = {},
): MergedCanonicalEvent {
  return {
    canonicalKey: "abc123",
    title: "Concierto",
    categoryKey: "le.concert",
    startsAt: new Date("2026-05-10T19:00:00.000Z"),
    sourceUrl: "https://www.predicthq.com/events/phq1",
    confidence: 0.8,
    primarySource: "predicthq",
    contributingSources: ["predicthq"],
    mergeWarnings: [],
    ...overrides,
  };
}

function buildAggregated(
  merged: MergedCanonicalEvent[],
  groups: CanonicalEventGroup[],
): AggregatedLocalEventsResult {
  return {
    merged,
    groups,
    sourceReports: [],
    warnings: [],
    startedAt: "2026-04-21T20:00:00.000Z",
  };
}

const PROPERTY_ID = "prop_1";
const TICK_STARTED_AT = new Date("2026-04-21T20:00:00.000Z");

function resetMocks() {
  mocks.transactionMock.mockClear();
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
  mocks.localEventUpsert.mockImplementation(async (args: { create: { canonicalKey: string } }) => ({
    id: `ev_${args.create.canonicalKey}`,
  }));
  mocks.linkUpsert.mockResolvedValue({ id: "link_x" });
}

beforeEach(resetMocks);

// ── Happy path ──

describe("syncLocalEventsForProperty — create path", () => {
  it("creates 1 event + 1 link for a brand-new canonical group", async () => {
    const cand = candidate();
    const merged = mergedFixture();
    const report = await syncLocalEventsForProperty({
      propertyId: PROPERTY_ID,
      aggregated: buildAggregated([merged], [
        { canonicalKey: "abc123", candidates: [cand], matchKind: "strong" },
      ]),
      tickStartedAt: TICK_STARTED_AT,
    });

    expect(report).toEqual({
      eventsCreated: 1,
      eventsUpdated: 0,
      eventsDeleted: 0,
      linksCreated: 1,
      linksUpdated: 0,
      linksDeleted: 0,
    });

    expect(mocks.localEventUpsert).toHaveBeenCalledTimes(1);
    const call = mocks.localEventUpsert.mock.calls[0][0];
    expect(call.where.propertyId_canonicalKey).toEqual({
      propertyId: PROPERTY_ID,
      canonicalKey: "abc123",
    });
    expect(call.create.propertyId).toBe(PROPERTY_ID);
    expect(call.create.lastSyncedAt).toEqual(TICK_STARTED_AT);

    expect(mocks.linkUpsert).toHaveBeenCalledTimes(1);
    const linkCall = mocks.linkUpsert.mock.calls[0][0];
    expect(linkCall.where.propertyId_source_sourceExternalId).toEqual({
      propertyId: PROPERTY_ID,
      source: "predicthq",
      sourceExternalId: "phq1",
    });
    expect(linkCall.create.propertyId).toBe(PROPERTY_ID);
    expect(linkCall.create.eventId).toBe("ev_abc123");
  });

  it("creates 1 event + N links when multiple sources contribute", async () => {
    const phq = candidate({ source: "predicthq", sourceExternalId: "phq1" });
    const tm = candidate({ source: "ticketmaster", sourceExternalId: "tm1", sourceUrl: "https://www.ticketmaster.es/event/tm1" });
    const fc = candidate({ source: "firecrawl:teruel_turismo", sourceExternalId: "fc1", sourceUrl: "https://turismoteruel.es/x" });

    const report = await syncLocalEventsForProperty({
      propertyId: PROPERTY_ID,
      aggregated: buildAggregated(
        [mergedFixture({ contributingSources: ["predicthq", "ticketmaster", "firecrawl:teruel_turismo"] })],
        [{ canonicalKey: "abc123", candidates: [phq, tm, fc], matchKind: "strong" }],
      ),
      tickStartedAt: TICK_STARTED_AT,
    });

    expect(report.eventsCreated).toBe(1);
    expect(report.linksCreated).toBe(3);
    expect(mocks.linkUpsert).toHaveBeenCalledTimes(3);
  });
});

describe("syncLocalEventsForProperty — update path", () => {
  it("updates an existing event matched by canonicalKey and bumps lastSyncedAt", async () => {
    mocks.localEventFindMany.mockResolvedValue([
      { id: "ev_old", canonicalKey: "abc123" },
    ]);
    mocks.linkFindMany.mockResolvedValue([
      {
        id: "link_old",
        eventId: "ev_old",
        source: "predicthq",
        sourceExternalId: "phq1",
      },
    ]);

    const report = await syncLocalEventsForProperty({
      propertyId: PROPERTY_ID,
      aggregated: buildAggregated(
        [mergedFixture({ title: "Concierto (renamed)" })],
        [{ canonicalKey: "abc123", candidates: [candidate()], matchKind: "strong" }],
      ),
      tickStartedAt: TICK_STARTED_AT,
    });

    expect(report).toEqual({
      eventsCreated: 0,
      eventsUpdated: 1,
      eventsDeleted: 0,
      linksCreated: 0,
      linksUpdated: 1,
      linksDeleted: 0,
    });

    const upsertArgs = mocks.localEventUpsert.mock.calls[0][0];
    expect(upsertArgs.update.title).toBe("Concierto (renamed)");
    expect(upsertArgs.update.lastSyncedAt).toEqual(TICK_STARTED_AT);
  });

  it("preserves a link whose (source, sourceExternalId) is reassigned to a different event in the same tick", async () => {
    // Pre-tick: 2 events. `link_moving` belongs to `ev_A`. This tick,
    // canonicalization places `(predicthq, phq1)` under `ev_B` instead.
    // The stale-link sweep must NOT delete `link_moving` — the key is still
    // surfaced in this tick, just under a different eventId.
    mocks.localEventFindMany.mockResolvedValue([
      { id: "ev_keyA", canonicalKey: "keyA" },
      { id: "ev_keyB", canonicalKey: "keyB" },
    ]);
    mocks.linkFindMany.mockResolvedValue([
      {
        id: "link_moving",
        eventId: "ev_keyA",
        source: "predicthq",
        sourceExternalId: "phq1",
      },
    ]);

    const report = await syncLocalEventsForProperty({
      propertyId: PROPERTY_ID,
      aggregated: buildAggregated(
        [
          mergedFixture({ canonicalKey: "keyA", contributingSources: ["ticketmaster"] }),
          mergedFixture({ canonicalKey: "keyB", contributingSources: ["predicthq"] }),
        ],
        [
          {
            canonicalKey: "keyA",
            candidates: [candidate({ source: "ticketmaster", sourceExternalId: "tm1" })],
            matchKind: "strong",
          },
          {
            canonicalKey: "keyB",
            candidates: [candidate({ source: "predicthq", sourceExternalId: "phq1" })],
            matchKind: "strong",
          },
        ],
      ),
      tickStartedAt: TICK_STARTED_AT,
    });

    expect(report.linksUpdated).toBe(1);
    expect(report.linksCreated).toBe(1);
    expect(report.linksDeleted).toBe(0);
    expect(mocks.linkDeleteMany).not.toHaveBeenCalled();

    type UpsertArg = {
      where: { propertyId_source_sourceExternalId: { sourceExternalId: string } };
      update: { eventId: string };
    };
    const movingLinkUpsert = mocks.linkUpsert.mock.calls.find(
      (c) => (c[0] as UpsertArg).where.propertyId_source_sourceExternalId.sourceExternalId === "phq1",
    );
    expect(movingLinkUpsert).toBeDefined();
    expect((movingLinkUpsert![0] as UpsertArg).update.eventId).toBe("ev_keyB");
  });

  it("classifies a source that dropped off this tick as a linksDeleted", async () => {
    mocks.localEventFindMany.mockResolvedValue([
      { id: "ev_abc123", canonicalKey: "abc123" },
    ]);
    mocks.linkFindMany.mockResolvedValue([
      { id: "link_phq", eventId: "ev_abc123", source: "predicthq", sourceExternalId: "phq1" },
      { id: "link_tm",  eventId: "ev_abc123", source: "ticketmaster", sourceExternalId: "tm1" },
    ]);
    mocks.linkDeleteMany.mockResolvedValue({ count: 1 });

    const report = await syncLocalEventsForProperty({
      propertyId: PROPERTY_ID,
      aggregated: buildAggregated(
        [mergedFixture({ contributingSources: ["predicthq"] })],
        [{
          canonicalKey: "abc123",
          candidates: [candidate({ source: "predicthq", sourceExternalId: "phq1" })],
          matchKind: "strong",
        }],
      ),
      tickStartedAt: TICK_STARTED_AT,
    });

    expect(report.linksUpdated).toBe(1);
    expect(report.linksDeleted).toBe(1);

    expect(mocks.linkDeleteMany).toHaveBeenCalledTimes(1);
    const delArgs = mocks.linkDeleteMany.mock.calls[0][0];
    expect(delArgs.where.id.in).toEqual(["link_tm"]);
  });
});

describe("syncLocalEventsForProperty — retention", () => {
  it("deletes future canonical rows not surfaced this tick", async () => {
    mocks.localEventFindMany.mockResolvedValue([
      { id: "ev_stale", canonicalKey: "oldkey" },
      { id: "ev_abc123", canonicalKey: "abc123" },
    ]);
    mocks.localEventDeleteMany.mockResolvedValue({ count: 1 });

    const report = await syncLocalEventsForProperty({
      propertyId: PROPERTY_ID,
      aggregated: buildAggregated(
        [mergedFixture()],
        [{ canonicalKey: "abc123", candidates: [candidate()], matchKind: "strong" }],
      ),
      tickStartedAt: TICK_STARTED_AT,
    });

    expect(report.eventsDeleted).toBe(1);
    const delArgs = mocks.localEventDeleteMany.mock.calls[0][0];
    expect(delArgs.where.propertyId).toBe(PROPERTY_ID);
    expect(delArgs.where.lastSyncedAt.lt).toEqual(TICK_STARTED_AT);
    expect(delArgs.where.startsAt.gte).toEqual(TICK_STARTED_AT);
  });

  it("no-ops when tick is empty and DB is empty", async () => {
    const report = await syncLocalEventsForProperty({
      propertyId: PROPERTY_ID,
      aggregated: buildAggregated([], []),
      tickStartedAt: TICK_STARTED_AT,
    });

    expect(report).toEqual({
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      linksCreated: 0,
      linksUpdated: 0,
      linksDeleted: 0,
    });
    expect(mocks.localEventUpsert).not.toHaveBeenCalled();
    expect(mocks.linkUpsert).not.toHaveBeenCalled();
  });
});

describe("syncLocalEventsForProperty — transaction + invariants", () => {
  it("runs all writes inside a single $transaction callback", async () => {
    await syncLocalEventsForProperty({
      propertyId: PROPERTY_ID,
      aggregated: buildAggregated(
        [mergedFixture()],
        [{ canonicalKey: "abc123", candidates: [candidate()], matchKind: "strong" }],
      ),
      tickStartedAt: TICK_STARTED_AT,
    });

    expect(mocks.transactionMock).toHaveBeenCalledTimes(1);
  });

  it("throws when merged/groups are misaligned", async () => {
    await expect(
      syncLocalEventsForProperty({
        propertyId: PROPERTY_ID,
        aggregated: buildAggregated([mergedFixture()], []),
        tickStartedAt: TICK_STARTED_AT,
      }),
    ).rejects.toThrow(/aligned 1:1/);
  });

  it("serializes priceInfo as JSON when present", async () => {
    await syncLocalEventsForProperty({
      propertyId: PROPERTY_ID,
      aggregated: buildAggregated(
        [mergedFixture({ priceInfo: { free: false, minAmount: 10, maxAmount: 50, currency: "EUR" } })],
        [{ canonicalKey: "abc123", candidates: [candidate()], matchKind: "strong" }],
      ),
      tickStartedAt: TICK_STARTED_AT,
    });

    const upsertArgs = mocks.localEventUpsert.mock.calls[0][0];
    expect(upsertArgs.create.priceInfo).toEqual({
      free: false,
      minAmount: 10,
      maxAmount: 50,
      currency: "EUR",
    });
  });
});
