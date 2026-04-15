"use client";

import { useActionState, useState } from "react";
import { createIncidentAction, type ActionResult } from "@/lib/actions/incident.actions";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";

interface TargetOption {
  value: string;
  label: string;
}

interface CreateIncidentFormProps {
  propertyId: string;
  targetOptions: {
    system: TargetOption[];
    amenity: TargetOption[];
    space: TargetOption[];
    access: TargetOption[];
  };
  playbookOptions: TargetOption[];
}

type TargetType = "property" | "system" | "amenity" | "space" | "access";

export function CreateIncidentForm({
  propertyId,
  targetOptions,
  playbookOptions,
}: CreateIncidentFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createIncidentAction,
    null,
  );
  const [targetType, setTargetType] = useState<TargetType>("property");
  const [targetId, setTargetId] = useState<string>("");

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  const saveStatus = pending
    ? "saving"
    : state?.success
      ? "saved"
      : state && !state.success
        ? "error"
        : undefined;

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0];

  // `datetime-local` expects local-time. Avoid toISOString() which is UTC and
  // would shift the prefill by the user's offset.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <form action={formAction} className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <input type="hidden" name="propertyId" value={propertyId} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Nueva ocurrencia</h2>
        {saveStatus && <InlineSaveStatus status={saveStatus} />}
      </div>
      {state && !state.success && state.error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-2 text-xs text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-[var(--foreground)]">Título *</span>
          <input name="title" type="text" required className={inputClass} />
          {fieldError("title") && (
            <span className="mt-1 block text-xs text-[var(--color-danger-700)]">{fieldError("title")}</span>
          )}
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--foreground)]">Fecha *</span>
          <input
            name="occurredAt"
            type="datetime-local"
            required
            defaultValue={localNow}
            className={inputClass}
          />
          {fieldError("occurredAt") && (
            <span className="mt-1 block text-xs text-[var(--color-danger-700)]">{fieldError("occurredAt")}</span>
          )}
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--foreground)]">Severidad</span>
          <select name="severity" defaultValue="medium" className={inputClass}>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--foreground)]">Estado</span>
          <select name="status" defaultValue="open" className={inputClass}>
            <option value="open">Abierta</option>
            <option value="in_progress">En curso</option>
            <option value="resolved">Resuelta</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
      </div>

      <fieldset className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
        <legend className="px-1 text-xs font-medium text-[var(--foreground)]">Objetivo</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-[var(--foreground)]">Tipo</span>
            <select
              name="targetType"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as TargetType);
                setTargetId("");
              }}
              className={inputClass}
            >
              <option value="property">Propiedad (general)</option>
              <option value="system" disabled={targetOptions.system.length === 0}>
                Sistema {targetOptions.system.length === 0 ? "(ninguno)" : ""}
              </option>
              <option value="amenity" disabled={targetOptions.amenity.length === 0}>
                Amenity {targetOptions.amenity.length === 0 ? "(ninguna)" : ""}
              </option>
              <option value="space" disabled={targetOptions.space.length === 0}>
                Espacio {targetOptions.space.length === 0 ? "(ninguno)" : ""}
              </option>
              <option value="access">Método de acceso</option>
            </select>
          </label>
          {targetType !== "property" && (
            <label className="block">
              <span className="text-xs font-medium text-[var(--foreground)]">Objetivo *</span>
              <select
                name="targetId"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">Selecciona…</option>
                {targetOptions[targetType].map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldError("targetId") && (
                <span className="mt-1 block text-xs text-[var(--color-danger-700)]">{fieldError("targetId")}</span>
              )}
            </label>
          )}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-xs font-medium text-[var(--foreground)]">
          Playbook relacionado (opcional)
        </span>
        <select name="playbookId" defaultValue="" className={inputClass}>
          <option value="">Ninguno</option>
          {playbookOptions.map((pb) => (
            <option key={pb.value} value={pb.value}>
              {pb.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[var(--foreground)]">Notas</span>
        <textarea name="notes" rows={3} className={inputClass} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Registrar ocurrencia"}
      </button>
    </form>
  );
}
