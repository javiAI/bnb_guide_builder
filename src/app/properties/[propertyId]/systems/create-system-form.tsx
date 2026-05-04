"use client";

import { useActionState, useState } from "react";
import { createSystemAction } from "@/lib/actions/editor.actions";
import { getSystemGroups } from "@/lib/taxonomy-loader";
import type { ActionResult } from "@/lib/types/action-result";

interface Props {
  propertyId: string;
  existingKeys: string[];
}

export function CreateSystemForm({ propertyId, existingKeys }: Props) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    createSystemAction,
    null,
  );
  const [selected, setSelected] = useState("");

  const groups = getSystemGroups();
  const available = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !existingKeys.includes(i.id)),
    }))
    .filter((g) => g.items.length > 0);

  if (available.length === 0) {
    return (
      <p className="text-sm text-[var(--color-neutral-500)]">
        Todos los sistemas disponibles ya están configurados.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="propertyId" value={propertyId} />

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Tipo de sistema
        </label>
        <select
          name="systemKey"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
          required
        >
          <option value="">Selecciona un sistema…</option>
          {available.map((g) => (
            <optgroup key={g.id} label={g.label}>
              {g.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}{item.recommended ? " ★" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {result?.fieldErrors?.systemKey && (
          <p className="mt-1 text-xs text-[var(--color-status-error-icon)]">{result.fieldErrors.systemKey[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || !selected}
        className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-50 transition-colors"
      >
        {pending ? "Añadiendo…" : "Añadir sistema"}
      </button>

      {result && !result.success && result.error && (
        <p className="text-xs text-[var(--color-status-error-icon)]">{result.error}</p>
      )}
    </form>
  );
}
