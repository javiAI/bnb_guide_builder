"use client";

import { useActionState, useRef } from "react";
import { changeIncidentStatusAction } from "@/lib/actions/incident.actions";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { useFormAutoSave } from "@/lib/use-form-auto-save";
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
  const formRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(formRef);

  return (
    <form ref={formRef} action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
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
      <AutoSaveStatus pending={pending} />
      {!pending && state && !state.success && (
        <span className="text-xs text-[var(--color-danger-500)]">
          {state.error ?? "Error"}
        </span>
      )}
    </form>
  );
}
