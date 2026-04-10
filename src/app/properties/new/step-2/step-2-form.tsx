"use client";

import { useActionState, useState } from "react";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { saveStep2Action, type ActionResult } from "@/lib/actions/wizard.actions";
import { spanishProvinces, getItems } from "@/lib/taxonomy-loader";
import { inferProvince } from "@/lib/province-utils";
import type { StepFormProps } from "@/lib/types/wizard";

const COMMON_TIMEZONES = [
  { value: "Europe/Madrid", label: "España peninsular (Europe/Madrid)" },
  { value: "Atlantic/Canary", label: "Canarias (Atlantic/Canary)" },
  { value: "Europe/Lisbon", label: "Portugal (Europe/Lisbon)" },
  { value: "Europe/Paris", label: "Francia (Europe/Paris)" },
  { value: "Europe/Rome", label: "Italia (Europe/Rome)" },
  { value: "Europe/London", label: "Reino Unido (Europe/London)" },
  { value: "America/Mexico_City", label: "México (America/Mexico_City)" },
  { value: "America/Bogota", label: "Colombia (America/Bogota)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (America/Buenos_Aires)" },
  { value: "America/Santiago", label: "Chile (America/Santiago)" },
];

const provinces = getItems(spanishProvinces);

type Step2FormProps = StepFormProps;

export function Step2Form({ sessionId, initialState, maxStepReached, snapshot, snapshotStep }: Step2FormProps) {
  const [country, setCountry] = useState((initialState.country as string) ?? "España");
  const [city, setCity] = useState((initialState.city as string) ?? "");
  const [province, setProvince] = useState((initialState.region as string) ?? "");
  const [timezone, setTimezone] = useState((initialState.timezone as string) ?? "Europe/Madrid");

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveStep2Action,
    null,
  );

  const fieldError = (field: string) => state?.fieldErrors?.[field]?.[0];
  const canContinue = country.trim().length > 0 && city.trim().length > 0 && timezone.length > 0;

  function handleCityBlur() {
    if (city && !province) {
      const inferred = inferProvince(city);
      if (inferred) setProvince(inferred);
    }
  }

  return (
    <WizardShell
      currentStep={2}
      totalSteps={4}
      title="Ubicación"
      subtitle="¿Dónde está la propiedad? Solo necesitamos lo mínimo para empezar."
      backHref={`/properties/new/step-1?sessionId=${sessionId}`}
      sessionId={sessionId}
      maxStepReached={maxStepReached}
      snapshot={snapshot}
      snapshotStep={snapshotStep}
    >
      <form action={formAction} data-wizard-form className="space-y-5">
        <input type="hidden" name="sessionId" value={sessionId} />

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">País *</span>
            <input name="country" type="text" required value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]" />
            {fieldError("country") && <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("country")}</p>}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">Ciudad *</span>
            <input name="city" type="text" required value={city} onChange={(e) => setCity(e.target.value)} onBlur={handleCityBlur} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]" />
            {fieldError("city") && <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("city")}</p>}
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">Provincia</span>
            <select name="region" value={province} onChange={(e) => setProvince(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]">
              <option value="">Seleccionar provincia</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">Código postal</span>
            <input name="postalCode" type="text" defaultValue={(initialState.postalCode as string) ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]" />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">Dirección</span>
          <input name="streetAddress" type="text" defaultValue={(initialState.streetAddress as string) ?? ""} placeholder="Calle, número, piso (opcional ahora)" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]" />
        </label>
        <input type="hidden" name="addressLevel" value="exact" />

        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">Zona horaria *</span>
          <select name="timezone" required value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]">
            {COMMON_TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
          {fieldError("timezone") && <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("timezone")}</p>}
        </label>

        <button type="submit" disabled={pending || !canContinue} className="mt-4 inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50">
          {pending ? "Guardando…" : "Continuar"}
        </button>
      </form>
    </WizardShell>
  );
}
