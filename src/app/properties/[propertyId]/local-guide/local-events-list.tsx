"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { toggleLocalEventPublishedAction } from "@/lib/actions/editor.actions";
import { findLocalEventCategory } from "@/lib/taxonomies/local-event-categories";
import { formatLocalEventSourceLabel } from "@/lib/services/local-events/source-label";
import { isHttpUrl } from "@/lib/services/local-events/url-utils";
import { Switch } from "@/components/ui/switch";
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
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-surface)] px-6 py-8 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Aún no hay eventos sincronizados. La sincronización nocturna los traerá,
          o puedes lanzarla ahora con «Sincronizar».
        </p>
      </div>
    );
  }

  const publishedCount = events.filter((e) => e.published).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-text-muted)]">
        {events.length} eventos encontrados ·{" "}
        <span className="font-semibold text-[var(--color-text-primary)]">
          {publishedCount}
        </span>{" "}
        publicados en la guía del huésped
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
    <li className="flex flex-wrap items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {event.title}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {dateLabel} · {categoryLabel}
          {event.venueName ? ` · ${event.venueName}` : ""}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
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
                className="inline-flex items-center gap-0.5 text-[var(--color-text-link)] hover:underline"
              >
                Ver fuente
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </>
          ) : null}
        </p>
        {error ? (
          <p className="text-xs text-[var(--color-status-error-text)]">{error}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-[var(--color-text-secondary)]">
          {optimistic ? "Publicado" : "Oculto"}
        </span>
        <Switch
          size="sm"
          checked={optimistic}
          onChange={onToggle}
          disabled={pending}
          ariaLabel={optimistic ? "Ocultar de la guía" : "Publicar en la guía"}
        />
      </div>
    </li>
  );
}

