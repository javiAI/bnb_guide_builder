"use client";

import { useActionState } from "react";
import { saveBasicsAction, type ActionResult } from "@/lib/actions/editor.actions";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { NumberStepper } from "@/components/ui/number-stepper";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { propertyTypes, roomTypes, getItems } from "@/lib/taxonomy-loader";
import { getWizardStep } from "@/config/schemas/wizard-steps";
import { useState } from "react";

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

// Get timezone options from wizard step config
const step2Def = getWizardStep(2)!;
const timezoneGroup = step2Def.groups.find((g) => g.id === "timezone")!;
const timezoneField = timezoneGroup.fields[0];
const timezoneOptions =
  timezoneField.type === "select" ? timezoneField.options : [];

interface BasicsFormProps {
  propertyId: string;
  defaultValues: {
    propertyNickname: string;
    propertyType: string;
    roomType: string;
    country: string;
    city: string;
    region: string;
    postalCode: string;
    streetAddress: string;
    addressLevel: string;
    timezone: string;
    maxGuests: number;
    bedroomsCount: number;
    bedsCount: number;
    bathroomsCount: number;
  };
}

export function BasicsForm({ propertyId, defaultValues }: BasicsFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveBasicsAction,
    null,
  );

  const [propertyType, setPropertyType] = useState(defaultValues.propertyType);
  const [roomType, setRoomType] = useState(defaultValues.roomType);
  const [maxGuests, setMaxGuests] = useState(defaultValues.maxGuests);
  const [bedroomsCount, setBedroomsCount] = useState(defaultValues.bedroomsCount);
  const [bedsCount, setBedsCount] = useState(defaultValues.bedsCount);
  const [bathroomsCount, setBathroomsCount] = useState(defaultValues.bathroomsCount);

  const fieldError = (field: string) =>
    state?.fieldErrors?.[field]?.[0];

  const saveStatus = pending ? "saving" : state?.success ? "saved" : state?.error ? "error" : undefined;

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="propertyId" value={propertyId} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Identidad
        </h2>
        {saveStatus && <InlineSaveStatus status={saveStatus} />}
      </div>

      {state?.error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      {/* Property nickname */}
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Nombre de la propiedad *
        </span>
        <input
          name="propertyNickname"
          type="text"
          required
          defaultValue={defaultValues.propertyNickname}
          className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
        />
        {fieldError("propertyNickname") && (
          <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("propertyNickname")}</p>
        )}
      </label>

      {/* Property type */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Tipo de propiedad *
        </h3>
        <RadioCardGroup
          name="propertyType"
          options={propertyTypeOptions}
          value={propertyType}
          onChange={setPropertyType}
        />
        {fieldError("propertyType") && (
          <p className="mt-2 text-sm text-[var(--color-danger-500)]">{fieldError("propertyType")}</p>
        )}
      </div>

      {/* Room type */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Tipo de espacio *
        </h3>
        <RadioCardGroup
          name="roomType"
          options={roomTypeOptions}
          value={roomType}
          onChange={setRoomType}
        />
        {fieldError("roomType") && (
          <p className="mt-2 text-sm text-[var(--color-danger-500)]">{fieldError("roomType")}</p>
        )}
      </div>

      {/* Location */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Ubicación
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">País *</span>
            <input
              name="country"
              type="text"
              required
              defaultValue={defaultValues.country}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
            {fieldError("country") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("country")}</p>
            )}
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Ciudad *</span>
            <input
              name="city"
              type="text"
              required
              defaultValue={defaultValues.city}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
            {fieldError("city") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("city")}</p>
            )}
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Región</span>
            <input name="region" type="text" defaultValue={defaultValues.region}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Código postal</span>
            <input name="postalCode" type="text" defaultValue={defaultValues.postalCode}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-[var(--color-neutral-500)]">Dirección</span>
            <input name="streetAddress" type="text" defaultValue={defaultValues.streetAddress}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Piso / Planta</span>
            <input name="addressLevel" type="text" defaultValue={defaultValues.addressLevel}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Zona horaria *</span>
            <select
              name="timezone"
              required
              defaultValue={defaultValues.timezone}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            >
              {timezoneOptions.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            {fieldError("timezone") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("timezone")}</p>
            )}
          </label>
        </div>
      </div>

      {/* Capacity */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Capacidad
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <NumberStepper
            name="maxGuests"
            label="Huéspedes máximos"
            value={maxGuests}
            onChange={setMaxGuests}
            min={1}
            max={50}
          />
          <NumberStepper
            name="bedroomsCount"
            label="Dormitorios"
            value={bedroomsCount}
            onChange={setBedroomsCount}
            min={0}
            max={30}
          />
          <NumberStepper
            name="bedsCount"
            label="Camas"
            value={bedsCount}
            onChange={setBedsCount}
            min={1}
            max={50}
          />
          <NumberStepper
            name="bathroomsCount"
            label="Baños"
            value={bathroomsCount}
            onChange={setBathroomsCount}
            min={1}
            max={20}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
