/** Renders a provider identifier as a host-facing label without hiding the
 * underlying provider — the whole point of surfacing `primarySource` is
 * transparency. Firecrawl variants carry their curated source key
 * (`firecrawl:madrid_eventos_madrid`) so the host can tell which scraper
 * emitted the event; we expose that in the parenthetical. */
export function formatLocalEventSourceLabel(source: string): string {
  if (source.startsWith("firecrawl:")) {
    return `Firecrawl (${source.slice("firecrawl:".length)})`;
  }
  if (source === "predicthq") return "PredictHQ";
  if (source === "ticketmaster") return "Ticketmaster";
  return source;
}
