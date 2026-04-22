/** Renders a provider identifier as a host-facing label without hiding the
 * underlying provider — the whole point of surfacing `primarySource` is
 * transparency. Firecrawl variants carry their curated source key
 * (e.g. `firecrawl:madrid_esmadrid`, matching an entry in
 * `taxonomies/local_event_sources.json`) so the host can tell which
 * scraper emitted the event; we expose that in the parenthetical. */
export function formatLocalEventSourceLabel(source: string): string {
  if (source.startsWith("firecrawl:")) {
    return `Firecrawl (${source.slice("firecrawl:".length)})`;
  }
  if (source === "predicthq") return "PredictHQ";
  if (source === "ticketmaster") return "Ticketmaster";
  return source;
}
