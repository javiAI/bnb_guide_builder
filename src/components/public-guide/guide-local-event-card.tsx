import type { GuideLocalEventItem } from "@/lib/types/guide-map";
import { findLocalEventCategory } from "@/lib/taxonomy-loader";

interface Props {
  event: GuideLocalEventItem;
}

export function GuideLocalEventCard({ event }: Props) {
  const category = findLocalEventCategory(event.categoryKey);
  const categoryLabel = category?.guestLabel ?? category?.label ?? null;

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
        <a
          className="guide-event__source"
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver detalles ↗
        </a>
      </div>
    </article>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}
