"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { saveStep1Action, type ActionResult } from "@/lib/actions/wizard.actions";
import { propertyTypes, roomTypes, getItems } from "@/lib/taxonomy-loader";

const propertyTypeOptions: RadioCardOption[] = getItems(propertyTypes).map((item) => ({
  id: item.id,
  label: item.label,
  description: item.description,
  recommended: item.recommended,
}));

const roomTypeOptions: RadioCardOption[] = getItems(roomTypes).map((item) => ({
  id: item.id,
  label: item.label,
  description: item.description,
  recommended: item.recommended,
}));

export default function WizardStep1Page() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId") ?? "";

  const [propertyType, setPropertyType] = useState<string | null>(null);
  const [roomType, setRoomType] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveStep1Action,
    null,
  );

  return (
    <WizardShell
      currentStep={1}
      totalSteps={4}
      title="Tipo de alojamiento"
      subtitle="Selecciona qué tipo de propiedad ofreces y cómo la utilizarán los huéspedes."
      backHref="/properties/new/welcome"
    >
      <form action={formAction}>
        <input type="hidden" name="propertyId" value={propertyId} />

        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
              Tipo de propiedad
            </h2>
            <RadioCardGroup
              name="propertyType"
              options={propertyTypeOptions}
              value={propertyType}
              onChange={setPropertyType}
            />
            {state?.fieldErrors?.propertyType && (
              <p className="mt-2 text-sm text-[var(--color-danger-500)]">
                {state.fieldErrors.propertyType[0]}
              </p>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
              Tipo de espacio
            </h2>
            <RadioCardGroup
              name="roomType"
              options={roomTypeOptions}
              value={roomType}
              onChange={setRoomType}
            />
            {state?.fieldErrors?.roomType && (
              <p className="mt-2 text-sm text-[var(--color-danger-500)]">
                {state.fieldErrors.roomType[0]}
              </p>
            )}
          </div>
        </div>

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
