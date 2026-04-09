"use client";

import { useActionState } from "react";
import { createKnowledgeItemAction, type ActionResult } from "@/lib/actions/knowledge.actions";

interface CreateKnowledgeItemFormProps {
  propertyId: string;
}

export function CreateKnowledgeItemForm({ propertyId }: CreateKnowledgeItemFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createKnowledgeItemAction,
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
        <label className="block sm:col-span-2">
          <span className="text-xs text-[var(--color-neutral-500)]">Tema *</span>
          <input name="topic" type="text" required placeholder="Ej: Cómo funciona el aire acondicionado" className={inputClass} />
          {fieldError("topic") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("topic")}</p>
          )}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-[var(--color-neutral-500)]">Contenido (Markdown) *</span>
          <textarea
            name="bodyMd"
            required
            rows={4}
            placeholder="Escribe el contenido en Markdown..."
            className={inputClass}
          />
          {fieldError("bodyMd") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("bodyMd")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Visibilidad</span>
          <select name="visibility" defaultValue="public" className={inputClass}>
            <option value="public">Público</option>
            <option value="booked_guest">Huésped confirmado</option>
            <option value="internal">Interno</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Etapa del journey</span>
          <select name="journeyStage" defaultValue="" className={inputClass}>
            <option value="">— Sin etapa —</option>
            <option value="pre_booking">Pre-reserva</option>
            <option value="post_booking">Post-reserva</option>
            <option value="pre_arrival">Pre-llegada</option>
            <option value="during_stay">Durante estancia</option>
            <option value="post_stay">Post-estancia</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Añadiendo…" : "Añadir item"}
      </button>
    </form>
  );
}
