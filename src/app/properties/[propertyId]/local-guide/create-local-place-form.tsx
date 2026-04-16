"use client";

import { useActionState } from "react";
import { createLocalPlaceAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";

const CATEGORIES = [
  { value: "restaurant", label: "Restaurante" },
  { value: "cafe", label: "Cafetería" },
  { value: "bar", label: "Bar" },
  { value: "supermarket", label: "Supermercado" },
  { value: "pharmacy", label: "Farmacia" },
  { value: "hospital", label: "Hospital" },
  { value: "transport", label: "Transporte" },
  { value: "parking", label: "Parking" },
  { value: "attraction", label: "Atracción" },
  { value: "beach", label: "Playa" },
  { value: "park", label: "Parque" },
  { value: "gym", label: "Gimnasio" },
  { value: "laundry", label: "Lavandería" },
  { value: "other", label: "Otro" },
];

interface CreateLocalPlaceFormProps {
  propertyId: string;
}

export function CreateLocalPlaceForm({ propertyId }: CreateLocalPlaceFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createLocalPlaceAction,
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
          <span className="text-xs text-[var(--color-neutral-500)]">Categoría *</span>
          <select name="categoryKey" required className={inputClass}>
            <option value="">— Seleccionar —</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {fieldError("categoryKey") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("categoryKey")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Nombre *</span>
          <input name="name" type="text" required placeholder="Ej: Bar El Rincón" className={inputClass} />
          {fieldError("name") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("name")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Nota rápida</span>
          <input name="shortNote" type="text" placeholder="Ej: Mejor paella de la zona" className={inputClass} />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Distancia (metros)</span>
          <input name="distanceMeters" type="number" min="0" placeholder="200" className={inputClass} />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Añadiendo…" : "Añadir lugar"}
      </button>
    </form>
  );
}
