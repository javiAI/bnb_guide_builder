"use client";

import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { deletePropertyAction } from "@/lib/actions/editor.actions";

export function DeletePropertyButton({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  return (
    <DeleteConfirmationButton
      title="Eliminar propiedad"
      description={`Se eliminará ${propertyName} y todos sus datos asociados (espacios, amenities, guías, mensajes, etc.). Esta acción no se puede deshacer.`}
      entityId={propertyId}
      fieldName="propertyId"
      action={deletePropertyAction as (prev: { success: boolean } | null, formData: FormData) => Promise<{ success: boolean }>}
      requireConfirmText="eliminar"
    />
  );
}
