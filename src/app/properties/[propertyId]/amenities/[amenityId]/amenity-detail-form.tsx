"use client";

import { useActionState } from "react";
import { updateAmenityAction, type ActionResult } from "@/lib/actions/editor.actions";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { visibilityLevels, getItems } from "@/lib/taxonomy-loader";
import type { SubtypeField } from "@/lib/types/taxonomy";

const visibilityOptions = getItems(visibilityLevels).filter(
  (v) => v.id !== "secret",
);

interface AmenityDetailFormProps {
  propertyId: string;
  amenity: {
    id: string;
    amenityKey: string;
    subtypeKey: string;
    guestInstructions: string;
    aiInstructions: string;
    internalNotes: string;
    troubleshootingNotes: string;
    visibility: string;
  };
  subtypeFields: SubtypeField[];
}

function SubtypeFieldInput({ field }: { field: SubtypeField }) {
  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  if (field.type === "select" && field.options) {
    return (
      <select name={`subtype_${field.id}`} defaultValue={field.default ?? ""} className={inputClass}>
        <option value="">— Seleccionar —</option>
        {field.options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
            {opt.recommended ? " ★" : ""}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="mt-1 flex items-center gap-2">
        <input
          type="checkbox"
          name={`subtype_${field.id}`}
          defaultChecked={field.default === "true"}
          className="h-4 w-4 rounded border-[var(--border)] text-[var(--color-primary-500)]"
        />
        <span className="text-sm text-[var(--foreground)]">{field.label}</span>
      </label>
    );
  }

  if (field.type === "number") {
    return (
      <input
        name={`subtype_${field.id}`}
        type="number"
        defaultValue={field.default ?? ""}
        className={inputClass}
      />
    );
  }

  return (
    <input
      name={`subtype_${field.id}`}
      type="text"
      defaultValue={field.default ?? ""}
      placeholder={field.description}
      className={inputClass}
    />
  );
}

export function AmenityDetailForm({
  propertyId,
  amenity,
  subtypeFields,
}: AmenityDetailFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateAmenityAction,
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
      <input type="hidden" name="amenityId" value={amenity.id} />
      <input type="hidden" name="propertyId" value={propertyId} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Configuración
        </h2>
        {saveStatus && <InlineSaveStatus status={saveStatus} />}
      </div>

      {state?.error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      {/* Subtype fields from taxonomy */}
      {subtypeFields.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-5">
          <h3 className="mb-3 text-sm font-medium text-[var(--foreground)]">
            Configuración específica
          </h3>
          <div className="space-y-4">
            {subtypeFields.map((field) => (
              <div key={field.id}>
                <label className="block">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {field.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--color-neutral-500)]">
                    {field.description}
                  </span>
                  <SubtypeFieldInput field={field} />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Instrucciones para el huésped
        </span>
        <span className="ml-1 text-xs text-[var(--color-neutral-500)]">(público)</span>
        <textarea
          name="guestInstructions"
          rows={3}
          defaultValue={amenity.guestInstructions}
          placeholder="Cómo usar este equipamiento…"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Instrucciones para AI
        </span>
        <span className="ml-1 text-xs text-[var(--color-neutral-500)]">(base de conocimiento)</span>
        <textarea
          name="aiInstructions"
          rows={3}
          defaultValue={amenity.aiInstructions}
          placeholder="Contexto adicional para el asistente…"
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
          rows={2}
          defaultValue={amenity.internalNotes}
          placeholder="Notas internas…"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Notas de troubleshooting
        </span>
        <span className="ml-1 text-xs text-[var(--color-neutral-500)]">(para incidencias)</span>
        <textarea
          name="troubleshootingNotes"
          rows={2}
          defaultValue={amenity.troubleshootingNotes}
          placeholder="Qué hacer si falla…"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Visibilidad
        </span>
        <select
          name="visibility"
          defaultValue={amenity.visibility}
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
  );
}
