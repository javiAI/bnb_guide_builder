"use client";

import type { GuideLocalEventItem } from "@/lib/types/guide-map";
import { findLocalEventCategory } from "@/lib/taxonomy-loader";

interface Props {
  event: GuideLocalEventItem;
}

export function GuideLocalEventCard({ event }: Props) {
  const category = findLocalEventCategory(event.categoryKey);
  const categoryLabel = category?.guestLabel ?? category?.label ?? null;

  // "use client" — date formatting runs in the guest's browser so the time
  // matches the guest's local clock. A server component would format in the
  // server's TZ (often UTC in prod), showing times shifted by multiple hours.
  const starts = new Date(event.startsAt);
  const month = starts
    .toLocaleString("es-ES", { month: "short" })
    .replace(".", "");
  const day = starts.toLocaleString("es-ES", { day: "numeric" });
  const time = starts.toLocaleString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const description = event.descriptionMd
    ? truncate(event.descriptionMd, 180)
    : null;

  const sourceLabel = formatSourceLabel(event.primarySource);
  const extraSources = event.contributingSources.filter(
    (s) => s !== event.primarySource,
  );

  return (
    <article className="guide-event">
      <div className="guide-event__date" aria-hidden="true">
        <span className="guide-event__month">{month}</span>
        <span className="guide-event__day">{day}</span>
      </div>
      <div className="guide-event__body">
        <h3 className="guide-event__title">{event.title}</h3>
        <div className="guide-event__meta">
          {categoryLabel ? (
            <span className="guide-event__meta-item">{categoryLabel}</span>
          ) : null}
          <span className="guide-event__meta-item">{time}</span>
          {event.venueName ? (
            <span className="guide-event__meta-item">{event.venueName}</span>
          ) : null}
          {!event.hasCoords ? (
            <span className="guide-event__meta-item guide-event__meta-item--nocoord">
              Sin ubicación exacta
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="guide-event__desc">{description}</p>
        ) : null}
        <div className="guide-event__footer">
          <a
            className="guide-event__source"
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver detalles ↗
          </a>
          <span
            className="guide-event__origin"
            title={
              extraSources.length > 0
                ? `También en: ${extraSources.map(formatSourceLabel).join(", ")}`
                : undefined
            }
          >
            Fuente: {sourceLabel}
            {extraSources.length > 0 ? ` (+${extraSources.length})` : null}
          </span>
        </div>
      </div>
    </article>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

// Provider identifiers are stable technical strings (`predicthq`,
// `ticketmaster`, `firecrawl:<source_key>`). Render friendlier labels without
// hiding the underlying provider — that's the whole point of surfacing this.
function formatSourceLabel(source: string): string {
  if (source.startsWith("firecrawl:")) {
    const key = source.slice("firecrawl:".length);
    return `Firecrawl (${key})`;
  }
  if (source === "predicthq") return "PredictHQ";
  if (source === "ticketmaster") return "Ticketmaster";
  return source;
}
