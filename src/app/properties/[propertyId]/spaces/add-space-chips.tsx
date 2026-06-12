"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { createSpaceAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";

export interface AddSpaceOption {
  id: string;
  label: string;
  /** Required by the room type and not added yet — surfaced first. */
  missingRequired: boolean;
  recommended: boolean;
}

/**
 * One-click space creation: pick a type chip and the space is added at once
 * with an auto-derived name ("Dormitorio 2") — no form, no dropdown, matching
 * the editor's single chips language. Rename and complete it on its card.
 */
export function AddSpaceChips({
  propertyId,
  options,
}: {
  propertyId: string;
  options: AddSpaceOption[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createSpaceAction,
    null,
  );
  const [, startTransition] = useTransition();
  // Which chip fired — only for the spinner; disabling rides on isPending.
  const [pendingType, setPendingType] = useState<string | null>(null);

  function add(typeId: string) {
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    fd.append("spaceType", typeId);
    setPendingType(typeId);
    startTransition(() => formAction(fd));
  }

  const groups: { label: string | null; items: AddSpaceOption[] }[] = [
    { label: "Obligatorios", items: options.filter((o) => o.missingRequired) },
    { label: "Recomendados", items: options.filter((o) => !o.missingRequired && o.recommended) },
    { label: "Otros", items: options.filter((o) => !o.missingRequired && !o.recommended) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Elige un tipo y se añade al momento — el nombre se puede editar después en su tarjeta.
      </p>
      {groups.map((group) => (
        <div key={group.label}>
          {groups.length > 1 && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {group.label}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {group.items.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => add(opt.id)}
                disabled={isPending}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-[var(--color-border-strong)] bg-transparent px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
              >
                {isPending && pendingType === opt.id ? (
                  <Loader2 size={14} aria-hidden="true" className="animate-spin" />
                ) : (
                  <Plus size={14} aria-hidden="true" />
                )}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {(state?.error || state?.fieldErrors) && (
        <p className="text-xs text-[var(--color-status-error-text)]">
          {state.error ?? Object.values(state.fieldErrors ?? {}).flat()[0] ?? "No se pudo añadir el espacio."}
        </p>
      )}
    </div>
  );
}
