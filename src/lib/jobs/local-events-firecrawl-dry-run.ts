#!/usr/bin/env tsx
/**
 * Firecrawl dry-run for the local-events aggregator.
 *
 * Scrapes every curated source in `taxonomies/local_event_sources.json`
 * against the real Firecrawl API (requires `FIRECRAWL_API_KEY`) and prints
 * a per-source report: status, event count, parse warnings, elapsed.
 *
 * Purpose: answer "is Firecrawl actually producing events in real runs?"
 * with a deterministic one-shot command, independent of the scheduler /
 * database / aggregator logic. Synthetic tests mock `fetch` and miss
 * upstream regressions (DOM changes, cookie walls, JS-rendered agendas) —
 * this runner is the ground truth.
 *
 * Usage:
 *   npm run firecrawl:dry-run                    # scrape all curated sources
 *   npm run firecrawl:dry-run -- --source <key>  # scrape just one source
 *   npm run firecrawl:dry-run -- --json          # machine-readable output
 */

import { localEventSources } from "@/lib/taxonomy-loader";
import { FirecrawlLocalEventsProvider } from "@/lib/services/local-events/firecrawl-provider";
import type {
  SourceFetchParams,
  SourceFetchResult,
} from "@/lib/services/local-events/contracts";

interface Args {
  onlySourceKey: string | null;
  jsonOutput: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { onlySourceKey: null, jsonOutput: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source" && i + 1 < argv.length) {
      out.onlySourceKey = argv[++i];
    } else if (a === "--json") {
      out.jsonOutput = true;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    console.error("FIRECRAWL_API_KEY is not set — cannot run real dry-run.");
    process.exit(1);
  }

  const allSources = localEventSources.items;
  const selected = args.onlySourceKey
    ? allSources.filter((s) => s.key === args.onlySourceKey)
    : allSources;

  if (selected.length === 0) {
    console.error(
      `No source matches --source "${args.onlySourceKey}". Available keys: ${allSources.map((s) => s.key).join(", ")}`,
    );
    process.exit(1);
  }

  const now = new Date();
  const windowFrom = now;
  const windowTo = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const perSourceResults: Array<{
    key: string;
    url: string;
    city: string;
    status: SourceFetchResult["status"];
    events: number;
    warnings: string[];
    durationMs: number;
    error?: { kind: string; message: string };
    sampleTitles: string[];
  }> = [];

  for (const src of selected) {
    // Anchor each run at the source's own centroid so applicability always
    // passes — this runner is validating the scrape, not the selector.
    const params: SourceFetchParams = {
      anchor: { latitude: src.latitude, longitude: src.longitude },
      locale: (src.language === "en" ? "en" : "es") as "en" | "es",
      city: src.city,
      window: { from: windowFrom, to: windowTo },
    };

    // Fresh provider per source so the scrape cache doesn't mask behavior.
    const provider = new FirecrawlLocalEventsProvider({
      apiKey,
      sources: [src],
    });

    const result = await provider.fetch(params);
    perSourceResults.push({
      key: src.key,
      url: src.sourceUrl,
      city: src.city,
      status: result.status,
      events: result.events.length,
      warnings: result.warnings,
      durationMs: result.durationMs,
      ...(result.error
        ? { error: { kind: result.error.kind, message: result.error.message } }
        : {}),
      sampleTitles: result.events.slice(0, 3).map((e) => e.title),
    });
  }

  if (args.jsonOutput) {
    console.log(JSON.stringify({ runAt: now.toISOString(), results: perSourceResults }, null, 2));
    return;
  }

  // Human-readable report
  const countOk = perSourceResults.filter((r) => r.status === "ok" && r.events > 0).length;
  const countEmpty = perSourceResults.filter((r) => r.status === "ok" && r.events === 0).length;
  const countNoSources = perSourceResults.filter(
    (r) => r.status === "no_sources_applicable",
  ).length;
  const countFailed = perSourceResults.filter(
    (r) =>
      r.status !== "ok" &&
      r.status !== "no_sources_applicable" &&
      r.status !== "disabled",
  ).length;
  const totalEvents = perSourceResults.reduce((a, r) => a + r.events, 0);

  console.log(
    `\nFirecrawl dry-run — ${perSourceResults.length} source(s) · ${totalEvents} events total`,
  );
  console.log(
    `  ok(events): ${countOk}   ok(empty): ${countEmpty}   no_sources: ${countNoSources}   failed: ${countFailed}\n`,
  );

  for (const r of perSourceResults) {
    const statusTag =
      r.status === "ok" && r.events > 0
        ? "OK"
        : r.status === "ok"
          ? "EMPTY"
          : r.status.toUpperCase();
    console.log(`[${statusTag.padEnd(16)}] ${r.key} (${r.city})`);
    console.log(`   url:      ${r.url}`);
    console.log(`   events:   ${r.events}   duration: ${r.durationMs}ms`);
    if (r.sampleTitles.length > 0) {
      for (const t of r.sampleTitles) console.log(`     · ${t}`);
    }
    if (r.error) {
      console.log(`   error:    [${r.error.kind}] ${r.error.message}`);
    }
    if (r.warnings.length > 0) {
      for (const w of r.warnings.slice(0, 3)) console.log(`   warn:     ${w}`);
      if (r.warnings.length > 3) {
        console.log(`   ... +${r.warnings.length - 3} more warnings`);
      }
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("dry-run failed:", err);
  process.exit(1);
});
