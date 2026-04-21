import { z } from "zod";
import {
  NormalizedEventCandidateSchema,
  PROVIDER_PRIORITY,
  SourceFetchResultSchema,
  type LocalEventSourceProvider,
  type NormalizedEventCandidate,
  type SourceFetchParams,
  type SourceFetchResult,
} from "./contracts";

// ── Response shape (subset) ──
// PredictHQ /v1/events returns a dense payload with forecasting data.
// We validate only the fields the mapper consumes.

const PhqEntitySchema = z
  .object({
    name: z.string().optional(),
    type: z.string().optional(),
    formatted_address: z.string().optional(),
  })
  .passthrough();

const PhqGeometrySchema = z
  .object({
    type: z.string().optional(),
    coordinates: z.array(z.number()).optional(),
  })
  .passthrough();

const PhqGeoSchema = z
  .object({ geometry: PhqGeometrySchema.optional() })
  .passthrough();

const PhqEventSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    labels: z.array(z.string()).optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    timezone: z.string().nullable().optional(),
    entities: z.array(PhqEntitySchema).optional(),
    geo: PhqGeoSchema.optional(),
    phq_attendance: z.number().nullable().optional(),
    local_rank: z.number().nullable().optional(),
    rank: z.number().nullable().optional(),
  })
  .passthrough();

const PhqResponseSchema = z
  .object({
    count: z.number().optional(),
    overflow: z.boolean().optional(),
    results: z.array(PhqEventSchema).optional(),
  })
  .passthrough();

// ── Category mapping ──
// PHQ has its own coarse category axis (~15 categories). We map only the
// ones that can surface as ticket-like local events. Anything else
// (severe-weather, disasters, academic, airport delays, etc.) is dropped
// by filter at the request level via `CATEGORY_REQUEST_PARAM`.

const PHQ_CATEGORY_REQUEST_PARAM = [
  "concerts",
  "sports",
  "performing-arts",
  "festivals",
  "community",
  "expos",
  "conferences",
].join(",");

const PHQ_CATEGORY_MAP: Readonly<Record<string, string>> = Object.freeze({
  concerts: "le.concert",
  sports: "le.sports",
  "performing-arts": "le.arts",
  festivals: "le.festival",
  community: "le.community",
  expos: "le.exhibition",
  conferences: "le.workshop",
});

export function mapPredictHqCategory(
  category: string | undefined,
  labels: ReadonlyArray<string> | undefined,
): string {
  const labelSet = new Set((labels ?? []).map((l) => l.toLowerCase()));
  if (labelSet.has("family")) return "le.family";
  if (labelSet.has("nightlife")) return "le.nightlife";
  if (category && PHQ_CATEGORY_MAP[category]) return PHQ_CATEGORY_MAP[category];
  return "le.other";
}

// ── Rank-to-confidence normalization ──
// PHQ's `local_rank` (0–100) quantifies local impact. Map to [0,1] and
// prefer `local_rank` over the global `rank` when both are present.

export function phqRankToConfidence(rank: number | null | undefined): number {
  if (typeof rank !== "number" || !Number.isFinite(rank)) return 0.65;
  const clamped = Math.max(0, Math.min(100, rank));
  return clamped / 100;
}

export interface PredictHqEventsProviderOptions {
  apiKey: string;
  baseUrl?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  defaultRadiusKm?: number;
  defaultPageSize?: number;
}

export class PredictHqEventsProvider implements LocalEventSourceProvider {
  readonly source = "predicthq";
  readonly priority = PROVIDER_PRIORITY.predicthq;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultRadiusKm: number;
  private readonly defaultPageSize: number;

  constructor(options: PredictHqEventsProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.predicthq.com";
    this.now = options.now ?? (() => new Date());
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultRadiusKm = options.defaultRadiusKm ?? 25;
    this.defaultPageSize = options.defaultPageSize ?? 100;
  }

