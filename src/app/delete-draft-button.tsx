"use client";

import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { deleteDraftAction } from "@/lib/actions/wizard.actions";

export function DeleteDraftButton({ sessionId, sessionName }: { sessionId: string; sessionName: string }) {
  return (
    <DeleteConfirmationButton
      title="Eliminar borrador"
      description={`Se eliminará el borrador ${sessionName} y todo su progreso. Esta acción no se puede deshacer.`}
      entityId={sessionId}
      fieldName="sessionId"
      action={deleteDraftAction}
    />
  );
}
