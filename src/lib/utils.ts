/**
 * Strip keys with null or empty-string values from a record.
 * Used before serializing JSON to avoid persisting empty fields.
 */
export function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== ""));
}

/** Prisma P2002 = unique constraint violation. */
export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Map `items` through `fn` with at most `concurrency` promises in flight.
 * Preserves input order. Use over `Promise.all(items.map(...))` when each
 * call hits a finite pool (DB connections, external API rate limits) and
 * the input size can grow unboundedly with workload — e.g. cron fan-out
 * over reservations or property scans.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
