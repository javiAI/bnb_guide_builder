"use client";

import { useActionState } from "react";
import { createGuideVersionAction, type ActionResult } from "@/lib/actions/knowledge.actions";

interface CreateGuideVersionButtonProps {
  propertyId: string;
}

export function CreateGuideVersionButton({ propertyId }: CreateGuideVersionButtonProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createGuideVersionAction,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="propertyId" value={propertyId} />
      {state?.error && (
        <p className="mb-2 text-xs text-[var(--color-danger-500)]">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear nueva versión"}
      </button>
    </form>
  );
}
