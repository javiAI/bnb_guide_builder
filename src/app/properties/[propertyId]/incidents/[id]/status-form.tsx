"use client";

import { useActionState } from "react";
import { changeIncidentStatusAction } from "@/lib/actions/incident.actions";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import type { ActionResult } from "@/lib/types/action-result";

interface Props {
  incidentId: string;
  propertyId: string;
  currentStatus: string;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Abierta" },
  { value: "in_progress", label: "En curso" },
  { value: "resolved", label: "Resuelta" },
  { value: "cancelled", label: "Cancelada" },
];

export function IncidentStatusForm({ incidentId, propertyId, currentStatus }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    changeIncidentStatusAction,
    null,
  );

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="incidentId" value={incidentId} />
      <input type="hidden" name="propertyId" value={propertyId} />
      <label className="flex items-center gap-2 text-sm">
        <span className="text-[var(--color-neutral-600)]">Estado</span>
        <select
          name="status"
          defaultValue={currentStatus}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-60"
      >
        Guardar
      </button>
      {pending && <InlineSaveStatus status="saving" />}
      {!pending && state?.success && <InlineSaveStatus status="saved" />}
      {!pending && state && !state.success && (
        <span className="text-xs text-[var(--color-danger-500)]">
          {state.error ?? "Error"}
        </span>
      )}
    </form>
  );
}
