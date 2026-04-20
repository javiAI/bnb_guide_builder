"use client";

import { useActionState } from "react";

import { createReservationAction } from "@/lib/actions/reservation.actions";
import type { ActionResult } from "@/lib/types/action-result";

interface ReservationFormProps {
  propertyId: string;
}

const inputClass =
  "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

export function ReservationForm({ propertyId }: ReservationFormProps) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(createReservationAction, null);

  const fieldError = (field: string) => state?.fieldErrors?.[field]?.[0];

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
    >
      <input type="hidden" name="propertyId" value={propertyId} />

      {state?.error && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-[var(--color-neutral-500)]">
            Nombre del huésped
          </span>
          <input
            name="guestName"
            type="text"
            className={inputClass}
            placeholder="Ej: Ana García"
            required
          />
          {fieldError("guestName") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">
              {fieldError("guestName")}
            </p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">
            Check-in
          </span>
          <input
            name="checkInDate"
            type="date"
            className={inputClass}
            required
          />
          {fieldError("checkInDate") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">
              {fieldError("checkInDate")}
            </p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">
            Check-out
          </span>
          <input
            name="checkOutDate"
            type="date"
            className={inputClass}
            required
          />
          {fieldError("checkOutDate") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">
              {fieldError("checkOutDate")}
            </p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">
            Número de huéspedes
          </span>
          <input
            name="numGuests"
            type="number"
            min={1}
            defaultValue={2}
            className={inputClass}
            required
          />
          {fieldError("numGuests") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">
              {fieldError("numGuests")}
            </p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">
            Idioma (opcional)
          </span>
          <input
            name="locale"
            type="text"
            placeholder="es, en, fr…"
            className={inputClass}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear reserva"}
      </button>
    </form>
  );
}
