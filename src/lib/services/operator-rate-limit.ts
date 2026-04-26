/**
 * Per-actor rate limiting for operator-facing endpoints (Rama 15D).
 *
 * Three buckets pinned in `OPERATOR_RATE_LIMITS`:
 * - `read` — 60 req/60s (GETs, list endpoints)
 * - `mutate` — 20 req/60s (POST/PATCH/DELETE non-expensive)
 * - `expensive` — 10 req/60s (downstream LLM/RAG/external API calls)
 *
 * Backed by the in-memory sliding-window helper from 13D
 * (`sliding-window-rate-limit.ts`). Single-process is sufficient for the
 * MVP; multi-region deploy → Redis-backed variant behind the same surface.
 *
 * Each bucket has its own Map so different categories don't share quota.
 * Cross-user isolation is enforced by the bucket key (`<userId>`).
 */

import {
  checkSlidingWindowLimit,
  type SlidingWindowLimitOptions,
} from "@/lib/services/sliding-window-rate-limit";

export type OperatorRateLimitBucket = "read" | "mutate" | "expensive";

export const OPERATOR_RATE_LIMITS: Readonly<
  Record<OperatorRateLimitBucket, SlidingWindowLimitOptions>
> = {
  read: { windowMs: 60_000, maxRequests: 60, bucketsSoftCap: 1024 },
  mutate: { windowMs: 60_000, maxRequests: 20, bucketsSoftCap: 1024 },
  expensive: { windowMs: 60_000, maxRequests: 10, bucketsSoftCap: 1024 },
};

const buckets: Record<OperatorRateLimitBucket, Map<string, number[]>> = {
  read: new Map(),
  mutate: new Map(),
  expensive: new Map(),
};

export interface OperatorRateLimitInput {
  userId: string;
  bucket: OperatorRateLimitBucket;
  /** Override `Date.now()` for tests. */
  now?: number;
}

export type OperatorRateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function applyOperatorRateLimit(
  input: OperatorRateLimitInput,
): OperatorRateLimitResult {
  const opts = OPERATOR_RATE_LIMITS[input.bucket];
  const now = input.now ?? Date.now();
  const res = checkSlidingWindowLimit(buckets[input.bucket], input.userId, now, opts);
  return res.allowed
    ? { ok: true }
    : { ok: false, retryAfterSeconds: res.retryAfterSeconds };
}

/** Test-only helper: clear all buckets between cases. */
export function __resetOperatorRateLimitForTests(): void {
  for (const m of Object.values(buckets)) m.clear();
}
