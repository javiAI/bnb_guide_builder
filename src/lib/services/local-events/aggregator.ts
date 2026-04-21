import {
  SourceFetchResultSchema,
  type LocalEventSourceProvider,
  type NormalizedEventCandidate,
  type SourceError,
  type SourceFetchParams,
  type SourceFetchResult,
  type SourceFetchStatus,
} from "./contracts";
import {
  canonicalizeCandidates,
  type CanonicalEventGroup,
} from "./canonicalize";
import { mergeCanonicalGroup, type MergedCanonicalEvent } from "./merge";

// ── Aggregator ──
// Orchestrates N providers for a single property. Contract invariants:
//   - No single source failure is fatal. All providers run via
//     `Promise.allSettled`; rejections and malformed envelopes collapse into
//     a synthetic `status: "unavailable"` report.
//   - Out-of-window candidates emitted by a misbehaving provider are dropped
//     as defense-in-depth (the contract already forbids them).
//   - Per-source scrape/HTTP caches (e.g. Firecrawl) are the provider's own
//     responsibility — the aggregator calls `.fetch()` once per provider.

export interface AggregatedSourceReport {
  source: string;
  status: SourceFetchStatus;
  /** Count of candidates returned by the provider BEFORE cross-source dedupe
   * and after out-of-window defense filtering. */
  candidateCount: number;
  warnings: string[];
  error?: SourceError;
  fetchedAt: string;
  durationMs: number;
}

export interface AggregatedLocalEventsResult {
  merged: MergedCanonicalEvent[];
  /** Canonical groups aligned 1:1 with `merged` (`merged[i]` is the merge of
   * `groups[i]`). Exposed so the sync layer can persist per-source links
   * without re-running canonicalize. */
  groups: CanonicalEventGroup[];
  sourceReports: AggregatedSourceReport[];
  /** Aggregator-level warnings: unexpected provider exceptions,
   * out-of-window drops, envelope validation failures. Per-source warnings
   * stay on `sourceReports[i].warnings`. */
  warnings: string[];
  /** ISO-8601 of when the aggregator started the tick. */
  startedAt: string;
}

export interface AggregateLocalEventsInput {
  params: SourceFetchParams;
  providers: ReadonlyArray<LocalEventSourceProvider>;
  /** Optional property identifier, threaded into warnings for tracing. Not
   * required because the aggregator is property-agnostic. */
  propertyId?: string;
  now?: () => Date;
}

// ── Entry point ──

export async function aggregateLocalEvents(
  input: AggregateLocalEventsInput,
): Promise<AggregatedLocalEventsResult> {
  const now = input.now ?? (() => new Date());
  const startedAt = now().toISOString();

  const aggregatorWarnings: string[] = [];
  const windowFromMs = input.params.window.from.getTime();
  const windowToMs = input.params.window.to.getTime();

  const settled = await Promise.allSettled(
    input.providers.map((p) => p.fetch(input.params)),
  );

  const reports: AggregatedSourceReport[] = [];
  const allCandidates: NormalizedEventCandidate[] = [];

  settled.forEach((outcome, i) => {
    const provider = input.providers[i];
    const envelope = normalizeEnvelope(
      provider,
      outcome,
      now,
      aggregatorWarnings,
    );

    const inWindow: NormalizedEventCandidate[] = [];
    for (const ev of envelope.events) {
      const t = ev.startsAt.getTime();
      if (t < windowFromMs || t > windowToMs) {
        aggregatorWarnings.push(
          `aggregator dropped out-of-window candidate from ${provider.source}: ${ev.title}`,
        );
        continue;
      }
      inWindow.push(ev);
    }

    reports.push({
      source: envelope.source,
      status: envelope.status,
      candidateCount: inWindow.length,
      warnings: envelope.warnings,
      ...(envelope.error ? { error: envelope.error } : {}),
      fetchedAt: envelope.fetchedAt,
      durationMs: envelope.durationMs,
    });

    allCandidates.push(...inWindow);
  });

  const groups: CanonicalEventGroup[] = canonicalizeCandidates(allCandidates);
  const merged = groups.map((g) => mergeCanonicalGroup(g));

  return {
    merged,
    groups,
    sourceReports: reports,
    warnings: aggregatorWarnings,
    startedAt,
  };
}

// ── Envelope normalization ──
// Converts a settled result (fulfilled envelope, rejected exception, or
// malformed payload) into a guaranteed-valid `SourceFetchResult`. This keeps
// the rest of the aggregator linear.

function normalizeEnvelope(
  provider: LocalEventSourceProvider,
  outcome: PromiseSettledResult<SourceFetchResult>,
  now: () => Date,
  aggregatorWarnings: string[],
): SourceFetchResult {
  const fetchedAt = now().toISOString();

  if (outcome.status === "rejected") {
    const message =
      outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason);
    aggregatorWarnings.push(
      `${provider.source} threw unexpected exception: ${message}`,
    );
    return SourceFetchResultSchema.parse({
      source: provider.source,
      status: "unavailable",
      events: [],
      warnings: [],
      error: { kind: "network", message: `unexpected: ${message}` },
      fetchedAt,
      durationMs: 0,
    });
  }

  const parsed = SourceFetchResultSchema.safeParse(outcome.value);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "unknown";
    aggregatorWarnings.push(
      `${provider.source} returned malformed envelope: ${first}`,
    );
    return SourceFetchResultSchema.parse({
      source: provider.source,
      status: "unavailable",
      events: [],
      warnings: [],
      error: { kind: "parse", message: `malformed envelope: ${first}` },
      fetchedAt,
      durationMs: 0,
    });
  }

  return parsed.data;
}
