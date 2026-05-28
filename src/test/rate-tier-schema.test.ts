import { describe, expect, it } from "vitest";
import {
  RATE_TIER_PERS,
  rateJsonSchema,
  rateTierSchema,
  type RateTier,
  type RateTierPer,
} from "@/lib/schemas/rate-tier.schema";

/**
 * Canonical-schema invariants for `LocalPlace.rateJson` (paid parking,
 * future paid arrival options). Pinning this validation prevents downstream
 * presenters from having to defend against malformed tiers.
 */

describe("rateTierSchema — single tier validation", () => {
  it("accepts a well-formed tier", () => {
    const tier: RateTier = { amount: 2.5, currency: "EUR", per: "hour" };
    expect(rateTierSchema.parse(tier)).toEqual(tier);
  });

  it("accepts an optional note up to 200 chars", () => {
    const tier = {
      amount: 18,
      currency: "EUR",
      per: "day" as const,
      note: "First 24h cap",
    };
    expect(rateTierSchema.parse(tier).note).toBe("First 24h cap");
  });

  it("rejects negative amounts", () => {
    expect(() =>
      rateTierSchema.parse({ amount: -1, currency: "EUR", per: "hour" }),
    ).toThrow();
  });

  it("accepts zero amount (some free-but-tiered structures)", () => {
    expect(() =>
      rateTierSchema.parse({ amount: 0, currency: "EUR", per: "hour" }),
    ).not.toThrow();
  });

  it("rejects empty currency string", () => {
    expect(() =>
      rateTierSchema.parse({ amount: 2, currency: "", per: "hour" }),
    ).toThrow();
  });

  it("rejects currency longer than 8 chars", () => {
    expect(() =>
      rateTierSchema.parse({
        amount: 2,
        currency: "VERY_LONG_CCY",
        per: "hour",
      }),
    ).toThrow();
  });

  it("rejects unknown `per` cadence", () => {
    expect(() =>
      rateTierSchema.parse({
        amount: 2,
        currency: "EUR",
        per: "century" as unknown as RateTierPer,
      }),
    ).toThrow();
  });

  it("rejects notes longer than 200 chars", () => {
    expect(() =>
      rateTierSchema.parse({
        amount: 2,
        currency: "EUR",
        per: "hour",
        note: "x".repeat(201),
      }),
    ).toThrow();
  });

  it("strict mode rejects extra keys (forward-compat guard)", () => {
    expect(() =>
      rateTierSchema.parse({
        amount: 2,
        currency: "EUR",
        per: "hour",
        bogus: true,
      }),
    ).toThrow();
  });
});

describe("rateJsonSchema — array of tiers", () => {
  it("accepts an empty array (cleared tariff)", () => {
    expect(rateJsonSchema.parse([])).toEqual([]);
  });

  it("accepts a multi-tier structure (e.g. minute + day cap)", () => {
    const tiers = [
      { amount: 0.05, currency: "EUR", per: "minute" as const },
      { amount: 18, currency: "EUR", per: "day" as const, note: "Cap" },
    ];
    expect(rateJsonSchema.parse(tiers)).toEqual(tiers);
  });

  it("rejects more than 10 tiers (JSON column compactness)", () => {
    const tiers = Array.from({ length: 11 }, () => ({
      amount: 1,
      currency: "EUR",
      per: "hour" as const,
    }));
    expect(() => rateJsonSchema.parse(tiers)).toThrow();
  });

  it("rejects an array that contains an invalid tier (any single fail = array fail)", () => {
    const tiers = [
      { amount: 1, currency: "EUR", per: "hour" as const },
      { amount: -1, currency: "EUR", per: "hour" as const },
    ];
    expect(() => rateJsonSchema.parse(tiers)).toThrow();
  });
});

describe("RATE_TIER_PERS — canonical cadence set", () => {
  it("exposes exactly the 5 supported cadences", () => {
    const expected: RateTierPer[] = ["minute", "hour", "day", "week", "month"];
    for (const per of expected) {
      expect(RATE_TIER_PERS.has(per)).toBe(true);
    }
    expect(RATE_TIER_PERS.size).toBe(expected.length);
  });

  it("does NOT contain unsupported cadences (defense against typos in callers)", () => {
    expect(RATE_TIER_PERS.has("year" as RateTierPer)).toBe(false);
    expect(RATE_TIER_PERS.has("decade" as RateTierPer)).toBe(false);
  });
});
