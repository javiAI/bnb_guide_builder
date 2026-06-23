"use client";

import { useActionState, useState, useTransition } from "react";
import { createContactAction } from "@/lib/actions/editor.actions";
import { firstActionError, type ActionResult } from "@/lib/types/action-result";
import { AddEntityChips, type AddEntityChipGroup } from "@/components/ui/add-entity-chips";

/**
 * One-click contact creation over the shared AddEntityChips: pick a type chip
 * and the contact is added at once with a server-derived name ("Fontanero 2")
 * and the taxonomy's default entityType/visibility. Phone, email and the rest
 * are filled in on its card.
 */
export function AddContactChips({
  propertyId,
  groups,
}: {
  propertyId: string;
  groups: AddEntityChipGroup[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createContactAction,
    null,
  );
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function add(roleKey: string) {
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    fd.append("roleKey", roleKey);
    setPendingId(roleKey);
    startTransition(() => formAction(fd));
  }

  return (
    <AddEntityChips
      hint="Elige un tipo y se añade al momento — el teléfono y los datos se rellenan en su tarjeta."
      groups={groups}
      onAdd={add}
      busy={isPending}
      pendingId={pendingId}
      error={firstActionError(state, "No se pudo añadir el contacto.")}
    />
  );
}
