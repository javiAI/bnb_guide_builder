"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createSystemAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";

interface Props {
  propertyId: string;
  systemKey: string;
  /** Visible label of the system, used for the accessible button name. */
  label: string;
}

/**
 * Per-recommended-row quick add (Q6). A single-system form bound to
 * createSystemAction — on success the server revalidates the systems path and
 * the row moves out of "Por configurar". No new server action, no schema change.
 */
export function AddSystemButton({ propertyId, systemKey, label }: Props) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    createSystemAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="systemKey" value={systemKey} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Añadir ${label}`}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3.5 text-[13px] font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50"
      >
        <Plus size={14} aria-hidden="true" />
        {pending ? "Añadiendo…" : "Añadir"}
      </button>
      {result && !result.success && result.error && (
        <p className="text-[11px] text-[var(--color-status-error-text)]">{result.error}</p>
      )}
    </form>
  );
}
