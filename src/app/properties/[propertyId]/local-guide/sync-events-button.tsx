"use client";

import { useState, useTransition } from "react";
import {
  syncLocalEventsForPropertyAction,
  type SyncLocalEventsStats,
} from "@/lib/actions/editor.actions";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { formatLocalEventSourceLabel } from "@/lib/services/local-events/source-label";
import { TONE_PILL_TEXT, TONE_DOT_BORDER } from "@/lib/tone";
import type { BadgeTone } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  propertyId: string;
}

/** Spanish labels for the per-source sync status enum (leaked EN out of the UI). */
const SOURCE_STATUS_LABEL: Record<string, string> = {
  ok: "correcto",
  config_error: "sin configurar",
  unavailable: "no disponible",
  parse_error: "error de lectura",
  rate_limited: "límite alcanzado",
  disabled: "desactivada",
  no_sources_applicable: "sin fuentes",
};

function sourceTone(status: string, hasError: boolean): BadgeTone {
  if (status === "ok") return "success";
  if (status === "config_error" || status === "parse_error" || hasError) return "danger";
  return "neutral";
}

/** Manual trigger for `runLocalEventsTick({ propertyId })`. The nightly cron
 * handles this automatically; the button is for hosts who want to see the
 * effect of a just-changed radius without waiting 24h, and for validating
 * that providers (PHQ / Firecrawl / Ticketmaster) return events. */
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
        setMessage({ kind: "error", text: res.error ?? "No se pudo sincronizar." });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="md" type="submit" disabled={pending}>
          {pending ? "Sincronizando…" : "Sincronizar"}
        </Button>
        {message === null ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            Consulta las 3 fuentes (PredictHQ, Firecrawl, Ticketmaster) y guarda
            los eventos nuevos como candidatos (no publicados por defecto).
          </p>
        ) : message.kind === "error" ? (
          <p role="status" className="text-sm text-[var(--color-status-error-text)]">
            {message.text}
          </p>
        ) : (
          <p role="status" className="text-sm text-[var(--color-text-primary)]">
            <strong>{message.stats.mergedEventsCount}</strong> eventos combinados ·{" "}
            {message.stats.eventsCreated} nuevos, {message.stats.eventsUpdated}{" "}
            actualizados, {message.stats.eventsDeleted} eliminados.
          </p>
        )}
      </div>
      {message?.kind === "ok" ? (
        <ul className="flex flex-wrap gap-2 text-xs">
          {message.stats.sourceReportsSummary.map((r) => {
            const tone = sourceTone(r.status, Boolean(r.error));
            const chip = (
              <span
                className={cn(
                  "inline-block rounded-[var(--radius-sm)] border px-2 py-1",
                  TONE_DOT_BORDER[tone],
                  TONE_PILL_TEXT[tone],
                )}
              >
                {formatLocalEventSourceLabel(r.source)} · {r.candidatesCount} ·{" "}
                {SOURCE_STATUS_LABEL[r.status] ?? r.status}
              </span>
            );
            return (
              <li key={r.source}>
                {r.error ? <Tooltip text={r.error}>{chip}</Tooltip> : chip}
              </li>
            );
          })}
        </ul>
      ) : null}
    </form>
  );
}
