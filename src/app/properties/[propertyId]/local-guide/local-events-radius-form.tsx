"use client";

import { useState, useTransition } from "react";
import { updateLocalEventsRadiusAction } from "@/lib/actions/editor.actions";

interface Props {
  propertyId: string;
  initialRadiusKm: number;
}

/** Host-facing control for the per-property event-search radius. Drives the
 * PHQ/Ticketmaster `within` / `radius` query params and widens Firecrawl's
 * curated-source applicability filter on the next sync tick. */
export function LocalEventsRadiusForm({ propertyId, initialRadiusKm }: Props) {
  const [value, setValue] = useState<string>(String(initialRadiusKm));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );

  const dirty = value !== String(initialRadiusKm);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    fd.append("radiusKm", value);
    startTransition(async () => {
      const res = await updateLocalEventsRadiusAction(null, fd);
      if (res.success) {
        setMessage({ kind: "ok", text: "Radio actualizado." });
      } else {
        const err =
          res.fieldErrors?.radiusKm?.[0] ?? res.error ?? "No se pudo actualizar.";
        setMessage({ kind: "error", text: err });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="local-events-radius-km"
          className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]"
        >
          Radio de búsqueda (km)
        </label>
        <input
          id="local-events-radius-km"
          name="radiusKm"
          type="number"
          min={1}
          max={200}
          step={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage(null);
          }}
          className="w-28 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
        />
      </div>
      <button
        type="submit"
        disabled={!dirty || pending}
        className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar"}
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
          Aplicado en la próxima sincronización de eventos (PredictHQ, Ticketmaster y Firecrawl).
        </p>
      )}
    </form>
  );
}
