"use client";

import { useState, useTransition } from "react";
import {
  syncLocalEventsForPropertyAction,
  type SyncLocalEventsStats,
} from "@/lib/actions/editor.actions";

interface Props {
  propertyId: string;
}

/** Manual trigger for `runLocalEventsTick({ propertyId })`. The nightly cron
 * handles this automatically; the button is for hosts who want to see the
 * effect of a just-changed radius without waiting 24h, and for validating
 * that providers (PHQ / Firecrawl / Ticketmaster) actually return events
 * for their specific property. */
export function SyncEventsButton({ propertyId }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "ok"; stats: SyncLocalEventsStats } | { kind: "error"; text: string } | null
  >(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    startTransition(async () => {
      const res = await syncLocalEventsForPropertyAction(null, fd);
      if (res.success && res.data) {
        setMessage({ kind: "ok", stats: res.data });
      } else {
        setMessage({
          kind: "error",
          text: res.error ?? "No se pudo sincronizar.",
        });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Sincronizando…" : "Sincronizar ahora"}
        </button>
        {message === null ? (
          <p className="text-xs text-[var(--color-neutral-500)]">
            Consulta las 3 fuentes (PredictHQ, Firecrawl, Ticketmaster) y guarda los eventos nuevos como candidatos (no publicados por defecto).
          </p>
        ) : message.kind === "error" ? (
          <p
            role="status"
            className="text-sm text-[var(--color-danger-600,#dc2626)]"
          >
            {message.text}
          </p>
        ) : (
          <p role="status" className="text-sm text-[var(--foreground)]">
            <strong>{message.stats.mergedEventsCount}</strong> evento(s)
            fusionados · {message.stats.eventsCreated} nuevos,{" "}
            {message.stats.eventsUpdated} actualizados,{" "}
            {message.stats.eventsDeleted} eliminados.
          </p>
        )}
      </div>
      {message?.kind === "ok" ? (
        <ul className="flex flex-wrap gap-2 text-xs">
          {message.stats.sourceReportsSummary.map((r) => (
            <li
              key={r.source}
              className={`rounded-[var(--radius-sm,4px)] border px-2 py-1 ${
                r.status === "ok"
                  ? "border-[var(--color-success-300,#86efac)] text-[var(--color-success-700,#15803d)]"
                  : r.status === "config_error" || r.error
                    ? "border-[var(--color-danger-300,#fca5a5)] text-[var(--color-danger-700,#b91c1c)]"
                    : "border-[var(--color-neutral-300)] text-[var(--color-neutral-600)]"
              }`}
              title={r.error ?? undefined}
            >
              {r.source}: {r.candidatesCount} · {r.status}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
