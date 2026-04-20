"use client";

import { useActionState, useState } from "react";

import {
  cancelReservationAction,
  updateReservationAction,
} from "@/lib/actions/reservation.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { Badge } from "@/components/ui/badge";

interface ReservationRowData {
  id: string;
  guestName: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  numGuests: number;
  status: string;
  source: string;
  externalId: string | null;
  locale: string | null;
  draftsCount: number;
}

interface ReservationRowProps {
  reservation: ReservationRowData;
}

const inputClass =
  "block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

export function ReservationRow({ reservation }: ReservationRowProps) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updating] = useActionState<
    ActionResult | null,
    FormData
  >(updateReservationAction, null);
  const [, cancelAction, cancelling] = useActionState<
    ActionResult | null,
    FormData
  >(cancelReservationAction, null);

  if (!editing) {
    return (
      <li className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {reservation.guestName}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
              {reservation.checkInDate} → {reservation.checkOutDate} ·{" "}
              {reservation.numGuests} huésped
              {reservation.numGuests !== 1 ? "es" : ""}
              {reservation.locale ? ` · ${reservation.locale}` : ""}
              {reservation.source !== "manual"
                ? ` · ${reservation.source}${reservation.externalId ? ` #${reservation.externalId}` : ""}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              label={`${reservation.draftsCount} draft${reservation.draftsCount === 1 ? "" : "s"}`}
              tone={reservation.draftsCount > 0 ? "success" : "neutral"}
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]"
            >
              Editar
            </button>
            <form action={cancelAction}>
              <input type="hidden" name="reservationId" value={reservation.id} />
              <button
                type="submit"
                disabled={cancelling}
                className="rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      </li>
    );
  }

  const fieldError = (field: string) =>
    updateState?.fieldErrors?.[field]?.[0];

  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--color-primary-300)] bg-[var(--surface-elevated)] p-3">
      <form action={updateAction} className="space-y-3">
        <input type="hidden" name="reservationId" value={reservation.id} />

        {updateState?.error && (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-2 text-xs text-[var(--color-danger-700)]">
            {updateState.error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-neutral-500)]">
              Nombre
            </span>
            <input
              name="guestName"
              type="text"
              defaultValue={reservation.guestName}
              className={inputClass}
            />
            {fieldError("guestName") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">
                {fieldError("guestName")}
              </p>
            )}
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-neutral-500)]">
              Check-in
            </span>
            <input
              name="checkInDate"
              type="date"
              defaultValue={reservation.checkInDate}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-neutral-500)]">
              Check-out
            </span>
            <input
              name="checkOutDate"
              type="date"
              defaultValue={reservation.checkOutDate}
              className={inputClass}
            />
            {fieldError("checkOutDate") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">
                {fieldError("checkOutDate")}
              </p>
            )}
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-neutral-500)]">
              Huéspedes
            </span>
            <input
              name="numGuests"
              type="number"
              min={1}
              defaultValue={reservation.numGuests}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-neutral-500)]">
              Idioma
            </span>
            <input
              name="locale"
              type="text"
              defaultValue={reservation.locale ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={updating}
            className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-50"
          >
            {updating ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]"
          >
            Cancelar
          </button>
        </div>
      </form>
    </li>
  );
}
