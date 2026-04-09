"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createUsableAction, type ActionResult } from "@/lib/actions/wizard.actions";

interface ReviewActionsProps {
  propertyId: string;
  allComplete: boolean;
}

export function ReviewActions({ propertyId, allComplete }: ReviewActionsProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createUsableAction,
    null,
  );

  return (
    <div className="mt-8">
      {state?.error && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="propertyId" value={propertyId} />
        <button
          type="submit"
          disabled={pending || !allComplete}
          className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
        >
          {pending ? "Creando propiedad…" : "Crear propiedad"}
        </button>
      </form>

      {!allComplete && (
        <p className="mt-3 text-center text-xs text-[var(--color-warning-700)]">
          Completa todos los pasos antes de crear la propiedad.
        </p>
      )}

      <Link
        href="/"
        className="mt-4 block text-center text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
      >
        Guardar como borrador y salir
      </Link>
    </div>
  );
}
