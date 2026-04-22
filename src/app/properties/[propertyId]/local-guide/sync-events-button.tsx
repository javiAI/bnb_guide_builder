"use client";

import { useState, useTransition } from "react";
import { syncLocalEventsForPropertyAction } from "@/lib/actions/editor.actions";

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
    { kind: "ok" | "error"; text: string } | null
  >(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    startTransition(async () => {
      const res = await syncLocalEventsForPropertyAction(null, fd);
      if (res.success) {
        setMessage({ kind: "ok", text: "Sincronización completada." });
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
      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
    >
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Sincronizando…" : "Sincronizar ahora"}
      </button>
      {message ? (
        <p
          role="status"
          className={`text-sm ${message.kind === "ok" ? "text-[var(--color-success-600,#16a34a)]" : "text-[var(--color-danger-600,#dc2626)]"}`}
        >
          {message.text}
        </p>
      ) : (
        <p className="text-xs text-[var(--color-neutral-500)]">
          Consulta las 3 fuentes (PredictHQ, Firecrawl, Ticketmaster) y guarda los eventos nuevos. Tarda unos segundos.
        </p>
      )}
    </form>
  );
}
