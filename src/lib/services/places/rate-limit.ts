// Sliding-window rate limiter for the host places-search endpoint.
// In-memory (single Next process per region) — multi-region would need
// Redis. 30 requests / 60 s / propertyId is calibrated for a 250 ms debounce
// on a 3 keystroke/s typist (< 4 req/s real-world) plus headroom for burst.

export const PLACES_RATE_LIMIT_WINDOW_MS = 60_000;
export const PLACES_RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_BUCKETS_SOFT_CAP = 256;

const rateBuckets = new Map<string, number[]>();

export interface RateLimitGate {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkPlacesRateLimit(key: string, now: number): RateLimitGate {
  const windowStart = now - PLACES_RATE_LIMIT_WINDOW_MS;
  const existing = rateBuckets.get(key);
  const pruned = existing ? existing.filter((t) => t > windowStart) : [];
  if (pruned.length >= PLACES_RATE_LIMIT_MAX_REQUESTS) {
    rateBuckets.set(key, pruned);
    const oldest = pruned[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + PLACES_RATE_LIMIT_WINDOW_MS - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }
  pruned.push(now);
  rateBuckets.set(key, pruned);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function enforcePlacesBucketCap(now: number): void {
  if (rateBuckets.size <= RATE_BUCKETS_SOFT_CAP) return;
  const windowStart = now - PLACES_RATE_LIMIT_WINDOW_MS;
  for (const [k, timestamps] of rateBuckets) {
    const latest = timestamps[timestamps.length - 1];
    if (latest === undefined || latest <= windowStart) rateBuckets.delete(k);
  }
  if (rateBuckets.size <= RATE_BUCKETS_SOFT_CAP) return;
  const byLatest = [...rateBuckets.entries()]
    .map(([k, ts]) => [k, ts[ts.length - 1] ?? 0] as const)
    .sort((a, b) => a[1] - b[1]);
  const excess = rateBuckets.size - RATE_BUCKETS_SOFT_CAP;
  for (let i = 0; i < excess; i += 1) rateBuckets.delete(byLatest[i][0]);
}

export function __resetPlacesRateLimitForTests(key?: string): void {
  if (key) rateBuckets.delete(key);
  else rateBuckets.clear();
}

export function __placesRateBucketCount(): number {
  return rateBuckets.size;
}
