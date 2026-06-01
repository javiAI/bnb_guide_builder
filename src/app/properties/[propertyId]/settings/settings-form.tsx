"use client";

import { useActionState, useRef } from "react";
import { saveSettingsAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { useFormAutoSave } from "@/lib/use-form-auto-save";

interface SettingsFormProps {
  propertyId: string;
  currentNickname: string;
  currentTimezone: string | null;
  currentStatus: string;
}

const TIMEZONE_OPTIONS = [
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Lisbon",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Bogota",
  "America/Buenos_Aires",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
];

export function SettingsForm({
  propertyId,
  currentNickname,
  currentTimezone,
  currentStatus,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveSettingsAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(formRef);

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  return (
    <form
      ref={formRef}
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
          <span className="text-xs text-[var(--color-neutral-500)]">Nombre de la propiedad</span>
          <input
            name="propertyNickname"
            type="text"
            defaultValue={currentNickname}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Zona horaria</span>
          <select name="timezone" defaultValue={currentTimezone ?? "Europe/Madrid"} className={inputClass}>
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-neutral-500)]">Estado</span>
          <select name="status" defaultValue={currentStatus} className={inputClass}>
            <option value="draft">Borrador</option>
            <option value="active">Activa</option>
            <option value="archived">Archivada</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <AutoSaveStatus pending={pending} />
      </div>
    </form>
  );
}
