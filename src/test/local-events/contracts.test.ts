import { describe, it, expect } from "vitest";
import {
  NormalizedEventCandidateSchema,
  PriceInfoSchema,
  ProviderMetadataSchema,
  SourceErrorSchema,
  SourceFetchResultSchema,
  PROVIDER_PRIORITY,
} from "@/lib/services/local-events/contracts";

// Minimal valid candidate fixture. Individual tests clone + mutate this to
// target one invariant at a time — keeps each failure-mode test self-evident.
function validCandidate() {
  return {
    source: "predicthq",
    sourceExternalId: "phq-abc123",
    sourceUrl: "https://www.predicthq.com/events/phq-abc123",
    title: "Concierto de la Orquesta Nacional",
    categoryKey: "le.concert",
    startsAt: new Date("2026-05-10T19:00:00.000Z"),
    endsAt: new Date("2026-05-10T21:00:00.000Z"),
    venueName: "Palau de la Música",
    venueAddress: "C/ Palau 1, Valencia",
    latitude: 39.47,
    longitude: -0.375,
    confidence: 0.82,
    providerMetadata: {
      nativeCategory: "concerts",
      nativeTypes: ["concerts", "music"],
      confidence: 0.82,
      retrievedAt: "2026-04-21T08:00:00.000Z",
    },
    retrievedAt: "2026-04-21T08:00:00.000Z",
  };
}

