"use client";

import type { GuideLocalEventItem } from "@/lib/types/guide-map";
import { findLocalEventCategory } from "@/lib/taxonomies/local-event-categories";
import { formatLocalEventSourceLabel } from "@/lib/services/local-events/source-label";
import { isHttpUrl } from "@/lib/services/local-events/url-utils";

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

  const sourceLabel = formatLocalEventSourceLabel(event.primarySource);
  const extraSources = event.contributingSources.filter(
    (s) => s !== event.primarySource,
  );

  // Defence in depth against script-scheme URLs: the candidate schema already
  // refines on isHttpUrl, but a provider that bypasses it (or a legacy row)
  // must not produce a guest <a href> pointing at `javascript:` or similar.
  const safeSourceUrl = isHttpUrl(event.sourceUrl) ? event.sourceUrl : null;

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
          {safeSourceUrl ? (
            <a
              className="guide-event__source"
              href={safeSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver detalles ↗
            </a>
          ) : null}
          <span
            className="guide-event__origin"
            title={
              extraSources.length > 0
                ? `También en: ${extraSources.map(formatLocalEventSourceLabel).join(", ")}`
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
