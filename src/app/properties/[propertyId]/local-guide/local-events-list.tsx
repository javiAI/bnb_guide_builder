"use client";

import { useState, useTransition } from "react";
import { toggleLocalEventPublishedAction } from "@/lib/actions/editor.actions";
import { findLocalEventCategory } from "@/lib/taxonomy-loader";
import { formatLocalEventSourceLabel } from "@/lib/services/local-events/source-label";
import { isHttpUrl } from "@/lib/services/local-events/url-utils";
import type { LocalEventForAdmin } from "@/lib/services/guide-local-data";

interface Props {
  events: LocalEventForAdmin[];
}

/** Host-facing curation list. Rows synced from PHQ/Firecrawl/Ticketmaster
 * arrive `published:false`; flipping the toggle surfaces the event on the
 * public guide. Uses optimistic UI — the server action revalidates so any
 * network failure reverts on next paint. */
export function LocalEventsList({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-neutral-300)] bg-[var(--surface)] px-6 py-8 text-center">
        <p className="text-sm text-[var(--color-neutral-500)]">
          Aún no hay eventos sincronizados. Pulsa{" "}
          <span className="font-semibold">Sincronizar ahora</span> para
          consultar las fuentes automáticas.
        </p>
      </div>
    );
  }

  const publishedCount = events.filter((e) => e.published).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-neutral-500)]">
        {events.length} candidatos · {publishedCount} publicados en la guía del huésped.
      </p>
      <ul className="space-y-2">
        {events.map((event) => (
          <LocalEventRow key={event.id} event={event} />
        ))}
      </ul>
    </div>
  );
}

function LocalEventRow({ event }: { event: LocalEventForAdmin }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean>(event.published);
  const [error, setError] = useState<string | null>(null);

  const category = findLocalEventCategory(event.categoryKey);
  const categoryLabel = category?.label ?? event.categoryKey;
  const starts = new Date(event.startsAt);
  const dateLabel = starts.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  function onToggle(next: boolean) {
    setError(null);
    setOptimistic(next);
    const fd = new FormData();
    fd.append("eventId", event.id);
    fd.append("published", next ? "true" : "false");
    startTransition(async () => {
      const res = await toggleLocalEventPublishedAction(null, fd);
      if (!res.success) {
        setOptimistic(!next);
        setError(res.error ?? "No se pudo actualizar.");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
          {event.title}
        </p>
        <p className="text-xs text-[var(--color-neutral-500)]">
          {dateLabel} · {categoryLabel}
          {event.venueName ? ` · ${event.venueName}` : ""}
        </p>
        <p className="text-xs text-[var(--color-neutral-400)]">
          Fuente: {formatLocalEventSourceLabel(event.primarySource)}
          {event.contributingSources.length > 1
            ? ` (+${event.contributingSources.length - 1})`
            : ""}
          {isHttpUrl(event.sourceUrl) ? (
            <>
              {" · "}
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--color-primary-600)]"
              >
                Ver detalles ↗
              </a>
            </>
          ) : null}
        </p>
        {error ? (
          <p className="text-xs text-[var(--color-danger-600,#dc2626)]">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label={optimistic ? "Ocultar de la guía" : "Publicar en la guía"}
        disabled={pending}
        onClick={() => onToggle(!optimistic)}
        className={`shrink-0 rounded-[var(--radius-md)] px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
          optimistic
            ? "bg-[var(--color-primary-500)] text-white"
            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
        }`}
      >
        {optimistic ? "Publicado" : "Publicar"}
      </button>
    </li>
  );
}

