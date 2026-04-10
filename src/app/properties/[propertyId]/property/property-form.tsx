"use client";

import { useActionState, useState, useCallback } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { NumberStepper } from "@/components/ui/number-stepper";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { savePropertyAction, type ActionResult } from "@/lib/actions/editor.actions";
import { propertyTypes, roomTypes, spanishProvinces, getItems, findItem } from "@/lib/taxonomy-loader";

const propertyTypeOptions: RadioCardOption[] = getItems(propertyTypes).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));
const roomTypeOptions: RadioCardOption[] = getItems(roomTypes).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));
const provinces = getItems(spanishProvinces);

const COMMON_TIMEZONES = [
  { value: "Europe/Madrid", label: "España peninsular" },
  { value: "Atlantic/Canary", label: "Canarias" },
  { value: "Europe/Lisbon", label: "Portugal" },
  { value: "Europe/Paris", label: "Francia" },
  { value: "Europe/Rome", label: "Italia" },
  { value: "Europe/London", label: "Reino Unido" },
  { value: "America/Mexico_City", label: "México" },
  { value: "America/Bogota", label: "Colombia" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina" },
  { value: "America/Santiago", label: "Chile" },
];

interface PropertyFormProps {
  propertyId: string;
  property: {
    propertyNickname: string;
    propertyType: string | null;
    roomType: string | null;
    customPropertyTypeLabel: string | null;
    customPropertyTypeDesc: string | null;
    customRoomTypeLabel: string | null;
    customRoomTypeDesc: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    streetAddress: string | null;
    addressLevel: string | null;
    timezone: string | null;
    maxGuests: number | null;
    maxAdults: number;
    maxChildren: number;
    infantsAllowed: boolean;
    bedroomsCount: number | null;
    bathroomsCount: number | null;
  };
}

export function PropertyForm({ propertyId, property: p }: PropertyFormProps) {
  const [editingName, setEditingName] = useState(false);
  const [nickname, setNickname] = useState(p.propertyNickname);

  const [propertyType, setPropertyType] = useState(p.propertyType ?? "");
  const [roomType, setRoomType] = useState(p.roomType ?? "");
  const [customPtLabel, setCustomPtLabel] = useState(p.customPropertyTypeLabel ?? "");
  const [customPtDesc, setCustomPtDesc] = useState(p.customPropertyTypeDesc ?? "");
  const [customRtLabel, setCustomRtLabel] = useState(p.customRoomTypeLabel ?? "");
  const [customRtDesc, setCustomRtDesc] = useState(p.customRoomTypeDesc ?? "");
  const [country, setCountry] = useState(p.country ?? "España");
  const [city, setCity] = useState(p.city ?? "");
  const [province, setProvince] = useState(p.region ?? "");
  const [timezone, setTimezone] = useState(p.timezone ?? "Europe/Madrid");
  const [maxGuests, setMaxGuests] = useState(p.maxGuests ?? 2);
  const [maxAdults, setMaxAdults] = useState(p.maxAdults);
  const [maxChildren, setMaxChildren] = useState(p.maxChildren);
  const [infantsAllowed, setInfantsAllowed] = useState(p.infantsAllowed);

  const [ptOpen, setPtOpen] = useState(false);
  const [rtOpen, setRtOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(true);
  const [guestsOpen, setGuestsOpen] = useState(true);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePropertyAction, null);

  // Dirty tracking — compare against initial values
  const isDirty = nickname !== p.propertyNickname ||
    propertyType !== (p.propertyType ?? "") ||
    roomType !== (p.roomType ?? "") ||
    customPtLabel !== (p.customPropertyTypeLabel ?? "") ||
    customPtDesc !== (p.customPropertyTypeDesc ?? "") ||
    customRtLabel !== (p.customRoomTypeLabel ?? "") ||
    customRtDesc !== (p.customRoomTypeDesc ?? "") ||
    country !== (p.country ?? "España") ||
    city !== (p.city ?? "") ||
    province !== (p.region ?? "") ||
    timezone !== (p.timezone ?? "Europe/Madrid") ||
    maxGuests !== (p.maxGuests ?? 2) ||
    maxAdults !== p.maxAdults ||
    maxChildren !== p.maxChildren ||
    infantsAllowed !== p.infantsAllowed;

  const handleMaxGuestsChange = useCallback((val: number) => {
    setMaxGuests(val);
    const newAdults = Math.min(maxAdults, val);
    setMaxAdults(newAdults);
    setMaxChildren(val - newAdults);
  }, [maxAdults]);

  const handleMaxAdultsChange = useCallback((val: number) => {
    setMaxAdults(val);
    setMaxChildren(maxGuests - val);
  }, [maxGuests]);

  const handleMaxChildrenChange = useCallback((val: number) => {
    setMaxChildren(val);
    setMaxAdults(maxGuests - val);
  }, [maxGuests]);

  const ptLabel = propertyType === "pt.other" ? (customPtLabel || "Otro") : findItem(propertyTypes, propertyType)?.label ?? "Sin definir";
  const rtLabel = roomType === "rt.other" ? (customRtLabel || "Otro") : findItem(roomTypes, roomType)?.label ?? "Sin definir";
  const locationParts = [city, country].filter(Boolean);
  const provLabel = provinces.find((pr) => pr.id === province)?.label;
  if (provLabel) locationParts.push(provLabel);
  const tzLabel = COMMON_TIMEZONES.find((t) => t.value === timezone)?.label ?? timezone ?? "";
  const locationLabel = locationParts.length > 0 ? `${locationParts.join(", ")} · ${tzLabel}` : "Sin definir";
  const guestsLabel = `${maxGuests} huéspedes (${maxAdults} adultos, ${maxChildren} niños)`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href={`/properties/${propertyId}`} className="text-xs text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]">&larr; Volver al panel</Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Propiedad</h1>
        </div>
        <InlineSaveStatus status={pending ? "saving" : state?.success ? "saved" : state?.error ? "error" : "saved"} />
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="propertyType" value={propertyType} />
        <input type="hidden" name="roomType" value={roomType} />
        <input type="hidden" name="customPropertyTypeLabel" value={customPtLabel} />
        <input type="hidden" name="customPropertyTypeDesc" value={customPtDesc} />
        <input type="hidden" name="customRoomTypeLabel" value={customRtLabel} />
        <input type="hidden" name="customRoomTypeDesc" value={customRtDesc} />
        {/* Keep bedroomsCount/bathroomsCount from current values so save doesn't null them */}
        <input type="hidden" name="bedroomsCount" value={p.bedroomsCount ?? 0} />
        <input type="hidden" name="bathroomsCount" value={p.bathroomsCount ?? 1} />

        {/* Inline editable name */}
        <div className="rounded-[var(--radius-lg)] border-2 border-[var(--border)] bg-[var(--surface-elevated)] p-4">
          {editingName ? (
            <input
              name="propertyNickname"
              type="text"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditingName(false); } }}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-primary-400)] bg-[var(--surface-elevated)] px-3 py-1.5 text-lg font-bold text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]"
            />
          ) : (
            <button type="button" onClick={() => setEditingName(true)} className="flex w-full items-center justify-between text-left group">
              <span className="text-lg font-bold text-[var(--foreground)]">{nickname}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--color-neutral-400)] group-hover:text-[var(--color-primary-500)] transition-colors">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
              <input type="hidden" name="propertyNickname" value={nickname} />
            </button>
          )}
        </div>

        {/* Tipo de propiedad */}
        <CollapsibleSection title="Tipo de propiedad" selectedLabel={ptLabel} expanded={ptOpen} onToggle={() => setPtOpen(!ptOpen)}>
          <RadioCardGroup name="_propertyType" options={propertyTypeOptions} value={propertyType} onChange={setPropertyType} showRecommended={false} />
          {propertyType === "pt.other" && (
            <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
              <label className="block"><span className="text-sm font-medium">Nombre *</span><input type="text" value={customPtLabel} onChange={(e) => setCustomPtLabel(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-sm font-medium">Descripción</span><textarea value={customPtDesc} onChange={(e) => setCustomPtDesc(e.target.value)} rows={2} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
            </div>
          )}
        </CollapsibleSection>

        {/* Tipo de espacio */}
        <CollapsibleSection title="Tipo de espacio" selectedLabel={rtLabel} expanded={rtOpen} onToggle={() => setRtOpen(!rtOpen)}>
          <RadioCardGroup name="_roomType" options={roomTypeOptions} value={roomType} onChange={setRoomType} showRecommended={false} />
          {roomType === "rt.other" && (
            <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
              <label className="block"><span className="text-sm font-medium">Nombre *</span><input type="text" value={customRtLabel} onChange={(e) => setCustomRtLabel(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-sm font-medium">Descripción</span><textarea value={customRtDesc} onChange={(e) => setCustomRtDesc(e.target.value)} rows={2} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
            </div>
          )}
        </CollapsibleSection>

        {/* Ubicación y zona horaria */}
        <CollapsibleSection title="Ubicación y zona horaria" selectedLabel={locationLabel} expanded={locOpen} onToggle={() => setLocOpen(!locOpen)}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium">País *</span><input name="country" type="text" required value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-sm font-medium">Ciudad *</span><input name="city" type="text" required value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium">Provincia</span><select name="region" value={province} onChange={(e) => setProvince(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm"><option value="">Seleccionar</option>{provinces.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}</select></label>
              <label className="block"><span className="text-sm font-medium">Código postal</span><input name="postalCode" type="text" defaultValue={p.postalCode ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
            </div>
            <label className="block"><span className="text-sm font-medium">Dirección</span><input name="streetAddress" type="text" defaultValue={p.streetAddress ?? ""} placeholder="Calle, número, piso" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-neutral-400)]" /></label>
            <input type="hidden" name="addressLevel" value={p.addressLevel ?? "exact"} />
            <label className="block"><span className="text-sm font-medium">Zona horaria *</span><select name="timezone" required value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm">{COMMON_TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}</select></label>
          </div>
        </CollapsibleSection>

        {/* Huéspedes */}
        <CollapsibleSection title="Huéspedes" selectedLabel={guestsLabel} expanded={guestsOpen} onToggle={() => setGuestsOpen(!guestsOpen)}>
          <div className="space-y-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm font-medium text-[var(--foreground)]">Máximo de huéspedes</span>
              <InfoTooltip text="Define el máximo total de huéspedes. Siempre debe haber al menos 1 adulto. Los adultos adicionales representan plazas flexibles: cada una puede ser ocupada por un adulto o un niño. Si seleccionas niños, esas plazas solo pueden ser ocupadas por menores de 14 años." />
            </div>
            <NumberStepper label="Máximo de huéspedes" name="maxGuests" value={maxGuests} onChange={handleMaxGuestsChange} min={1} max={30} />
            <div className="ml-4 space-y-2 border-l-2 border-[var(--color-neutral-200)] pl-4">
              <NumberStepper label="Número máximo de adultos" name="maxAdults" value={maxAdults} onChange={handleMaxAdultsChange} min={1} max={maxGuests} />
              <NumberStepper label="Niños (menores de 14 años)" name="maxChildren" value={maxChildren} onChange={handleMaxChildrenChange} min={0} max={maxGuests - 1} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="infantsAllowed" checked={infantsAllowed} onChange={(e) => setInfantsAllowed(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary-500)]" />
              <span className="text-sm">Se admiten bebés (cuna disponible)</span>
              <InfoTooltip text="Los bebés menores de 2 años no cuentan como huéspedes." />
            </label>
          </div>
        </CollapsibleSection>

        {state?.error && <p className="text-sm text-[var(--color-danger-500)]">{state.error}</p>}

        <button type="submit" disabled={pending || !isDirty} className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
