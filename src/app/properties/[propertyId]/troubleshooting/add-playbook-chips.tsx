"use client";

import { useActionState, useState, useTransition } from "react";
import { createPlaybookAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { AddEntityChips } from "@/components/ui/add-entity-chips";

export interface AddPlaybookOption {
  id: string;
  label: string;
  recommended: boolean;
}

/**
 * One-click playbook creation over the shared AddEntityChips: pick a problem
 * type and the solution is added at once — title and severity derive
 * server-side from the taxonomy (label + `severity_default`). Every type stays
 * visible (duplicates allowed, like Spaces); the content is completed on the
 * new card.
 */
export function AddPlaybookChips({
  propertyId,
  options,
}: {
  propertyId: string;
  options: AddPlaybookOption[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createPlaybookAction,
    null,
  );
  const [, startTransition] = useTransition();
  const [pendingType, setPendingType] = useState<string | null>(null);

  function add(typeId: string) {
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    fd.append("playbookKey", typeId);
    setPendingType(typeId);
    startTransition(() => formAction(fd));
  }

  return (
    <AddEntityChips
      hint="Elige un tipo de problema y la solución se crea al momento — el contenido se completa en su tarjeta."
      groups={[
        { label: "Recomendados", items: options.filter((o) => o.recommended) },
        { label: "Otros", items: options.filter((o) => !o.recommended) },
      ]}
      onAdd={add}
      busy={isPending}
      pendingId={pendingType}
      error={
        state?.error ??
        (state?.fieldErrors
          ? (Object.values(state.fieldErrors).flat()[0] ?? "No se pudo añadir la solución.")
          : null)
      }
    />
  );
}
