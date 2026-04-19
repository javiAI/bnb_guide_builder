// Client-side analytics shim for the public guide. Today it only emits
// console logs with greppable prefixes; the surface stays stable so a
// future wiring to GA / PostHog / internal pipeline is a single-file
// change. Consumers (`guide-search` for now) import named functions —
// never inline `console.info` calls — so the call sites don't need to
// change later.

const LOG_PREFIX = "[guide-analytics]";

/** A guest typed a query and got zero matches. Logged to surface common
 * gaps in the content model ("parking" misspelled, "wi-fi" without dash,
 * etc). Debounce lives at the call site (see `GuideSearch`). */
export function trackSearchMiss(query: string): void {
  const normalized = query.trim();
  if (!normalized) return;
  console.info(`${LOG_PREFIX} search-miss`, { query: normalized });
}
