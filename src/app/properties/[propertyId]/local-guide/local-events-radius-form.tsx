"use client";

import { useRef, useState, useTransition } from "react";
import { updateLocalEventsRadiusAction } from "@/lib/actions/editor.actions";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { useFormAutoSave } from "@/lib/use-form-auto-save";

interface Props {
  propertyId: string;
  initialRadiusKm: number;
}

/** Host-facing control for the per-property event-search radius. Drives the
 * PHQ/Ticketmaster `within` / `radius` query params and widens Firecrawl's
 * curated-source applicability filter on the next sync tick. Auto-saves as you
 * edit (no "Guardar" button). */
export function LocalEventsRadiusForm({ propertyId, initialRadiusKm }: Props) {
  const [value, setValue] = useState<string>(String(initialRadiusKm));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(formRef, 700);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Skip invalid intermediate states (e.g. the field cleared mid-edit) so
    // auto-save never persists garbage or flashes an error while typing.
    const n = Number(value);
    if (!value.trim() || !Number.isInteger(n) || n < 1 || n > 200) return;
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    fd.append("radiusKm", value);
    startTransition(async () => {
      const res = await updateLocalEventsRadiusAction(null, fd);
      setError(
        res.success
          ? null
          : (res.fieldErrors?.radiusKm?.[0] ?? res.error ?? "No se pudo actualizar."),
      );
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="local-events-radius-km"
          className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
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
            setError(null);
          }}
          className="w-28 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
        />
      </div>
      <AutoSaveStatus pending={pending} />
      {error ? (
        <p role="status" className="text-sm text-[var(--color-status-error-text)]">
          {error}
        </p>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          Aplicado en la próxima sincronización de eventos (PredictHQ, Ticketmaster y Firecrawl).
        </p>
      )}
    </form>
  );
}
