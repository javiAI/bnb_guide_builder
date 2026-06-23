"use client";

import { useActionState, useState, useTransition } from "react";
import { createSystemAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { AddEntityChips, type AddEntityChipGroup } from "@/components/ui/add-entity-chips";

/**
 * One-click system creation over the shared AddEntityChips (mirror of
 * AddSpaceChips): pick a type chip and the system is added at once keyed by its
 * `systemKey` (PropertySystem has no name column — nothing to auto-derive).
 * Complete it afterwards from its detail card. The server page precomputes the
 * groups (Recomendados first, then one per taxonomy group), excluding already
 * installed and property-managed systems.
 */
export function AddSystemChips({
  propertyId,
  groups,
}: {
  propertyId: string;
  groups: AddEntityChipGroup[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createSystemAction,
    null,
  );
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function add(systemKey: string) {
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    fd.append("systemKey", systemKey);
    setPendingId(systemKey);
    startTransition(() => formAction(fd));
  }

  const hasOptions = groups.some((g) => g.items.length > 0);
  if (!hasOptions) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Todo el catálogo de sistemas ya está configurado.
      </p>
    );
  }

  return (
    <AddEntityChips
      hint="Elige un tipo y se añade al momento — complétalo después desde su ficha."
      groups={groups}
      onAdd={add}
      busy={isPending}
      pendingId={pendingId}
      error={
        state?.error ??
        (state?.fieldErrors
          ? (Object.values(state.fieldErrors).flat()[0] ?? "No se pudo añadir el sistema.")
          : null)
      }
    />
  );
}
