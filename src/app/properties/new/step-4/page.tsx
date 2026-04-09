"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { saveStep4Action, type ActionResult } from "@/lib/actions/wizard.actions";
import { accessMethods, getItems } from "@/lib/taxonomy-loader";

const accessOptions: RadioCardOption[] = getItems(accessMethods).map((item) => ({
  id: item.id,
  label: item.label,
  description: item.description,
  recommended: item.recommended,
}));

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

export default function WizardStep4Page() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId") ?? "";

  const [accessMethod, setAccessMethod] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveStep4Action,
    null,
  );

  const fieldError = (field: string) =>
    state?.fieldErrors?.[field]?.[0];

  return (
    <WizardShell
      currentStep={4}
      totalSteps={4}
      title="Llegada básica"
      subtitle="Horarios de check-in, check-out y cómo acceden los huéspedes."
      backHref={`/properties/new/step-3?propertyId=${propertyId}`}
    >
      <form action={formAction} className="space-y-8">
        <input type="hidden" name="propertyId" value={propertyId} />

        {/* Check-in window */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Ventana de check-in
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-[var(--color-neutral-500)]">Desde *</span>
              <select
                name="checkInStart"
                required
                defaultValue="16:00"
                className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {fieldError("checkInStart") && (
                <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("checkInStart")}</p>
              )}
            </label>

            <label className="block">
              <span className="text-xs text-[var(--color-neutral-500)]">Hasta *</span>
              <select
                name="checkInEnd"
                required
                defaultValue="22:00"
                className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {fieldError("checkInEnd") && (
                <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("checkInEnd")}</p>
              )}
            </label>
          </div>
        </div>

        {/* Check-out */}
        <label className="block">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Hora de check-out *
          </span>
          <select
            name="checkOutTime"
            required
            defaultValue="11:00"
            className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {fieldError("checkOutTime") && (
            <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("checkOutTime")}</p>
          )}
        </label>

        {/* Access method */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Método de acceso principal
          </h2>
          <RadioCardGroup
            name="primaryAccessMethod"
            options={accessOptions}
            value={accessMethod}
            onChange={setAccessMethod}
          />
          {fieldError("primaryAccessMethod") && (
            <p className="mt-2 text-sm text-[var(--color-danger-500)]">{fieldError("primaryAccessMethod")}</p>
          )}
        </div>

        {/* Contact (optional) */}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">Teléfono de contacto</span>
            <input
              name="hostContactPhone"
              type="tel"
              placeholder="+34..."
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">Contacto de soporte</span>
            <input
              name="supportContact"
              type="text"
              placeholder="Nombre o equipo"
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-4 inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Continuar a revisión"}
        </button>
      </form>
    </WizardShell>
  );
}
