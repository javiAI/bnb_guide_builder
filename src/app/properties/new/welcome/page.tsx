"use client";

import { useActionState } from "react";
import { createDraftAction, type ActionResult } from "@/lib/actions/wizard.actions";

export default function WizardWelcomePage() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createDraftAction,
    null,
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Nuevo alojamiento
      </h1>
      <p className="mt-3 text-sm text-[var(--color-neutral-500)]">
        Configura los datos mínimos de tu propiedad en 4 pasos rápidos.
        Podrás completar el resto desde el workspace.
      </p>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Lo que vamos a configurar:
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--color-neutral-600)]">
          <li className="flex gap-2">
            <span className="text-[var(--color-primary-500)]">1.</span>
            Tipo de alojamiento y espacio
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--color-primary-500)]">2.</span>
            Ubicación y zona horaria
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--color-primary-500)]">3.</span>
            Capacidad y estructura
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--color-primary-500)]">4.</span>
            Horarios de llegada y método de acceso
          </li>
        </ul>
      </div>

      <form action={formAction} className="mt-8">
        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Nombre de la propiedad
          </span>
          <input
            name="propertyNickname"
            type="text"
            required
            placeholder="ej. Apartamento Alcalá Centro"
            className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]"
          />
        </label>

        {state?.error && (
          <p className="mt-2 text-sm text-[var(--color-danger-500)]">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
        >
          {pending ? "Creando…" : "Empezar"}
        </button>
      </form>
    </div>
  );
}
