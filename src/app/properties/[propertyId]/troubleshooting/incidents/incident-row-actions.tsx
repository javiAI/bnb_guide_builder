"use client";

import { useState, useTransition } from "react";
import {
  resolveIncidentAction,
  deleteIncidentAction,
} from "@/lib/actions/incident.actions";
import type { ActionResult } from "@/lib/types/action-result";

interface IncidentRowActionsProps {
  incidentId: string;
  canResolve: boolean;
}

export function IncidentRowActions({ incidentId, canResolve }: IncidentRowActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(
    action: (prev: null, fd: FormData) => Promise<ActionResult>,
    confirmMsg?: string,
  ) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    const fd = new FormData();
    fd.set("incidentId", incidentId);
    setError(null);
    startTransition(async () => {
      const result = await action(null, fd);
      if (!result.success) setError(result.error ?? "Error");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && (
        <span className="text-xs text-[var(--color-status-error-text)]">{error}</span>
      )}
      <div className="flex gap-2">
      {canResolve && (
        <button
          type="button"
          disabled={pending}
          onClick={() => handle(resolveIncidentAction)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
        >
          Marcar resuelta
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          handle(deleteIncidentAction, "¿Eliminar esta ocurrencia? No se puede deshacer.")
        }
        className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-status-error-border)] px-3 py-1 text-xs text-[var(--color-status-error-text)] hover:bg-[var(--color-status-error-bg)] disabled:opacity-50"
      >
        Eliminar
      </button>
      </div>
    </div>
  );
}
