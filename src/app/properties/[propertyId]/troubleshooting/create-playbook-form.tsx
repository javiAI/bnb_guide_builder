"use client";

import { useActionState } from "react";
import { createPlaybookAction, type ActionResult } from "@/lib/actions/editor.actions";
import { troubleshootingTaxonomy, getItems } from "@/lib/taxonomy-loader";

const troubleshootingTypes = getItems(troubleshootingTaxonomy);

interface CreatePlaybookFormProps {
  propertyId: string;
}

export function CreatePlaybookForm({ propertyId }: CreatePlaybookFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createPlaybookAction,
    null,
  );

  const fieldError = (field: string) =>
    state?.fieldErrors?.[field]?.[0];

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
    >
      <input type="hidden" name="propertyId" value={propertyId} />

      {state?.error && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Tipo de incidencia *</span>
          <select name="playbookKey" required className={inputClass}>
            <option value="">— Seleccionar —</option>
            {troubleshootingTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {fieldError("playbookKey") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("playbookKey")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Título *</span>
          <input name="title" type="text" required placeholder="Ej: Huésped no puede entrar" className={inputClass} />
          {fieldError("title") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("title")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Severidad</span>
          <select name="severity" defaultValue="medium" className={inputClass}>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Añadiendo…" : "Añadir playbook"}
      </button>
    </form>
  );
}
