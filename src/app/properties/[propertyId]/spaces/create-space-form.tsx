"use client";

import { useActionState } from "react";
import { createSpaceAction, type ActionResult } from "@/lib/actions/editor.actions";

interface SpaceTypeOption {
  id: string;
  label: string;
  recommended: boolean;
}

interface CreateSpaceFormProps {
  propertyId: string;
  availableTypeOptions: SpaceTypeOption[];
}

export function CreateSpaceForm({ propertyId, availableTypeOptions }: CreateSpaceFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createSpaceAction,
    null,
  );

  const fieldError = (field: string) =>
    state?.fieldErrors?.[field]?.[0];

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
          <span className="text-xs text-[var(--color-neutral-500)]">Tipo de espacio *</span>
          <select
            name="spaceType"
            required
            className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
          >
            <option value="">— Seleccionar —</option>
            {availableTypeOptions.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
                {st.recommended ? " ★" : ""}
              </option>
            ))}
          </select>
          {fieldError("spaceType") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("spaceType")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Nombre *</span>
          <input
            name="name"
            type="text"
            required
            placeholder="Ej: Dormitorio principal"
            className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
          />
          {fieldError("name") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("name")}</p>
          )}
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs text-[var(--color-neutral-500)]">Notas para el huésped</span>
        <textarea
          name="guestNotes"
          rows={2}
          placeholder="Información útil para el huésped sobre este espacio…"
          className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Añadiendo…" : "Añadir espacio"}
      </button>
    </form>
  );
}
