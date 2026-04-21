import { z } from "zod";
import { isLocalEventCategoryKey } from "@/lib/taxonomy-loader";

// ── Rama 13B invariants (keep in sync with docs/FEATURES/LOCAL_GUIDE.md) ──
//
// 1. PredictHQ is the priority source WHEN available (see PROVIDER_PRIORITY).
// 2. No mock provider exists. When a source is unreachable the system
//    degrades via `status: "disabled" | "config_error"` — never via synthetic
//    events.
// 3. Firecrawl is validated early against real curated sources. If it does
//    not surface useful structured events the branch pauses for escalation.
// 4. Cross-source dedupe is conservative: prefer duplicate canonical rows
//    over a wrong merge. See `canonicalize.ts`.
// 5. A partial failure of any single source MUST NOT be fatal to the tick.
//    Providers encode failures in the result envelope; the aggregator keeps
//    going with remaining sources.
//
// These invariants are load-bearing for the aggregator contract below.
// Providers MUST NOT throw on expected failure modes (missing key, expired
// trial, rate-limit, 5xx, timeout, parse failure). They return a
// `SourceFetchResult` with `status` + optional `error`. Unexpected exceptions
// bubble up and are caught by the aggregator via `Promise.allSettled`.

// ── Status taxonomy ──

export const SOURCE_FETCH_STATUS = [
  "ok",
  "disabled",
  "no_sources_applicable",
  "config_error",
  "rate_limited",
  "unavailable",
  "parse_error",
] as const;

export const SourceFetchStatusSchema = z.enum(SOURCE_FETCH_STATUS);
export type SourceFetchStatus = z.infer<typeof SourceFetchStatusSchema>;

export const SOURCE_ERROR_KIND = [
  "config",
  "auth",
  "rate_limit",
  "network",
  "parse",
  "disabled",
] as const;

export const SourceErrorKindSchema = z.enum(SOURCE_ERROR_KIND);
export type SourceErrorKind = z.infer<typeof SourceErrorKindSchema>;

export const SourceErrorSchema = z
  .object({
    kind: SourceErrorKindSchema,
    message: z.string().min(1),
    retryAfterSeconds: z.number().int().nonnegative().optional(),
  })
  .strict();

export type SourceError = z.infer<typeof SourceErrorSchema>;

// ── Provider metadata ──
// Sanitized, fixed-shape metadata persisted in `LocalEventSourceLink.providerMetadata`.
// Does not carry raw provider payloads — every field is explicitly shaped so a
// future provider (SeatGeek, Songkick, local scraper) replaces these without
// dragging vendor-specific shapes across the codebase.

export const ProviderMetadataSchema = z
  .object({
    /** Provider-native category string (e.g. TM segment, PHQ category). For
     * debugging only — never consumed by host/guest UI. */
    nativeCategory: z.string().nullable(),
    /** Provider-native type/label tags (PHQ `labels[]`, TM `classifications`
     * sub-fields, Firecrawl extracted tags). Preserved for future re-mapping. */
    nativeTypes: z.array(z.string()),
    /** Provider self-reported confidence/relevance score in [0,1] when
     * exposed. Null when the upstream doesn't provide one. */
    confidence: z.number().min(0).max(1).nullable(),
    /** ISO-8601 timestamp of the upstream fetch. */
    retrievedAt: z.string().datetime(),
  })
  .strict();

export type ProviderMetadata = z.infer<typeof ProviderMetadataSchema>;

// ── Price info ──

