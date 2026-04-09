"use client";

import { useActionState } from "react";
import { updatePlaybookAction, type ActionResult } from "@/lib/actions/editor.actions";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { visibilityLevels, getItems } from "@/lib/taxonomy-loader";

const visibilityOptions = getItems(visibilityLevels).filter(
  (v) => v.id !== "secret",
);

interface PlaybookDetailFormProps {
  propertyId: string;
  playbook: {
    id: string;
    title: string;
    severity: string;
    symptomsMd: string;
    guestStepsMd: string;
    internalStepsMd: string;
    escalationRule: string;
    visibility: string;
  };
}

export function PlaybookDetailForm({
  propertyId,
  playbook,
}: PlaybookDetailFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updatePlaybookAction,
    null,
  );

  const saveStatus = pending
    ? "saving"
    : state?.success
      ? "saved"
      : state?.error
        ? "error"
        : undefined;

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="playbookId" value={playbook.id} />
      <input type="hidden" name="propertyId" value={propertyId} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Detalles</h2>
        {saveStatus && <InlineSaveStatus status={saveStatus} />}
      </div>

      {state?.error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">Título *</span>
          <input name="title" type="text" required defaultValue={playbook.title} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">Severidad</span>
          <select name="severity" defaultValue={playbook.severity} className={inputClass}>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">Síntomas</span>
        <span className="ml-1 text-xs text-[var(--color-neutral-500)]">(Markdown)</span>
        <textarea
          name="symptomsMd"
          rows={3}
          defaultValue={playbook.symptomsMd}
          placeholder="Describe los síntomas que reporta el huésped…"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Pasos para el huésped
        </span>
        <span className="ml-1 text-xs text-[var(--color-neutral-500)]">(público)</span>
        <textarea
          name="guestStepsMd"
          rows={4}
          defaultValue={playbook.guestStepsMd}
          placeholder="1. Intenta reiniciar…&#10;2. Si no funciona…"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Pasos internos
        </span>
        <span className="ml-1 text-xs text-[var(--color-neutral-500)]">(solo operador)</span>
        <textarea
          name="internalStepsMd"
          rows={4}
          defaultValue={playbook.internalStepsMd}
          placeholder="1. Verificar en el panel…&#10;2. Contactar al técnico…"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Regla de escalación
        </span>
        <input
          name="escalationRule"
          type="text"
          defaultValue={playbook.escalationRule}
          placeholder="Ej: Si no se resuelve en 30 min, llamar al técnico"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">Visibilidad</span>
        <select name="visibility" defaultValue={playbook.visibility} className={inputClass}>
          {visibilityOptions.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
