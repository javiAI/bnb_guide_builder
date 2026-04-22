/**
 * Shared sliding-window rate limiter for public `/g/:slug` write/read paths.
 *
 * In-memory is sufficient for the MVP (single Next process per region; the
 * abuse risk on write paths is low because the guest still has to hold a
 * valid slug). Multi-region deploy → Redis-backed variant behind the same
 * surface.
 *
 * Each caller passes its own bucket Map so different endpoints don't share a
 * window. The bucket cap prevents a crawler hitting many distinct keys from
 * growing memory unbounded — idle buckets are pruned first, then the oldest
 * touched buckets are evicted down to the soft cap.
 */

export interface SlidingWindowLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying (>=1 when denied). */
  retryAfterSeconds: number;
}

export interface SlidingWindowLimitOptions {
  /** Rolling window size in milliseconds. */
  windowMs: number;
  /** Max requests allowed per key within the window. */
  maxRequests: number;
  /** Soft cap on distinct keys retained in memory. */
  bucketsSoftCap: number;
}

export function checkSlidingWindowLimit(
  buckets: Map<string, number[]>,
  key: string,
  now: number,
  opts: SlidingWindowLimitOptions,
): SlidingWindowLimitResult {
  const windowStart = now - opts.windowMs;
  const existing = buckets.get(key);
  const pruned = existing ? existing.filter((t) => t > windowStart) : [];
  if (pruned.length >= opts.maxRequests) {
    buckets.set(key, pruned);
    const oldest = pruned[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + opts.windowMs - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }
  pruned.push(now);
  buckets.set(key, pruned);
  if (buckets.size > opts.bucketsSoftCap) enforceBucketCap(buckets, now, opts);
  return { allowed: true, retryAfterSeconds: 0 };
}

function enforceBucketCap(
  buckets: Map<string, number[]>,
  now: number,
  opts: SlidingWindowLimitOptions,
): void {
  const windowStart = now - opts.windowMs;
  for (const [k, timestamps] of buckets) {
    const latest = timestamps[timestamps.length - 1];
    if (latest === undefined || latest <= windowStart) buckets.delete(k);
  }
  if (buckets.size <= opts.bucketsSoftCap) return;
  const byLatest = [...buckets.entries()]
    .map(([k, ts]) => [k, ts[ts.length - 1] ?? 0] as const)
    .sort((a, b) => a[1] - b[1]);
  const excess = buckets.size - opts.bucketsSoftCap;
  for (let i = 0; i < excess; i += 1) buckets.delete(byLatest[i][0]);
}
