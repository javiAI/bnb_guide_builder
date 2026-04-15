"use client";

import { useState, useTransition } from "react";
import {
  resolveIncidentAction,
  deleteIncidentAction,
  type ActionResult,
} from "@/lib/actions/incident.actions";

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
        <span className="text-xs text-[var(--color-danger-700)]">{error}</span>
      )}
      <div className="flex gap-2">
      {canResolve && (
        <button
          type="button"
          disabled={pending}
          onClick={() => handle(resolveIncidentAction)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
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
        className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] px-3 py-1 text-xs text-[var(--color-danger-700)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
      >
        Eliminar
      </button>
      </div>
    </div>
  );
}
