"use client";

import { useActionState } from "react";
import { createMediaAssetAction, type ActionResult } from "@/lib/actions/editor.actions";
import { mediaAssetRoles, getItems, visibilityLevels } from "@/lib/taxonomy-loader";

const roles = getItems(mediaAssetRoles);
const visibilityOptions = getItems(visibilityLevels).filter(
  (v) => v.id !== "secret",
);

interface CreateMediaFormProps {
  propertyId: string;
}

export function CreateMediaForm({ propertyId }: CreateMediaFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createMediaAssetAction,
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
          <span className="text-xs text-[var(--color-neutral-500)]">Rol del asset *</span>
          <select name="assetRoleKey" required className={inputClass}>
            <option value="">— Seleccionar —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          {fieldError("assetRoleKey") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("assetRoleKey")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Tipo de media *</span>
          <select name="mediaType" required className={inputClass}>
            <option value="">— Seleccionar —</option>
            <option value="photo">Foto</option>
            <option value="video">Vídeo</option>
          </select>
          {fieldError("mediaType") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("mediaType")}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Caption</span>
          <input name="caption" type="text" placeholder="Descripción del asset" className={inputClass} />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Visibilidad</span>
          <select name="visibility" defaultValue="public" className={inputClass}>
            {visibilityOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-[var(--color-neutral-500)]">
        El archivo se sube después de registrar el asset. El flujo completo de upload se implementa en fases posteriores.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Registrando…" : "Registrar asset"}
      </button>
    </form>
  );
}
