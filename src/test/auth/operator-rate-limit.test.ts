import { describe, it, expect, beforeEach } from "vitest";
import {
  applyOperatorRateLimit,
  OPERATOR_RATE_LIMITS,
  __resetOperatorRateLimitForTests,
} from "@/lib/services/operator-rate-limit";

describe("applyOperatorRateLimit", () => {
  beforeEach(() => {
    __resetOperatorRateLimitForTests();
  });

  it("read bucket allows 60 req/60s and rejects the 61st", () => {
    const t0 = 1_000_000;
    const userId = "user-A";
    for (let i = 0; i < 60; i++) {
      const r = applyOperatorRateLimit({ userId, bucket: "read", now: t0 + i });
      expect(r.ok).toBe(true);
    }
    const r = applyOperatorRateLimit({ userId, bucket: "read", now: t0 + 60 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryAfterSeconds).toBeGreaterThan(0);
      expect(r.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("mutate bucket allows 20 req/60s and rejects the 21st", () => {
    const t0 = 2_000_000;
    const userId = "user-B";
    for (let i = 0; i < 20; i++) {
      const r = applyOperatorRateLimit({ userId, bucket: "mutate", now: t0 + i });
      expect(r.ok).toBe(true);
    }
    const r = applyOperatorRateLimit({ userId, bucket: "mutate", now: t0 + 20 });
    expect(r.ok).toBe(false);
  });

  it("expensive bucket allows 10 req/60s and rejects the 11th", () => {
    const t0 = 3_000_000;
    const userId = "user-C";
    for (let i = 0; i < 10; i++) {
      const r = applyOperatorRateLimit({ userId, bucket: "expensive", now: t0 + i });
      expect(r.ok).toBe(true);
    }
    const r = applyOperatorRateLimit({ userId, bucket: "expensive", now: t0 + 10 });
    expect(r.ok).toBe(false);
  });

  it("buckets are isolated per userId (cross-user does not share quota)", () => {
    const t0 = 4_000_000;
    for (let i = 0; i < 10; i++) {
      const r = applyOperatorRateLimit({ userId: "u1", bucket: "expensive", now: t0 + i });
      expect(r.ok).toBe(true);
    }
    // u2 has its own bucket — should still be allowed.
    const r = applyOperatorRateLimit({ userId: "u2", bucket: "expensive", now: t0 });
    expect(r.ok).toBe(true);
  });

  it("buckets are isolated per category (read does not consume mutate quota)", () => {
    const t0 = 5_000_000;
    const userId = "user-D";
    for (let i = 0; i < 60; i++) {
      applyOperatorRateLimit({ userId, bucket: "read", now: t0 + i });
    }
    // read is exhausted, mutate must still be open
    const r = applyOperatorRateLimit({ userId, bucket: "mutate", now: t0 + 61 });
    expect(r.ok).toBe(true);
  });

  it("retryAfterSeconds reports a positive integer when limited", () => {
    const t0 = 6_000_000;
    const userId = "user-E";
    for (let i = 0; i < 10; i++) {
      applyOperatorRateLimit({ userId, bucket: "expensive", now: t0 + i * 100 });
    }
    const r = applyOperatorRateLimit({ userId, bucket: "expensive", now: t0 + 1100 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Number.isInteger(r.retryAfterSeconds)).toBe(true);
      expect(r.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("limits match the published OPERATOR_RATE_LIMITS table", () => {
    expect(OPERATOR_RATE_LIMITS.read).toEqual({
      windowMs: 60_000,
      maxRequests: 60,
      bucketsSoftCap: 1024,
    });
    expect(OPERATOR_RATE_LIMITS.mutate).toEqual({
      windowMs: 60_000,
      maxRequests: 20,
      bucketsSoftCap: 1024,
    });
    expect(OPERATOR_RATE_LIMITS.expensive).toEqual({
      windowMs: 60_000,
      maxRequests: 10,
      bucketsSoftCap: 1024,
    });
  });
});
