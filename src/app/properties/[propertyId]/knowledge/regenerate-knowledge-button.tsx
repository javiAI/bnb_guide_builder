"use client";

import { useActionState } from "react";
import { regenerateKnowledgeAction } from "@/lib/actions/knowledge.actions";
import type { ActionResult } from "@/lib/types/action-result";

export function RegenerateKnowledgeButton({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    regenerateKnowledgeAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="propertyId" value={propertyId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Regenerando…" : "Regenerar todo"}
      </button>
      {state?.error && (
        <p className="text-xs text-[var(--color-danger-600)]">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-[var(--color-success-600)]">Regenerado correctamente.</p>
      )}
    </form>
  );
}
