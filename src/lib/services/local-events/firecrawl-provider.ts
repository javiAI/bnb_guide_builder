import { createHash } from "node:crypto";
import { z } from "zod";
import { haversineMeters } from "@/lib/services/places/distance";
import {
  localEventSources,
  type LocalEventSource,
} from "@/lib/taxonomy-loader";
import { stripAccents } from "./canonicalize";
import {
  NormalizedEventCandidateSchema,
  PROVIDER_PRIORITY,
  SourceFetchResultSchema,
  type LocalEventSourceProvider,
  type NormalizedEventCandidate,
  type SourceFetchParams,
  type SourceFetchResult,
} from "./contracts";
import { isHttpUrl } from "./url-utils";

// ── Firecrawl-side extract shape ──
// JSON Schema passed to Firecrawl's `/scrape` extract phase. Hand-written
// (repo has no zod-to-json-schema dep) and mirrored 1:1 by the Zod schema
// below so the response shape is validated in-process. Keep these two in
// sync — any field added here must be added in `FirecrawlExtractSchema`.

export const FIRECRAWL_EXTRACT_JSON_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      description:
        "Structured events listed on the page. Each entry must have a human-readable title and a start date/time. Drop entries that are purely navigation, pagination, or adverts.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          category: {
            type: "string",
            description:
              "Free-text category as shown on the page (e.g. 'concierto', 'mercado', 'fiesta popular'). Used as a mapping hint.",
          },
          startDate: {
            type: "string",
            description: "ISO 8601 date or datetime in the page's timezone.",
          },
          endDate: {
            type: "string",
            description: "ISO 8601 date or datetime. Omit if single-day.",
          },
          venueName: { type: "string" },
          venueAddress: { type: "string" },
          imageUrl: { type: "string" },
          detailUrl: {
            type: "string",
            description:
              "Canonical URL of the event detail page. Omit if only the summary page is shown.",
          },
          priceText: {
            type: "string",
            description:
              "Raw price as written on the page (e.g. 'gratuito', '10-15 €'). Not parsed by the scraper.",
          },
        },
        required: ["title", "startDate"],
      },
    },
  },
  required: ["events"],
} as const;

const FirecrawlExtractedEventSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    category: z.string().optional(),
    startDate: z.string().min(1),
    endDate: z.string().min(1).optional(),
    venueName: z.string().optional(),
    venueAddress: z.string().optional(),
    imageUrl: z.string().optional(),
    detailUrl: z.string().optional(),
    priceText: z.string().optional(),
  })
  .passthrough();

const FirecrawlScrapeResponseSchema = z
  .object({
    success: z.boolean().optional(),
    data: z
      .object({
        extract: z
          .object({ events: z.array(FirecrawlExtractedEventSchema) })
          .optional(),
        json: z
          .object({ events: z.array(FirecrawlExtractedEventSchema) })
          .optional(),
      })
      .optional(),
  })
  .passthrough();

// ── Category mapping (provider-native → le.*) ──
// Firecrawl gives us free-text categories straight from the page. Map them
// to registered `le.*` keys using keyword prefixes. Unknown terms fall to
// `le.other` (a registered key, not a raw string).

const FIRECRAWL_CATEGORY_RULES: ReadonlyArray<{
  keywords: readonly string[];
  categoryKey: string;
}> = [
  { keywords: ["concierto", "concert", "musica", "jazz", "rock"], categoryKey: "le.concert" },
  { keywords: ["deporte", "sport", "partido", "carrera", "maraton"], categoryKey: "le.sports" },
  { keywords: ["teatro", "danza", "opera", "escenic"], categoryKey: "le.arts" },
  { keywords: ["familia", "familiar", "infantil", "nino", "niños"], categoryKey: "le.family" },
  { keywords: ["festival", "fallas"], categoryKey: "le.festival" },
  { keywords: ["exposicion", "expo", "museo", "galeria"], categoryKey: "le.exhibition" },
  { keywords: ["mercado", "feria", "barrio", "popular", "comunidad"], categoryKey: "le.community" },
  { keywords: ["taller", "curso", "workshop"], categoryKey: "le.workshop" },
  { keywords: ["fiesta", "nocturna", "dj"], categoryKey: "le.nightlife" },
];