  async fetch(params: SourceFetchParams): Promise<SourceFetchResult> {
    const startedAt = Date.now();
    const fetchedAt = this.now().toISOString();

    if (!this.apiKey) {
      return SourceFetchResultSchema.parse({
        source: this.source,
        status: "config_error",
        events: [],
        warnings: [],
        error: { kind: "config", message: "PREDICTHQ_API_KEY is not set" },
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    const size = Math.min(this.defaultPageSize, params.limit ?? this.defaultPageSize);
    const url = new URL(`${this.baseUrl}/v1/events/`);
    url.searchParams.set(
      "within",
      `${this.defaultRadiusKm}km@${params.anchor.latitude},${params.anchor.longitude}`,
    );
    url.searchParams.set("active.gte", toPhqInstant(params.window.from));
    url.searchParams.set("active.lte", toPhqInstant(params.window.to));
    url.searchParams.set("category", PHQ_CATEGORY_REQUEST_PARAM);
    url.searchParams.set("limit", String(size));
    url.searchParams.set("sort", "start");

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: params.signal,
      });
    } catch (err) {
      return SourceFetchResultSchema.parse({
        source: this.source,
        status: "unavailable",
        events: [],
        warnings: [],
        error: {
          kind: "network",
          message: err instanceof Error ? err.message : String(err),
        },
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    if (!res.ok) {
      const baseEnvelope = {
        source: this.source,
        events: [],
        warnings: [],
        fetchedAt,
        durationMs: Date.now() - startedAt,
      };
      // 402 is PHQ's signal for expired trial / billing issue. We treat
      // it as auth-tier unavailability so the aggregator continues with
      // other providers — never fatal.
      if (res.status === 401 || res.status === 402 || res.status === 403) {
        return SourceFetchResultSchema.parse({
          ...baseEnvelope,
          status: "unavailable",
          error: {
            kind: "auth",
            message:
              res.status === 402
                ? "PredictHQ returned 402 (trial expired or billing issue)"
                : `HTTP ${res.status} from PredictHQ`,
          },
        });
      }
      if (res.status === 429) {
        const retryHeader = res.headers.get("retry-after");
        const retry = retryHeader ? Number.parseInt(retryHeader, 10) : undefined;
        return SourceFetchResultSchema.parse({
          ...baseEnvelope,
          status: "rate_limited",
          error: {
            kind: "rate_limit",
            message: "HTTP 429 from PredictHQ",
            ...(Number.isFinite(retry) ? { retryAfterSeconds: retry as number } : {}),
          },
        });
      }
      return SourceFetchResultSchema.parse({
        ...baseEnvelope,
        status: "unavailable",
        error: { kind: "network", message: `HTTP ${res.status} from PredictHQ` },
      });
    }

    const json = await res.json().catch(() => null);
    if (!json) {
      return SourceFetchResultSchema.parse({
        source: this.source,
        status: "parse_error",
        events: [],
        warnings: [],
        error: { kind: "parse", message: "PredictHQ response was not JSON" },
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    const parsed = PhqResponseSchema.safeParse(json);
    if (!parsed.success) {
      return SourceFetchResultSchema.parse({
        source: this.source,
        status: "parse_error",
        events: [],
        warnings: [],
        error: {
          kind: "parse",
          message: `PredictHQ response shape invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`,
        },
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    const results = parsed.data.results ?? [];
    const candidates: NormalizedEventCandidate[] = [];
    const warnings: string[] = [];
    const fromMs = params.window.from.getTime();
    const toMs = params.window.to.getTime();

    for (const ev of results) {
      const startsAt = ev.start ? new Date(ev.start) : null;
      if (!startsAt || Number.isNaN(startsAt.getTime())) {
        warnings.push(`predicthq skipped event (no/invalid start): ${ev.title}`);
        continue;
      }
      const t = startsAt.getTime();
      if (t < fromMs || t > toMs) continue;

      const endsAt = ev.end ? new Date(ev.end) : undefined;
      const endsAtValid = endsAt && !Number.isNaN(endsAt.getTime()) && endsAt.getTime() >= startsAt.getTime();

      const categoryKey = mapPredictHqCategory(ev.category, ev.labels);

      const venue = ev.entities?.find((e) => e.type === "venue");
      const coords = ev.geo?.geometry?.coordinates;
      const [lon, lat] = Array.isArray(coords) && coords.length >= 2
        ? [coords[0], coords[1]]
        : [undefined, undefined];

      const hasLat = typeof lat === "number" && Number.isFinite(lat);
      const hasLon = typeof lon === "number" && Number.isFinite(lon);

      const rank = ev.local_rank ?? ev.rank ?? null;
      const confidence = phqRankToConfidence(rank);

      const candidateInput: NormalizedEventCandidate = {
        source: this.source,
        sourceExternalId: ev.id,
        // PHQ doesn't ship a clickable URL on the raw event. Merge rules
        // (see merge.ts, commit 5) swap this with TM's clickable URL when
        // a match is found. For standalone PHQ events, this is the best
        // stable self-reference we can emit.
        sourceUrl: `https://www.predicthq.com/events/${ev.id}`,
        title: ev.title,
        ...(ev.description ? { descriptionMd: ev.description } : {}),
        categoryKey,
        startsAt,
        ...(endsAtValid && endsAt ? { endsAt } : {}),
        ...(venue?.name ? { venueName: venue.name } : {}),
        ...(venue?.formatted_address ? { venueAddress: venue.formatted_address } : {}),
        ...(hasLat && hasLon
          ? { latitude: lat as number, longitude: lon as number }
          : {}),
        confidence,
        providerMetadata: {
          nativeCategory: ev.category ?? null,
          nativeTypes: ev.labels ?? [],
          confidence: typeof rank === "number" ? confidence : null,
          retrievedAt: fetchedAt,
        },
        retrievedAt: fetchedAt,
      };

      const validated = NormalizedEventCandidateSchema.safeParse(candidateInput);
      if (!validated.success) {
        warnings.push(
          `predicthq dropped (invalid candidate): ${validated.error.issues[0]?.message ?? "unknown"}`,
        );
        continue;
      }
      candidates.push(validated.data);
    }

    return SourceFetchResultSchema.parse({
      source: this.source,
      status: "ok",
      events: candidates,
      warnings,
      fetchedAt,
      durationMs: Date.now() - startedAt,
    });
  }
}

function toPhqInstant(d: Date): string {
  return d.toISOString().replace(/\.\d+Z$/, "Z");
}
