"use client";

import { useActionState } from "react";
import { createSpaceAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";

interface SpaceTypeOption {
  id: string;
  label: string;
  recommended: boolean;
}

interface CreateSpaceFormProps {
  propertyId: string;
  availableTypeOptions: SpaceTypeOption[];
}

const fieldCls =
  "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-focus)] focus:outline-none";

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
      className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5"
    >
      <input type="hidden" name="propertyId" value={propertyId} />

      {state?.error && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-status-error-bg)] p-3 text-sm text-[var(--color-status-error-text)]">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">Tipo de espacio *</span>
          <select
            name="spaceType"
            required
            className={fieldCls}
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
            <p className="mt-1 text-xs text-[var(--color-status-error-text)]">{fieldError("spaceType")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">Nombre *</span>
          <input
            name="name"
            type="text"
            required
            placeholder="Ej: Dormitorio principal"
            className={fieldCls}
          />
          {fieldError("name") && (
            <p className="mt-1 text-xs text-[var(--color-status-error-text)]">{fieldError("name")}</p>
          )}
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs text-[var(--color-text-secondary)]">Notas para el huésped</span>
        <textarea
          name="guestNotes"
          rows={2}
          placeholder="Información útil para el huésped sobre este espacio…"
          className={fieldCls}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-5 py-2 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
      >
        {pending ? "Añadiendo…" : "Añadir espacio"}
      </button>
    </form>
  );
}
