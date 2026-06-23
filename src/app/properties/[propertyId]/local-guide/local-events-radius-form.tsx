"use client";

import { useActionState, useRef } from "react";
import { updateLocalEventsRadiusAction } from "@/lib/actions/editor.actions";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { FieldInput } from "@/components/ui/field";
import { autoSaveSubmit, useFormAutoSave } from "@/lib/use-form-auto-save";
import type { ActionResult } from "@/lib/types/action-result";

interface Props {
  propertyId: string;
  initialRadiusKm: number;
}

/** Host-facing control for the per-property event-search radius. Drives the
 * PHQ/Ticketmaster `within` / `radius` query params and widens Firecrawl's
 * curated-source applicability filter on the next sync tick. Auto-saves as you
 * edit (no "Guardar" button); native min/max gate the save via `checkValidity`. */
export function LocalEventsRadiusForm({ propertyId, initialRadiusKm }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState<ActionResult | null, FormData>(
    updateLocalEventsRadiusAction,
    null,
  );
  useFormAutoSave(formRef);

  const error =
    state && !state.success
      ? (state.fieldErrors?.radiusKm?.[0] ?? state.error ?? "No se pudo actualizar.")
      : null;

  return (
    <form
      ref={formRef}
      onSubmit={autoSaveSubmit(dispatch)}
      className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4"
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <FieldInput
        name="radiusKm"
        label="Radio de búsqueda (km)"
        type="number"
        min={1}
        max={200}
        defaultValue={initialRadiusKm}
        className="w-28"
        help="Aplicado en la próxima sincronización (PredictHQ, Ticketmaster y Firecrawl)."
      />
      <div className="flex min-h-[44px] items-center">
        <AutoSaveStatus pending={pending} />
      </div>
      {error && (
        <p role="status" className="text-sm text-[var(--color-status-error-text)]">
          {error}
        </p>
      )}
    </form>
  );
}
