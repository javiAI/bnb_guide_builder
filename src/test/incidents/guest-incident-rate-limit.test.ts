// Sliding-window rate limit (rama 13D). This helper is shared between the
// public incident POST endpoint (5/hr per slug+IP) and the semantic-search
// endpoint. Locking the contract here protects both callers from silent
// regressions if the implementation is refactored.

import { describe, it, expect } from "vitest";
import { checkSlidingWindowLimit } from "@/lib/services/sliding-window-rate-limit";

const OPTS = {
  windowMs: 60_000,
  maxRequests: 5,
  bucketsSoftCap: 32,
};

describe("checkSlidingWindowLimit", () => {
  it("allows up to maxRequests within the window", () => {
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < 5; i++) {
      const res = checkSlidingWindowLimit(buckets, "a", 1000 + i, OPTS);
      expect(res.allowed).toBe(true);
    }
  });

  it("blocks the N+1 request with a retry-after > 0", () => {
    const buckets = new Map<string, number[]>();
    const start = 1000;
    for (let i = 0; i < 5; i++) {
      checkSlidingWindowLimit(buckets, "a", start + i, OPTS);
    }
    const res = checkSlidingWindowLimit(buckets, "a", start + 10, OPTS);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("prunes requests older than the window and recovers quota", () => {
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < 5; i++) {
      checkSlidingWindowLimit(buckets, "a", 1000 + i, OPTS);
    }
    // advance past windowMs
    const res = checkSlidingWindowLimit(buckets, "a", 1000 + 61_000, OPTS);
    expect(res.allowed).toBe(true);
  });

  it("isolates buckets per key (slug|ip equivalent)", () => {
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < 5; i++) {
      checkSlidingWindowLimit(buckets, "slug-a|1.1.1.1", 1000 + i, OPTS);
    }
    const other = checkSlidingWindowLimit(
      buckets,
      "slug-a|2.2.2.2",
      1005,
      OPTS,
    );
    expect(other.allowed).toBe(true);
  });

  it("evicts oldest buckets when the soft cap is exceeded", () => {
    const buckets = new Map<string, number[]>();
    const smallCap = { ...OPTS, bucketsSoftCap: 4 };
    for (let i = 0; i < 10; i++) {
      checkSlidingWindowLimit(buckets, `key-${i}`, 1000 + i, smallCap);
    }
    expect(buckets.size).toBeLessThanOrEqual(smallCap.bucketsSoftCap);
  });

  it("retryAfter reflects the oldest entry's expiry time", () => {
    const buckets = new Map<string, number[]>();
    const start = 10_000;
    for (let i = 0; i < 5; i++) {
      checkSlidingWindowLimit(buckets, "a", start + i * 1000, OPTS);
    }
    // Oldest entry at t=10_000; expires at t=70_000. Check at t=40_000
    // → retryAfter ≈ 30s (±1 rounding).
    const res = checkSlidingWindowLimit(buckets, "a", 40_000, OPTS);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(29);
    expect(res.retryAfterSeconds).toBeLessThanOrEqual(31);
  });
});
