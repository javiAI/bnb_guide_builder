"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { createSystemAction } from "@/lib/actions/editor.actions";
import { getSystemGroups } from "@/lib/taxonomies/systems";
import type { ActionResult } from "@/lib/types/action-result";

interface Props {
  propertyId: string;
  existingKeys: string[];
}

/**
 * Fallback "add system" affordance (Q6): a collapsed <details> holding the full
 * grouped selector. The primary discovery path is the per-row quick-add in the
 * "Por configurar" section; this covers every other (incl. non-recommended)
 * system without crowding the page.
 */
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
      // `managedInProperty` systems (e.g. sys.elevator) are toggled from the
      // Property editor — never "added" here. Their detail fields stay editable
      // once the row exists (it shows as an installed system, not in this picker).
      items: g.items.filter((i) => !existingKeys.includes(i.id) && !i.managedInProperty),
    }))
    .filter((g) => g.items.length > 0);

  if (available.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-4 py-3">
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          Todos los sistemas disponibles ya están configurados.
        </p>
      </div>
    );
  }

  return (
    <details className="group rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)]">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-3 text-[14px] font-semibold text-[var(--color-text-primary)] [&::-webkit-details-marker]:hidden">
        <Plus size={15} aria-hidden="true" className="text-[var(--color-text-secondary)]" />
        Añadir otro sistema
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="ml-auto text-[var(--color-text-muted)] transition-transform group-open:rotate-180"
        />
      </summary>

      <form action={action} className="flex flex-col gap-4 border-t border-[var(--color-border-subtle)] px-4 py-4">
        <input type="hidden" name="propertyId" value={propertyId} />

        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
            Tipo de sistema
          </span>
          <select
            name="systemKey"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Tipo de sistema"
            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
            required
          >
            <option value="">Selecciona un sistema…</option>
            {available.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.recommended ? " (recomendado)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {result?.fieldErrors?.systemKey && (
            <span className="text-[12px] text-[var(--color-status-error-text)]">
              {result.fieldErrors.systemKey[0]}
            </span>
          )}
        </label>

        <button
          type="submit"
          disabled={pending || !selected}
          className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 text-[14px] font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50"
        >
          <Plus size={15} aria-hidden="true" />
          {pending ? "Añadiendo…" : "Añadir sistema"}
        </button>

        {result && !result.success && result.error && (
          <p className="text-[12px] text-[var(--color-status-error-text)]">{result.error}</p>
        )}
      </form>
    </details>
  );
}
