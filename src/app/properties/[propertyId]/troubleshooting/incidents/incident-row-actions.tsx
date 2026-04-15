"use client";

import { useTransition } from "react";
import {
  resolveIncidentAction,
  deleteIncidentAction,
} from "@/lib/actions/incident.actions";

interface IncidentRowActionsProps {
  incidentId: string;
  canResolve: boolean;
}

export function IncidentRowActions({ incidentId, canResolve }: IncidentRowActionsProps) {
  const [pending, startTransition] = useTransition();

  function handle(action: (prev: null, fd: FormData) => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    const fd = new FormData();
    fd.set("incidentId", incidentId);
    startTransition(() => {
      action(null, fd);
    });
  }

  return (
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
  );
}
