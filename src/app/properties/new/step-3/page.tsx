"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { NumberStepper } from "@/components/ui/number-stepper";
import { saveStep3Action, type ActionResult } from "@/lib/actions/wizard.actions";

export default function WizardStep3Page() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId") ?? "";

  const [maxGuests, setMaxGuests] = useState(2);
  const [bedroomsCount, setBedroomsCount] = useState(1);
  const [bedsCount, setBedsCount] = useState(1);
  const [bathroomsCount, setBathroomsCount] = useState(1);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveStep3Action,
    null,
  );

  return (
    <WizardShell
      currentStep={3}
      totalSteps={4}
      title="Capacidad"
      subtitle="¿Cuántas personas caben y cómo se distribuye el espacio?"
      backHref={`/properties/new/step-2?propertyId=${propertyId}`}
    >
      <form action={formAction}>
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="maxGuests" value={maxGuests} />
        <input type="hidden" name="bedroomsCount" value={bedroomsCount} />
        <input type="hidden" name="bedsCount" value={bedsCount} />
        <input type="hidden" name="bathroomsCount" value={bathroomsCount} />

        <div className="space-y-3">
          <NumberStepper
            label="Huéspedes"
            value={maxGuests}
            min={1}
            max={30}
            onChange={setMaxGuests}
          />
          <NumberStepper
            label="Dormitorios"
            value={bedroomsCount}
            min={0}
            max={20}
            onChange={setBedroomsCount}
          />
          <NumberStepper
            label="Camas"
            value={bedsCount}
            min={1}
            max={30}
            onChange={setBedsCount}
          />
          <NumberStepper
            label="Baños"
            value={bathroomsCount}
            min={1}
            max={15}
            onChange={setBathroomsCount}
          />
        </div>

        {state?.error && (
          <p className="mt-4 text-sm text-[var(--color-danger-500)]">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-8 inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Continuar"}
        </button>
      </form>
    </WizardShell>
  );
}
