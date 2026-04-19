"use client";

import { useState, useActionState } from "react";
import { regenerateKnowledgeAction } from "@/lib/actions/knowledge.actions";
import type { ActionResult } from "@/lib/types/action-result";

export function RegenerateKnowledgeButton({ propertyId }: { propertyId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    regenerateKnowledgeAction,
    null,
  );

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="text-xs text-[var(--color-neutral-600)]">
          Esto eliminará todos los chunks auto-extraídos y los regenerará desde cero. Los items manuales no se modifican.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--color-neutral-100)]"
          >
            Cancelar
          </button>
          <form action={action}>
            <input type="hidden" name="propertyId" value={propertyId} />
            <button
              type="submit"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger-600)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-danger-700)] disabled:opacity-50"
            >
              {pending ? "Regenerando…" : "Sí, regenerar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)]"
      >
        Regenerar todo
      </button>
      {state?.error && (
        <p className="text-xs text-[var(--color-danger-600)]">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-[var(--color-success-600)]">Regenerado correctamente.</p>
      )}
    </div>
  );
}