export function mapFirecrawlCategory(raw: string | undefined): string {
  if (!raw) return "le.other";
  const norm = stripAccents(raw.toLowerCase());
  for (const rule of FIRECRAWL_CATEGORY_RULES) {
    if (rule.keywords.some((k) => norm.includes(k))) return rule.categoryKey;
  }
  return "le.other";
}

// ── sourceExternalId derivation ──
// Firecrawl's upstream has no stable event id. Hash the canonical fields so
// the same event across reruns maps to the same id. Title + 15-min-floored
// startsAt + venue + detailUrl — conservative enough that typo fixes on the
// page don't reshuffle ids, narrow enough that distinct events don't collide.

function normalizeForHash(input: string | undefined): string {
  if (!input) return "";
  return stripAccents(input.toLowerCase()).replace(/\s+/g, " ").trim();
}

export function deriveFirecrawlExternalId(params: {
  title: string;
  startsAt: Date;
  venueName?: string;
  detailUrl?: string;
}): string {
  const slot = Math.floor(params.startsAt.getTime() / (15 * 60 * 1000));
  const parts = [
    normalizeForHash(params.title),
    String(slot),
    normalizeForHash(params.venueName),
    params.detailUrl ?? "",
  ].join("|");
  return createHash("sha256").update(parts).digest("hex").slice(0, 16);
}

// ── Applicability ──
// A curated source applies to a fetch when (a) the property's city matches
// the source's city (case-insensitive) OR (b) the property's anchor falls
// within `radiusKm` of the source's center. The aggregator calls the
// Firecrawl provider once per property — this decides which sources to
// actually scrape for that call.

export function selectApplicableSources(
  all: ReadonlyArray<LocalEventSource>,
  params: Pick<SourceFetchParams, "anchor" | "city">,
): LocalEventSource[] {
  const cityNorm = params.city ? normalizeForHash(params.city) : null;
  return all.filter((s) => {
    if (cityNorm && normalizeForHash(s.city) === cityNorm) return true;
    const meters = haversineMeters(params.anchor, {
      latitude: s.latitude,
      longitude: s.longitude,
    });
    return meters <= s.radiusKm * 1000;
  });
}

