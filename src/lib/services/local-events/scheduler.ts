import { prisma } from "@/lib/db";
import {
  aggregateLocalEvents,
  type AggregatedSourceReport,
} from "./aggregator";
import type { LocalEventSourceProvider } from "./contracts";
import { FirecrawlLocalEventsProvider } from "./firecrawl-provider";
import { PredictHqEventsProvider } from "./predicthq-provider";
import {
  syncLocalEventsForProperty,
  type SyncLocalEventsReport,
} from "./sync";
import { TicketmasterEventsProvider } from "./ticketmaster-provider";

// ── Scheduler tick ──
// Runs on cron (Vercel Cron hits `POST /api/cron/local-events`). For every
// geo-anchored property, aggregates candidates from the 3 sources, merges,
// and persists.
//
// Contracts:
//   - Missing API keys produce `config_error` envelopes per source, never
//     a thrown exception. A tick with zero valid keys still succeeds (all
//     sources config_error, zero merged events persisted).
//   - One property's failure does not halt the tick — each property is
//     isolated in its own try/catch so a schema anomaly or a transient DB
//     hiccup degrades to a `perProperty[i].error` entry.
//   - Firecrawl's per-instance scrape cache is reused across all properties
//     in a single tick (`selectApplicableSources` picks subsets per
//     property, but repeated URLs hit the cache once). Providers are
//     instantiated ONCE per tick for this reason.
//   - Horizon: 60 days forward (configurable).

const DEFAULT_HORIZON_DAYS = 60;

export interface LocalEventsPerPropertyReport {
  propertyId: string;
  propertyNickname: string;
  mergedEventsCount: number;
  sourceReports: AggregatedSourceReport[];
  aggregatorWarnings: string[];
  sync: SyncLocalEventsReport | null;
  error?: string;
}

export interface LocalEventsTickReport {
  now: string;
  propertiesScanned: number;
  perProperty: LocalEventsPerPropertyReport[];
  providersConfigured: string[];
  horizonDays: number;
}

export interface RunLocalEventsTickOptions {
  now?: Date;
  horizonDays?: number;
  /** Pre-built providers (tests inject). Defaults to env-based instantiation. */
  providers?: ReadonlyArray<LocalEventSourceProvider>;
  /** DI hook for tests. */
  db?: typeof prisma;
}

export async function runLocalEventsTick(
  options: RunLocalEventsTickOptions = {},
): Promise<LocalEventsTickReport> {
  const now = options.now ?? new Date();
  const horizonDays = options.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const db = options.db ?? prisma;
  const providers =
    options.providers ??
    buildProvidersFromEnv({ now: () => now });

  const windowFrom = new Date(now.getTime());
  const windowTo = new Date(now.getTime() + horizonDays * 86400 * 1000);

  const properties = await db.property.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      propertyNickname: true,
      latitude: true,
      longitude: true,
      city: true,
      defaultLocale: true,
    },
  });

  const perProperty: LocalEventsPerPropertyReport[] = [];

  for (const p of properties) {
    if (p.latitude === null || p.longitude === null) continue;
    const locale: "es" | "en" = p.defaultLocale === "en" ? "en" : "es";

    try {
      const aggregated = await aggregateLocalEvents({
        params: {
          anchor: { latitude: p.latitude, longitude: p.longitude },
          locale,
          city: p.city,
          window: { from: windowFrom, to: windowTo },
        },
        providers,
        propertyId: p.id,
        now: () => now,
      });

      const sync = await syncLocalEventsForProperty({
        propertyId: p.id,
        aggregated,
        tickStartedAt: now,
        prisma: db,
      });

      perProperty.push({
        propertyId: p.id,
        propertyNickname: p.propertyNickname,
        mergedEventsCount: aggregated.merged.length,
        sourceReports: aggregated.sourceReports,
        aggregatorWarnings: aggregated.warnings,
        sync,
      });
    } catch (err) {
      perProperty.push({
        propertyId: p.id,
        propertyNickname: p.propertyNickname,
        mergedEventsCount: 0,
        sourceReports: [],
        aggregatorWarnings: [],
        sync: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    now: now.toISOString(),
    propertiesScanned: properties.length,
    perProperty,
    providersConfigured: providers.map((p) => p.source),
    horizonDays,
  };
}

// ── Provider factory ──
// Builds the triad from env. Missing keys still produce providers — their
// `.fetch()` returns `config_error` envelopes, which the aggregator surfaces
// as per-source reports. A tick with all three keys missing degrades
// gracefully: zero events persisted, perProperty reports carry config_error
// for each source, status is observable.

export function buildProvidersFromEnv(
  options: { now?: () => Date } = {},
): LocalEventSourceProvider[] {
  const now = options.now;
  return [
    new PredictHqEventsProvider({
      apiKey: process.env.PREDICTHQ_API_KEY ?? "",
      ...(now ? { now } : {}),
    }),
    new FirecrawlLocalEventsProvider({
      apiKey: process.env.FIRECRAWL_API_KEY ?? "",
      ...(now ? { now } : {}),
    }),
    new TicketmasterEventsProvider({
      apiKey: process.env.TICKETMASTER_API_KEY ?? "",
      ...(now ? { now } : {}),
    }),
  ];
}
