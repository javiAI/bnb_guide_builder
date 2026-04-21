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
import { isHttpUrl } from "./url-utils";

// ── Response shape (subset) ──
// Ticketmaster Discovery v2 exposes a much richer payload than we need. We
// only validate the fields the mapper consumes; everything else passes
// through untyped.

const TmImageSchema = z
  .object({
    url: z.string(),
    width: z.number().optional(),
    ratio: z.string().optional(),
  })
  .passthrough();

const TmPriceRangeSchema = z
  .object({
    currency: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .passthrough();

const TmVenueSchema = z
  .object({
    name: z.string().optional(),
    address: z.object({ line1: z.string().optional() }).passthrough().optional(),
    city: z.object({ name: z.string().optional() }).passthrough().optional(),
    location: z
      .object({
        latitude: z.union([z.string(), z.number()]).optional(),
        longitude: z.union([z.string(), z.number()]).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const TmClassificationSchema = z
  .object({
    segment: z.object({ name: z.string().optional() }).passthrough().optional(),
    genre: z.object({ name: z.string().optional() }).passthrough().optional(),
    subGenre: z
      .object({ name: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

const TmEventSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    url: z.string().optional(),
    info: z.string().optional(),
    description: z.string().optional(),
    dates: z
      .object({
        start: z
          .object({
            dateTime: z.string().optional(),
            localDate: z.string().optional(),
            localTime: z.string().optional(),
          })
          .passthrough()
          .optional(),
        end: z
          .object({
            dateTime: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    images: z.array(TmImageSchema).optional(),
    priceRanges: z.array(TmPriceRangeSchema).optional(),
    classifications: z.array(TmClassificationSchema).optional(),
    _embedded: z
      .object({ venues: z.array(TmVenueSchema).optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

const TmResponseSchema = z
  .object({
    _embedded: z
      .object({ events: z.array(TmEventSchema).optional() })
      .passthrough()
      .optional(),
    page: z
      .object({
        totalElements: z.number().optional(),
        number: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// ── Segment → le.* mapping ──
// TM segments are the top-level axis of their taxonomy ("Music", "Sports",
// "Arts & Theatre", etc.). We never consume the free text; unknown segments
// drop to `le.other`.

const TM_SEGMENT_MAP: Readonly<Record<string, string>> = Object.freeze({
  Music: "le.concert",
  Sports: "le.sports",
  "Arts & Theatre": "le.arts",
  "Arts & Theater": "le.arts",
  Family: "le.family",
  Miscellaneous: "le.other",
});

export function mapTicketmasterSegment(
  segment: string | undefined,
  genre: string | undefined,
): string {
  if (segment && TM_SEGMENT_MAP[segment]) return TM_SEGMENT_MAP[segment];
  const g = (genre ?? "").toLowerCase();
  if (g.includes("festival")) return "le.festival";
  if (g.includes("comedy")) return "le.nightlife";
  return "le.other";
}

// ── Start-date resolution ──
// Ticketmaster populates `dates.start.dateTime` for most events, but some
// older/all-day events only expose `localDate` (+ optional `localTime`) with
// no explicit timezone. We treat them as local-UTC — small inaccuracy, but
// canonical dedupe's 15-min slot is forgiving.

function resolveStart(
  start: { dateTime?: string; localDate?: string; localTime?: string } | undefined,
): Date | null {
  if (!start) return null;
  if (start.dateTime) {
    const d = new Date(start.dateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (start.localDate) {
    const time = start.localTime ?? "00:00:00";
    const d = new Date(`${start.localDate}T${time}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function pickImage(
  images: Array<{ url: string; width?: number; ratio?: string }> | undefined,
): string | undefined {
  if (!images || images.length === 0) return undefined;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const candidate = sorted.find((i) => (i.width ?? 0) >= 640) ?? sorted[0];
  return isHttpUrl(candidate.url) ? candidate.url : undefined;
}

function pickVenue(
  embedded: { venues?: Array<z.infer<typeof TmVenueSchema>> } | undefined,
): {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
} {
  const v = embedded?.venues?.[0];
  if (!v) return {};
  const latRaw = v.location?.latitude;
  const lonRaw = v.location?.longitude;
  const latitude = typeof latRaw === "number" ? latRaw : latRaw ? Number.parseFloat(latRaw) : undefined;
  const longitude = typeof lonRaw === "number" ? lonRaw : lonRaw ? Number.parseFloat(lonRaw) : undefined;
  const addressLine = v.address?.line1;
  const cityName = v.city?.name;
  const composedAddress = [addressLine, cityName].filter(Boolean).join(", ") || undefined;
  return {
    name: v.name,
    address: composedAddress,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
}

export interface TicketmasterEventsProviderOptions {
  apiKey: string;
  /** Discovery API base. Override for tests. */
  baseUrl?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  /** Search radius in km sent to TM. Defaults to 25 (covers typical
   * property-anchor queries; TM returns fewer results for smaller radii). */
  defaultRadiusKm?: number;
  /** Max size per TM page. Max 200 by their docs; we keep 100 as a
   * conservative default. */
  defaultPageSize?: number;
}

export class TicketmasterEventsProvider implements LocalEventSourceProvider {
  readonly source = "ticketmaster";
  readonly priority = PROVIDER_PRIORITY.ticketmaster;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultRadiusKm: number;
  private readonly defaultPageSize: number;

  constructor(options: TicketmasterEventsProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://app.ticketmaster.com";
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
        error: { kind: "config", message: "TICKETMASTER_API_KEY is not set" },
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    const size = Math.min(this.defaultPageSize, params.limit ?? this.defaultPageSize);
    const url = new URL(`${this.baseUrl}/discovery/v2/events.json`);
    url.searchParams.set("apikey", this.apiKey);
    url.searchParams.set(
      "latlong",
      `${params.anchor.latitude},${params.anchor.longitude}`,
    );
    url.searchParams.set("radius", String(this.defaultRadiusKm));
    url.searchParams.set("unit", "km");
    url.searchParams.set("locale", params.locale === "es" ? "es" : "en");
    url.searchParams.set("startDateTime", toTmInstant(params.window.from));
    url.searchParams.set("endDateTime", toTmInstant(params.window.to));
    url.searchParams.set("size", String(size));
    url.searchParams.set("sort", "date,asc");

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
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
      if (res.status === 401 || res.status === 403) {
        return SourceFetchResultSchema.parse({
          ...baseEnvelope,
          status: "unavailable",
          error: { kind: "auth", message: `HTTP ${res.status} from Ticketmaster` },
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
            message: "HTTP 429 from Ticketmaster",
            ...(Number.isFinite(retry) ? { retryAfterSeconds: retry as number } : {}),
          },
        });
      }
      return SourceFetchResultSchema.parse({
        ...baseEnvelope,
        status: "unavailable",
        error: { kind: "network", message: `HTTP ${res.status} from Ticketmaster` },
      });
    }

    const json = await res.json().catch(() => null);
    if (!json) {
      return SourceFetchResultSchema.parse({
        source: this.source,
        status: "parse_error",
        events: [],
        warnings: [],
        error: { kind: "parse", message: "Ticketmaster response was not JSON" },
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    const parsed = TmResponseSchema.safeParse(json);
    if (!parsed.success) {
      return SourceFetchResultSchema.parse({
        source: this.source,
        status: "parse_error",
        events: [],
        warnings: [],
        error: {
          kind: "parse",
          message: `Ticketmaster response shape invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`,
        },
        fetchedAt,
        durationMs: Date.now() - startedAt,
      });
    }

    const tmEvents = parsed.data._embedded?.events ?? [];
    const candidates: NormalizedEventCandidate[] = [];
    const warnings: string[] = [];
    const fromMs = params.window.from.getTime();
    const toMs = params.window.to.getTime();

    for (const ev of tmEvents) {
      const startsAt = resolveStart(ev.dates?.start);
      if (!startsAt) {
        warnings.push(`ticketmaster skipped event (no start): ${ev.name}`);
        continue;
      }
      const t = startsAt.getTime();
      if (t < fromMs || t > toMs) continue;

      const endRaw = ev.dates?.end?.dateTime;
      const endsAt = endRaw ? new Date(endRaw) : undefined;
      const endsAtValid = endsAt && !Number.isNaN(endsAt.getTime()) && endsAt.getTime() >= startsAt.getTime();

      const classification = ev.classifications?.[0];
      const segment = classification?.segment?.name;
      const genre = classification?.genre?.name;
      const categoryKey = mapTicketmasterSegment(segment, genre);

      const venue = pickVenue(ev._embedded);
      const imageUrl = pickImage(ev.images);

      const pr = ev.priceRanges?.[0];
      const priceInfo = buildPriceInfo(pr);

      const hasLat = typeof venue.latitude === "number";
      const hasLon = typeof venue.longitude === "number";
      const nativeTypes = [segment, genre, classification?.subGenre?.name]
        .filter((s): s is string => Boolean(s));

      const candidateInput: NormalizedEventCandidate = {
        source: this.source,
        sourceExternalId: ev.id,
        sourceUrl: ev.url && isHttpUrl(ev.url) ? ev.url : `${this.baseUrl}/event/${ev.id}`,
        title: ev.name,
        ...(ev.info || ev.description
          ? { descriptionMd: (ev.info ?? ev.description) as string }
          : {}),
        categoryKey,
        startsAt,
        ...(endsAtValid && endsAt ? { endsAt } : {}),
        ...(venue.name ? { venueName: venue.name } : {}),
        ...(venue.address ? { venueAddress: venue.address } : {}),
        ...(hasLat && hasLon
          ? { latitude: venue.latitude as number, longitude: venue.longitude as number }
          : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(priceInfo ? { priceInfo } : {}),
        confidence: 0.7,
        providerMetadata: {
          nativeCategory: segment ?? null,
          nativeTypes,
          confidence: null,
          retrievedAt: fetchedAt,
        },
        retrievedAt: fetchedAt,
      };

      const validated = NormalizedEventCandidateSchema.safeParse(candidateInput);
      if (!validated.success) {
        warnings.push(
          `ticketmaster dropped (invalid candidate): ${validated.error.issues[0]?.message ?? "unknown"}`,
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

function toTmInstant(d: Date): string {
  // TM wants `YYYY-MM-DDTHH:mm:ssZ` with no millis.
  return d.toISOString().replace(/\.\d+Z$/, "Z");
}

function buildPriceInfo(
  pr: { currency?: string; min?: number; max?: number } | undefined,
): { free?: boolean; minAmount?: number; maxAmount?: number; currency?: string } | null {
  if (!pr) return null;
  const minAmount = typeof pr.min === "number" && pr.min >= 0 ? pr.min : undefined;
  const maxAmount = typeof pr.max === "number" && pr.max >= 0 ? pr.max : undefined;
  const currency = typeof pr.currency === "string" && pr.currency.length === 3 ? pr.currency : undefined;
  if (minAmount === undefined && maxAmount === undefined && !currency) return null;
  if (minAmount !== undefined && maxAmount !== undefined && maxAmount < minAmount) return null;
  const free = minAmount === 0 && maxAmount === 0 ? true : undefined;
  return {
    ...(free !== undefined ? { free } : {}),
    ...(minAmount !== undefined ? { minAmount } : {}),
    ...(maxAmount !== undefined ? { maxAmount } : {}),
    ...(currency ? { currency } : {}),
  };
}