export const PriceInfoSchema = z
  .object({
    free: z.boolean().optional(),
    minAmount: z.number().nonnegative().optional(),
    maxAmount: z.number().nonnegative().optional(),
    /** ISO 4217 three-letter code (e.g. "EUR", "USD"). */
    currency: z.string().length(3).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.free !== undefined ||
      v.minAmount !== undefined ||
      v.maxAmount !== undefined ||
      v.currency !== undefined,
    { message: "priceInfo must have at least one field" },
  )
  .refine(
    (v) =>
      v.minAmount === undefined ||
      v.maxAmount === undefined ||
      v.maxAmount >= v.minAmount,
    { message: "maxAmount must be >= minAmount" },
  );

export type PriceInfo = z.infer<typeof PriceInfoSchema>;

// ── NormalizedEventCandidate ──
// Canonical DTO emitted by every source provider. Every field is
// provider-agnostic. `categoryKey` MUST be a registered `le.*` key; providers
// that cannot map to a known category drop the result instead of emitting a
// raw string.

export const NormalizedEventCandidateSchema = z
  .object({
    /** Source identifier. Stable across restarts. Patterns:
     *   "predicthq" | "ticketmaster" | "firecrawl:<curatedKey>"
     * Persisted verbatim in `LocalEventSourceLink.source`. */
    source: z.string().min(1),
    /** Source-stable external id. For Firecrawl-scraped sources this is
     * a hash derived from normalized title+startsAt+venue+url — stable as
     * long as the upstream representation doesn't meaningfully change. */
    sourceExternalId: z.string().min(1),
    sourceUrl: z.string().url(),
    title: z.string().min(1),
    descriptionMd: z.string().min(1).optional(),
    categoryKey: z.string().refine(isLocalEventCategoryKey, {
      message: "categoryKey must be a registered le.* key",
    }),
    startsAt: z.date(),
    endsAt: z.date().optional(),
    venueName: z.string().min(1).optional(),
    venueAddress: z.string().min(1).optional(),
    latitude: z.number().gte(-90).lte(90).optional(),
    longitude: z.number().gte(-180).lte(180).optional(),
    imageUrl: z.string().url().optional(),
    priceInfo: PriceInfoSchema.optional(),
    /** Aggregated/native confidence in [0,1]. Used by `merge.ts` to break
     * ties on per-field merge rules and by the aggregator to pick
     * `primarySource`. */
    confidence: z.number().min(0).max(1),
    providerMetadata: ProviderMetadataSchema,
    /** ISO-8601 timestamp when this candidate was produced. */
    retrievedAt: z.string().datetime(),
  })
  .strict()
  .refine((v) => !v.endsAt || v.endsAt.getTime() >= v.startsAt.getTime(), {
    message: "endsAt must be >= startsAt",
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: "latitude and longitude must be both present or both absent",
  });

export type NormalizedEventCandidate = z.infer<
  typeof NormalizedEventCandidateSchema
>;

// ── SourceFetchParams ──

export interface SourceFetchParams {
  /** Property anchor. Source providers use this for proximity filters,
   * geohash lookups or (for Firecrawl) to pick applicable curated sources. */
  anchor: { latitude: number; longitude: number };
  /** Language preference for the upstream API (`locale` param in TM/PHQ,
   * extraction language hint in Firecrawl). Sources that can't honor it fall
   * back to their default without failing. */
  locale: "es" | "en";
  /** Property city string (as stored on `Property.city`) — used by Firecrawl
   * to match curated source applicability. Null if unknown; Firecrawl will
   * fall back to geo-based applicability. */
  city: string | null;
  /** Time window [from, to]. Providers MUST NOT return events outside this
   * window; the aggregator drops out-of-window candidates as a defense. */
  window: { from: Date; to: Date };
  /** Search radius in kilometers. Applied per-property (configured from the
   * local-guide editor). PHQ and Ticketmaster use it as the upstream
   * geo-radius parameter; Firecrawl uses it as an override/widener over
   * each curated source's own `radiusKm`. Providers fall back to their
   * constructor default when omitted. */
  radiusKm?: number;
  /** Max candidates this provider should return. Providers may return fewer. */
  limit?: number;
  signal?: AbortSignal;
}

// ── SourceFetchResult ──
// Envelope returned by every provider. Encodes both success and expected
// failure modes. Invariants enforced by Zod:
//   - non-ok status → events.length === 0
//   - non-ok, non-disabled status → error is required
//   - ok status → error is forbidden

export const SourceFetchResultSchema = z
  .object({
    source: z.string().min(1),
    status: SourceFetchStatusSchema,
    events: z.array(NormalizedEventCandidateSchema),
    /** Non-fatal notices (dropped candidates, partial parse failures, etc.).
     * The aggregator forwards these to the sync report for operator
     * visibility. */
    warnings: z.array(z.string()),
    error: SourceErrorSchema.optional(),
    /** ISO-8601 of when the fetch completed. */
    fetchedAt: z.string().datetime(),
    /** Elapsed wall-clock of the fetch. */
    durationMs: z.number().int().nonnegative(),
  })
  .strict()
  .refine((v) => v.status === "ok" || v.events.length === 0, {
    message: "non-ok status must carry no events",
  })
  .refine(
    (v) => {
      if (v.status === "ok") return v.error === undefined;
      // `disabled` and `no_sources_applicable` are informational non-ok
      // states, not errors — the provider ran its protocol, there just
      // wasn't anything to call. No `error` object required/allowed.
      if (v.status === "disabled") return v.error === undefined;
      if (v.status === "no_sources_applicable") return v.error === undefined;
      return v.error !== undefined;
    },
    {
      message:
        "error required for actual failures; forbidden for ok/disabled/no_sources_applicable",
    },
  );

export type SourceFetchResult = z.infer<typeof SourceFetchResultSchema>;

// ── Provider interface ──

export interface LocalEventSourceProvider {
  /** Stable identifier persisted in `LocalEventSourceLink.source`. MUST NOT
   * change once rows reference it — the `(propertyId, source, sourceExternalId)`
   * uniqueness contract depends on it. Patterns:
   *   - "predicthq"
   *   - "ticketmaster"
   *   - "firecrawl"  (single provider family identifier)
   *
   * Note: Firecrawl emits per-curated-source provenance on mapped candidates
   * as `firecrawl:<curatedKey>`, but the provider's own stable identifier
   * remains just `"firecrawl"`. */
  readonly source: string;

  /** Relative priority used by the aggregator to (a) pick `primarySource`
   * for a merged canonical event and (b) break ties in per-field merge
   * rules. Higher wins. Per-field merge rules (see `merge.ts`) may still
   * deviate when a specific field quality is known to be better from a
   * lower-priority source (e.g. TM supplies the clickable `sourceUrl` even
   * when PHQ is the primary). */
  readonly priority: number;

  /** Fetch events for the given params.
   *
   * Contract:
   *   - MUST NOT throw on expected failure modes (missing key, expired
   *     trial, 401/403, 429, 5xx, timeout, malformed JSON). Encode them as
   *     `status + error` on the result envelope.
   *   - SHOULD honor `params.signal` for graceful aborts.
   *   - SHOULD drop individual candidates that fail validation (Zod
   *     safeParse of the internal mapping) and record a warning — never
   *     fail the whole fetch because one upstream item was malformed.
   *   - Unexpected exceptions (programming bugs) will be caught by the
   *     aggregator via `Promise.allSettled` and surfaced as
   *     `status: "unavailable"` with a synthetic error.
   */
  fetch(params: SourceFetchParams): Promise<SourceFetchResult>;
}

// ── Provider priority constants ──
// Canonical priority tiers. Stored here so tests and merge logic share a
// single source of truth. PredictHQ sits at the top because it is the
// strongest source of structured classification and forecasting signal when
// available; Firecrawl curated sources follow because they are the only
// reliable coverage path for small/hyperlocal destinations; Ticketmaster is
// third but remains decisive for a few fields (see `merge.ts` rules for
// `sourceUrl`).

export const PROVIDER_PRIORITY = Object.freeze({
  predicthq: 100,
  firecrawl: 80,
  ticketmaster: 60,
} as const);

export type KnownProviderFamily = keyof typeof PROVIDER_PRIORITY;
