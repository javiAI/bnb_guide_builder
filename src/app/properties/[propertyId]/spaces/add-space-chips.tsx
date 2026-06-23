"use client";

import { useActionState, useState, useTransition } from "react";
import { createSpaceAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { AddEntityChips } from "@/components/ui/add-entity-chips";

export interface AddSpaceOption {
  id: string;
  label: string;
  /** Required by the room type and not added yet — surfaced first. */
  missingRequired: boolean;
  recommended: boolean;
}

/**
 * One-click space creation over the shared AddEntityChips: pick a type chip
 * and the space is added at once with an auto-derived name ("Dormitorio 2").
 * Rename and complete it on its card.
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
  const [pendingType, setPendingType] = useState<string | null>(null);

  function add(typeId: string) {
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    fd.append("spaceType", typeId);
    setPendingType(typeId);
    startTransition(() => formAction(fd));
  }

  return (
    <AddEntityChips
      hint="Elige un tipo y se añade al momento — el nombre se puede editar después en su tarjeta."
      groups={[
        { label: "Obligatorios", items: options.filter((o) => o.missingRequired) },
        { label: "Recomendados", items: options.filter((o) => !o.missingRequired && o.recommended) },
        { label: "Otros", items: options.filter((o) => !o.missingRequired && !o.recommended) },
      ]}
      onAdd={add}
      busy={isPending}
      pendingId={pendingType}
      error={
        state?.error ??
        (state?.fieldErrors ? (Object.values(state.fieldErrors).flat()[0] ?? "No se pudo añadir el espacio.") : null)
      }
    />
  );
}
