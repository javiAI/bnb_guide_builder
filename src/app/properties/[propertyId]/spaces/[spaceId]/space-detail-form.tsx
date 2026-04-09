"use client";

import { useActionState } from "react";
import { updateSpaceAction, deleteSpaceAction, type ActionResult } from "@/lib/actions/editor.actions";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { visibilityLevels, getItems } from "@/lib/taxonomy-loader";

const visibilityOptions = getItems(visibilityLevels).filter(
  (v) => v.id !== "secret",
);

interface SpaceDetailFormProps {
  propertyId: string;
  space: {
    id: string;
    name: string;
    guestNotes: string;
    aiNotes: string;
    internalNotes: string;
    visibility: string;
  };
}

export function SpaceDetailForm({ propertyId, space }: SpaceDetailFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateSpaceAction,
    null,
  );

  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteSpaceAction,
    null,
  );

  const fieldError = (field: string) =>
    state?.fieldErrors?.[field]?.[0];

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
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="spaceId" value={space.id} />
        <input type="hidden" name="propertyId" value={propertyId} />

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Detalles
          </h2>
          {saveStatus && <InlineSaveStatus status={saveStatus} />}
        </div>

        {state?.error && (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
            {state.error}
          </p>
        )}

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Nombre *
          </span>
          <input
            name="name"
            type="text"
            required
            defaultValue={space.name}
            className={inputClass}
          />
          {fieldError("name") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("name")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Notas para el huésped
          </span>
          <span className="ml-1 text-xs text-[var(--color-neutral-500)]">(público)</span>
          <textarea
            name="guestNotes"
            rows={3}
            defaultValue={space.guestNotes}
            placeholder="Información útil para el huésped…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Notas para AI
          </span>
          <span className="ml-1 text-xs text-[var(--color-neutral-500)]">(base de conocimiento)</span>
          <textarea
            name="aiNotes"
            rows={3}
            defaultValue={space.aiNotes}
            placeholder="Contexto adicional para el asistente AI…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Notas internas
          </span>
          <span className="ml-1 text-xs text-[var(--color-neutral-500)]">(solo operador)</span>
          <textarea
            name="internalNotes"
            rows={3}
            defaultValue={space.internalNotes}
            placeholder="Notas internas de operación…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Visibilidad
          </span>
          <select
            name="visibility"
            defaultValue={space.visibility}
            className={inputClass}
          >
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

      {/* Delete */}
      <div className="border-t border-[var(--border)] pt-6">
        <h3 className="text-sm font-semibold text-[var(--color-danger-700)]">
          Zona de peligro
        </h3>
        <form action={deleteAction} className="mt-3">
          <input type="hidden" name="spaceId" value={space.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          {deleteState?.error && (
            <p className="mb-2 text-sm text-[var(--color-danger-500)]">{deleteState.error}</p>
          )}
          <button
            type="submit"
            disabled={deletePending}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-danger-300)] px-4 py-2 text-sm font-medium text-[var(--color-danger-700)] transition-colors hover:bg-[var(--color-danger-50)] disabled:opacity-50"
          >
            {deletePending ? "Eliminando…" : "Eliminar espacio"}
          </button>
        </form>
      </div>
    </div>
  );
}