describe("NormalizedEventCandidateSchema", () => {
  it("accepts a well-formed candidate", () => {
    const res = NormalizedEventCandidateSchema.safeParse(validCandidate());
    expect(res.success).toBe(true);
  });

  it("rejects categoryKey that is not a registered `le.*` key", () => {
    const res = NormalizedEventCandidateSchema.safeParse({
      ...validCandidate(),
      categoryKey: "music",
    });
    expect(res.success).toBe(false);
  });

  it("rejects unknown `le.*` ids (not in taxonomy)", () => {
    const res = NormalizedEventCandidateSchema.safeParse({
      ...validCandidate(),
      categoryKey: "le.unknown_bogus",
    });
    expect(res.success).toBe(false);
  });

  it("rejects cross-namespace leaks (`lp.*`)", () => {
    const res = NormalizedEventCandidateSchema.safeParse({
      ...validCandidate(),
      categoryKey: "lp.restaurant",
    });
    expect(res.success).toBe(false);
  });

  it("rejects latitude out of [-90, 90]", () => {
    const res = NormalizedEventCandidateSchema.safeParse({
      ...validCandidate(),
      latitude: 95,
    });
    expect(res.success).toBe(false);
  });

  it("rejects longitude out of [-180, 180]", () => {
    const res = NormalizedEventCandidateSchema.safeParse({
      ...validCandidate(),
      longitude: 181,
    });
    expect(res.success).toBe(false);
  });

  it("rejects latitude without longitude (both-or-neither invariant)", () => {
    const base = validCandidate();
    const partial: Record<string, unknown> = { ...base };
    delete partial.longitude;
    const res = NormalizedEventCandidateSchema.safeParse(partial);
    expect(res.success).toBe(false);
  });

  it("rejects longitude without latitude (both-or-neither invariant)", () => {
    const base = validCandidate();
    const partial: Record<string, unknown> = { ...base };
    delete partial.latitude;
    const res = NormalizedEventCandidateSchema.safeParse(partial);
    expect(res.success).toBe(false);
  });

  it("accepts a candidate with no coordinates at all", () => {
    const base = validCandidate();
    const partial: Record<string, unknown> = { ...base };
    delete partial.latitude;
    delete partial.longitude;
    const res = NormalizedEventCandidateSchema.safeParse(partial);
    expect(res.success).toBe(true);
  });

  it("rejects endsAt < startsAt", () => {
    const res = NormalizedEventCandidateSchema.safeParse({
      ...validCandidate(),
      startsAt: new Date("2026-05-10T21:00:00.000Z"),
      endsAt: new Date("2026-05-10T19:00:00.000Z"),
    });
    expect(res.success).toBe(false);
  });

  it("accepts endsAt === startsAt (point-in-time events)", () => {
    const ts = new Date("2026-05-10T19:00:00.000Z");
    const res = NormalizedEventCandidateSchema.safeParse({
      ...validCandidate(),
      startsAt: ts,
      endsAt: new Date(ts.getTime()),
    });
    expect(res.success).toBe(true);
  });

  it("rejects confidence outside [0, 1]", () => {
    expect(
      NormalizedEventCandidateSchema.safeParse({
        ...validCandidate(),
        confidence: 1.2,
      }).success,
    ).toBe(false);
    expect(
      NormalizedEventCandidateSchema.safeParse({
        ...validCandidate(),
        confidence: -0.1,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid sourceUrl / imageUrl", () => {
    expect(
      NormalizedEventCandidateSchema.safeParse({
        ...validCandidate(),
        sourceUrl: "not-a-url",
      }).success,
    ).toBe(false);
    expect(
      NormalizedEventCandidateSchema.safeParse({
        ...validCandidate(),
        imageUrl: "also-not-a-url",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown top-level fields (strict)", () => {
    const res = NormalizedEventCandidateSchema.safeParse({
      ...validCandidate(),
      extraVendorField: "leak",
    });
    expect(res.success).toBe(false);
  });
});

describe("PriceInfoSchema", () => {
  it("requires at least one field", () => {
    const res = PriceInfoSchema.safeParse({});
    expect(res.success).toBe(false);
  });

  it("accepts a free-only price", () => {
    const res = PriceInfoSchema.safeParse({ free: true });
    expect(res.success).toBe(true);
  });

  it("accepts a range with currency", () => {
    const res = PriceInfoSchema.safeParse({
      minAmount: 10,
      maxAmount: 25,
      currency: "EUR",
    });
    expect(res.success).toBe(true);
  });

  it("rejects maxAmount < minAmount", () => {
    const res = PriceInfoSchema.safeParse({
      minAmount: 30,
      maxAmount: 20,
      currency: "EUR",
    });
    expect(res.success).toBe(false);
  });

  it("rejects negative amounts", () => {
    expect(
      PriceInfoSchema.safeParse({ minAmount: -1, currency: "EUR" }).success,
    ).toBe(false);
  });

  it("rejects currency codes not length 3", () => {
    expect(PriceInfoSchema.safeParse({ free: true, currency: "EU" }).success).toBe(
      false,
    );
    expect(
      PriceInfoSchema.safeParse({ free: true, currency: "EURO" }).success,
    ).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    const res = PriceInfoSchema.safeParse({
      free: true,
      extra: "nope",
    });
    expect(res.success).toBe(false);
  });
});

describe("ProviderMetadataSchema", () => {
  it("accepts a well-formed metadata row", () => {
    const res = ProviderMetadataSchema.safeParse({
      nativeCategory: "concerts",
      nativeTypes: ["music", "rock"],
      confidence: 0.7,
      retrievedAt: "2026-04-21T08:00:00.000Z",
    });
    expect(res.success).toBe(true);
  });

  it("allows null nativeCategory and confidence", () => {
    const res = ProviderMetadataSchema.safeParse({
      nativeCategory: null,
      nativeTypes: [],
      confidence: null,
      retrievedAt: "2026-04-21T08:00:00.000Z",
    });
    expect(res.success).toBe(true);
  });

  it("rejects unknown fields (strict)", () => {
    const res = ProviderMetadataSchema.safeParse({
      nativeCategory: null,
      nativeTypes: [],
      confidence: null,
      retrievedAt: "2026-04-21T08:00:00.000Z",
      vendorRaw: { leak: true },
    });
    expect(res.success).toBe(false);
  });

  it("rejects non-ISO retrievedAt", () => {
    const res = ProviderMetadataSchema.safeParse({
      nativeCategory: null,
      nativeTypes: [],
      confidence: null,
      retrievedAt: "2026-04-21 08:00",
    });
    expect(res.success).toBe(false);
  });
});

describe("SourceErrorSchema", () => {
  it("accepts every declared error kind", () => {
    for (const kind of [
      "config",
      "auth",
      "rate_limit",
      "network",
      "parse",
      "disabled",
    ] as const) {
      const res = SourceErrorSchema.safeParse({ kind, message: "x" });
      expect(res.success, kind).toBe(true);
    }
  });

  it("rejects unknown kinds", () => {
    const res = SourceErrorSchema.safeParse({ kind: "weird", message: "x" });
    expect(res.success).toBe(false);
  });

  it("rejects empty messages", () => {
    const res = SourceErrorSchema.safeParse({ kind: "network", message: "" });
    expect(res.success).toBe(false);
  });
});

describe("SourceFetchResultSchema", () => {
  function okEnvelope() {
    return {
      source: "predicthq",
      status: "ok" as const,
      events: [validCandidate()],
      warnings: [],
      fetchedAt: "2026-04-21T08:00:01.000Z",
      durationMs: 412,
    };
  }

  it("accepts an ok envelope with events", () => {
    const res = SourceFetchResultSchema.safeParse(okEnvelope());
    expect(res.success).toBe(true);
  });

  it("forbids error on ok status", () => {
    const res = SourceFetchResultSchema.safeParse({
      ...okEnvelope(),
      error: { kind: "network", message: "oops" },
    });
    expect(res.success).toBe(false);
  });

  it("forbids events when status !== ok", () => {
    const res = SourceFetchResultSchema.safeParse({
      ...okEnvelope(),
      status: "rate_limited",
      events: [validCandidate()],
      error: { kind: "rate_limit", message: "429" },
    });
    expect(res.success).toBe(false);
  });

  it("requires error for non-ok, non-disabled status", () => {
    const res = SourceFetchResultSchema.safeParse({
      ...okEnvelope(),
      status: "unavailable",
      events: [],
    });
    expect(res.success).toBe(false);
  });

  it("accepts disabled status without error", () => {
    const res = SourceFetchResultSchema.safeParse({
      ...okEnvelope(),
      status: "disabled",
      events: [],
    });
    expect(res.success).toBe(true);
  });

  it("accepts rate_limited with error + retryAfterSeconds", () => {
    const res = SourceFetchResultSchema.safeParse({
      ...okEnvelope(),
      status: "rate_limited",
      events: [],
      error: {
        kind: "rate_limit",
        message: "429 Too Many Requests",
        retryAfterSeconds: 60,
      },
    });
    expect(res.success).toBe(true);
  });

  it("rejects unknown fields (strict)", () => {
    const res = SourceFetchResultSchema.safeParse({
      ...okEnvelope(),
      vendorPayload: { leak: true },
    });
    expect(res.success).toBe(false);
  });
});

describe("PROVIDER_PRIORITY", () => {
  it("orders PHQ > Firecrawl > Ticketmaster", () => {
    expect(PROVIDER_PRIORITY.predicthq).toBeGreaterThan(
      PROVIDER_PRIORITY.firecrawl,
    );
    expect(PROVIDER_PRIORITY.firecrawl).toBeGreaterThan(
      PROVIDER_PRIORITY.ticketmaster,
    );
  });

  it("is frozen (cannot be mutated at runtime)", () => {
    expect(Object.isFrozen(PROVIDER_PRIORITY)).toBe(true);
  });
});