// ── Date parsing ──
// Firecrawl extract returns operator-written ISO strings. We accept
// `YYYY-MM-DD` (dateless → treat as midnight UTC) and full ISO. Anything
// else becomes a parse warning and the candidate drops.

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00.000Z`);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Provider ──
// One instance scrapes N curated sources. Scrape cache is per-instance and
// keyed by sourceUrl so multiple properties in the same city share a single
// upstream call per tick. Callers MUST instantiate a new provider per tick
// (or call `resetScrapeCache()`) to avoid serving stale data across ticks.

interface ScrapeCacheEntry {
  candidates: NormalizedEventCandidate[];
  warnings: string[];
}

export interface FirecrawlLocalEventsProviderOptions {
  apiKey: string;
  sources?: ReadonlyArray<LocalEventSource>;
  /** Override the Firecrawl base URL (tests point to a mock). */
  baseUrl?: string;
  /** Override the time source (tests pin `retrievedAt`). */
  now?: () => Date;
  /** Override the fetch implementation (tests stub). */
  fetchImpl?: typeof fetch;
}

export class FirecrawlLocalEventsProvider implements LocalEventSourceProvider {
  readonly source = "firecrawl";
  readonly priority = PROVIDER_PRIORITY.firecrawl;

  private readonly apiKey: string;
  private readonly sources: ReadonlyArray<LocalEventSource>;
  private readonly baseUrl: string;
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;
  private readonly scrapeCache = new Map<string, ScrapeCacheEntry>();

  constructor(options: FirecrawlLocalEventsProviderOptions) {
    this.apiKey = options.apiKey;
    this.sources = options.sources ?? localEventSources.items;
    this.baseUrl = options.baseUrl ?? "https://api.firecrawl.dev";
    this.now = options.now ?? (() => new Date());
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  resetScrapeCache(): void {
    this.scrapeCache.clear();
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
        error: { kind: "config", message: "FIRECRAWL_API_KEY is not set" },
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    const applicable = selectApplicableSources(this.sources, params);
    if (applicable.length === 0) {
      return SourceFetchResultSchema.parse({
        source: this.source,
        status: "ok",
        events: [],
        warnings: ["no curated sources applicable to property anchor/city"],
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    const allCandidates: NormalizedEventCandidate[] = [];
    const allWarnings: string[] = [];
    let lastError: { kind: "auth" | "rate_limit" | "network" | "parse"; message: string; retryAfterSeconds?: number } | null = null;
    let scrapedCount = 0;
    let failedCount = 0;

    for (const src of applicable) {
      try {
        const cached = this.scrapeCache.get(src.sourceUrl);
        if (cached) {
          allCandidates.push(...this.filterByWindow(cached.candidates, params.window));
          allWarnings.push(...cached.warnings);
          continue;
        }
        const scraped = await this.scrapeSource(src, params, fetchedAt);
        this.scrapeCache.set(src.sourceUrl, scraped);
        scrapedCount += 1;
        allCandidates.push(...this.filterByWindow(scraped.candidates, params.window));
        allWarnings.push(...scraped.warnings);
      } catch (err) {
        failedCount += 1;
        const classified = classifyError(err);
        lastError = classified;
        allWarnings.push(
          `firecrawl:${src.key} scrape failed (${classified.kind}): ${classified.message}`,
        );
      }
    }

    // If every applicable source failed, bubble the error kind on the envelope.
    if (failedCount > 0 && scrapedCount === 0 && allCandidates.length === 0 && lastError) {
      const status =
        lastError.kind === "rate_limit" ? "rate_limited" :
        lastError.kind === "parse" ? "parse_error" :
        "unavailable";
      return SourceFetchResultSchema.parse({
        source: this.source,
        status,
        events: [],
        warnings: allWarnings,
        error: {
          kind: lastError.kind,
          message: lastError.message,
          ...(lastError.retryAfterSeconds !== undefined ? { retryAfterSeconds: lastError.retryAfterSeconds } : {}),
        },
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    const trimmed = typeof params.limit === "number"
      ? allCandidates.slice(0, params.limit)
      : allCandidates;

    return SourceFetchResultSchema.parse({
      source: this.source,
      status: "ok",
      events: trimmed,
      warnings: allWarnings,
      fetchedAt,
      durationMs: Date.now() - startedAt,
    });
  }

  private filterByWindow(
    candidates: ReadonlyArray<NormalizedEventCandidate>,
    window: { from: Date; to: Date },
  ): NormalizedEventCandidate[] {
    const fromMs = window.from.getTime();
    const toMs = window.to.getTime();
    return candidates.filter((c) => {
      const t = c.startsAt.getTime();
      return t >= fromMs && t <= toMs;
    });
  }

  private async scrapeSource(
    src: LocalEventSource,
    params: SourceFetchParams,
    fetchedAt: string,
  ): Promise<ScrapeCacheEntry> {
    const body = {
      url: src.sourceUrl,
      formats: ["extract"],
      extract: {
        schema: FIRECRAWL_EXTRACT_JSON_SCHEMA,
        prompt:
          "Extract every scheduled event listed on this page. For each event return a title, an ISO-8601 startDate, and whatever structured fields the page exposes (endDate, venueName, venueAddress, imageUrl, detailUrl, category, priceText). Skip navigation entries, adverts, pagination controls and purely archival content.",
      },
    };

    const res = await this.fetchImpl(`${this.baseUrl}/v1/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new FirecrawlError("auth", `HTTP ${res.status} from Firecrawl`);
      }
      if (res.status === 429) {
        const retryHeader = res.headers.get("retry-after");
        const retry = retryHeader ? Number.parseInt(retryHeader, 10) : undefined;
        throw new FirecrawlError(
          "rate_limit",
          `HTTP 429 from Firecrawl`,
          Number.isFinite(retry) ? (retry as number) : undefined,
        );
      }
      throw new FirecrawlError("network", `HTTP ${res.status} from Firecrawl`);
    }

    const json = await res.json().catch(() => null);
    if (!json) throw new FirecrawlError("parse", "Firecrawl response was not JSON");

    const parsed = FirecrawlScrapeResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new FirecrawlError("parse", `Firecrawl response shape invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    }

    const extractBlock = parsed.data.data?.extract ?? parsed.data.data?.json;
    const events = extractBlock?.events ?? [];

    const candidates: NormalizedEventCandidate[] = [];
    const warnings: string[] = [];

    for (const ev of events) {
      const startsAt = parseDate(ev.startDate);
      if (!startsAt) {
        warnings.push(`firecrawl:${src.key} skipped event (unparseable startDate): ${ev.title}`);
        continue;
      }
      const endsAt = ev.endDate ? parseDate(ev.endDate) : undefined;
      if (ev.endDate && !endsAt) {
        warnings.push(`firecrawl:${src.key} ignored unparseable endDate for: ${ev.title}`);
      }

      const categoryKey = mapFirecrawlCategory(ev.category);
      const detailUrl = ev.detailUrl && isHttpUrl(ev.detailUrl) ? ev.detailUrl : src.sourceUrl;
      const imageUrl = ev.imageUrl && isHttpUrl(ev.imageUrl) ? ev.imageUrl : undefined;

      const sourceExternalId = deriveFirecrawlExternalId({
        title: ev.title,
        startsAt,
        venueName: ev.venueName,
        detailUrl,
      });

      const candidateInput: NormalizedEventCandidate = {
        source: `firecrawl:${src.key}`,
        sourceExternalId,
        sourceUrl: detailUrl,
        title: ev.title,
        ...(ev.description ? { descriptionMd: ev.description } : {}),
        categoryKey,
        startsAt,
        ...(endsAt && endsAt.getTime() >= startsAt.getTime() ? { endsAt } : {}),
        ...(ev.venueName ? { venueName: ev.venueName } : {}),
        ...(ev.venueAddress ? { venueAddress: ev.venueAddress } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        confidence: 0.55,
        providerMetadata: {
          nativeCategory: ev.category ?? null,
          nativeTypes: ev.category ? [ev.category] : [],
          confidence: null,
          retrievedAt: fetchedAt,
        },
        retrievedAt: fetchedAt,
      };

      const validated = NormalizedEventCandidateSchema.safeParse(candidateInput);
      if (!validated.success) {
        warnings.push(
          `firecrawl:${src.key} dropped (invalid candidate): ${validated.error.issues[0]?.message ?? "unknown"}`,
        );
        continue;
      }
      candidates.push(validated.data);
    }

    return { candidates, warnings };
  }
}

class FirecrawlError extends Error {
  constructor(
    public readonly kind: "auth" | "rate_limit" | "network" | "parse",
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "FirecrawlError";
  }
}

function classifyError(err: unknown): {
  kind: "auth" | "rate_limit" | "network" | "parse";
  message: string;
  retryAfterSeconds?: number;
} {
  if (err instanceof FirecrawlError) {
    return err.retryAfterSeconds !== undefined
      ? { kind: err.kind, message: err.message, retryAfterSeconds: err.retryAfterSeconds }
      : { kind: err.kind, message: err.message };
  }
  if (err instanceof Error) {
    return { kind: "network", message: err.message };
  }
  return { kind: "network", message: String(err) };
}
