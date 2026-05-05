"use client";

import { useActionState, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Search } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { NumberStepper } from "@/components/ui/number-stepper";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { savePropertyAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { propertyTypes, roomTypes, spanishProvinces, spaceAvailabilityRules, propertyEnvironments, getItems, findItem } from "@/lib/taxonomy-loader";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/ui/location-map").then((m) => m.LocationMap), { ssr: false, loading: () => <div className="h-64 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] flex items-center justify-center text-sm text-[var(--color-neutral-500)]">Cargando mapa...</div> });

const propertyTypeOptions: RadioCardOption[] = getItems(propertyTypes).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));
const roomTypeOptions: RadioCardOption[] = getItems(roomTypes).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));
const layoutKeyOptions: RadioCardOption[] = spaceAvailabilityRules.layoutKeys.map((lk) => ({
  id: lk.id, label: lk.label, description: lk.description,
}));
const environmentOptions: RadioCardOption[] = getItems(propertyEnvironments).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));
const provinces = getItems(spanishProvinces);


interface PropertyFormProps {
  propertyId: string;
  property: {
    propertyNickname: string;
    propertyType: string | null;
    roomType: string | null;
    layoutKey: string | null;
    propertyEnvironment: string | null;
    customPropertyTypeLabel: string | null;
    customPropertyTypeDesc: string | null;
    customRoomTypeLabel: string | null;
    customRoomTypeDesc: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    streetAddress: string | null;
    addressExtra: string | null;
    addressLevel: string | null;
    timezone: string | null;
    maxGuests: number | null;
    maxAdults: number;
    maxChildren: number;
    infantsAllowed: boolean;
    hasPrivateEntrance: boolean;
    bedroomsCount: number | null;
    bathroomsCount: number | null;
    latitude: number | null;
    longitude: number | null;
    infrastructureJson: unknown;
  };
}

export function PropertyForm({ propertyId, property: p }: PropertyFormProps) {
  const [editingName, setEditingName] = useState(false);
  const [nickname, setNickname] = useState(p.propertyNickname);

  const [propertyType, setPropertyType] = useState(p.propertyType ?? "");
  const [roomType, setRoomType] = useState(p.roomType ?? "");
  const [layoutKey, setLayoutKey] = useState(p.layoutKey ?? "");
  const [environment, setEnvironment] = useState(p.propertyEnvironment ?? "");
  const [customPtLabel, setCustomPtLabel] = useState(p.customPropertyTypeLabel ?? "");
  const [customPtDesc, setCustomPtDesc] = useState(p.customPropertyTypeDesc ?? "");
  const [customRtLabel, setCustomRtLabel] = useState(p.customRoomTypeLabel ?? "");
  const [customRtDesc, setCustomRtDesc] = useState(p.customRoomTypeDesc ?? "");
  const [country, setCountry] = useState(p.country ?? "España");
  const [city, setCity] = useState(p.city ?? "");
  const [province, setProvince] = useState(p.region ?? "");
  const [streetAddress, setStreetAddress] = useState(p.streetAddress ?? "");
  const [addressExtra, setAddressExtra] = useState(p.addressExtra ?? "");
  const [postalCode, setPostalCode] = useState(p.postalCode ?? "");
  const [timezone, setTimezone] = useState(p.timezone ?? "Europe/Madrid");
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [latitude, setLatitude] = useState<number | null>(p.latitude);
  const [longitude, setLongitude] = useState<number | null>(p.longitude);
  const [geocoding, setGeocoding] = useState(false);
  const [maxGuests, setMaxGuests] = useState(p.maxGuests ?? 2);
  const [maxAdults, setMaxAdults] = useState(p.maxAdults);
  const [maxChildren, setMaxChildren] = useState(p.maxChildren);
  const [infantsAllowed, setInfantsAllowed] = useState(p.infantsAllowed);
  const [hasPrivateEntrance, setHasPrivateEntrance] = useState(p.hasPrivateEntrance);

  const infra = p.infrastructureJson as {
    hasElevator?: boolean;
    buildingFloors?: number;
  } | null ?? {};
  const [hasElevator, setHasElevator] = useState<boolean>(infra.hasElevator ?? false);
  const [buildingFloors, setBuildingFloors] = useState<number>(infra.buildingFloors ?? 1);

  const [ptOpen, setPtOpen] = useState(false);
  const [rtOpen, setRtOpen] = useState(false);
  const [lkOpen, setLkOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(true);
  const [guestsOpen, setGuestsOpen] = useState(true);
  const [infraOpen, setInfraOpen] = useState(false);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePropertyAction, null);

  // Infra dirty: tracks whether infrastructure fields differ from what's in DB
  const infraDirty =
    hasElevator !== (infra.hasElevator ?? false) ||
    buildingFloors !== (infra.buildingFloors ?? 1);

  // Dirty tracking — compare against initial values
  const isDirty = nickname !== p.propertyNickname ||
    propertyType !== (p.propertyType ?? "") ||
    roomType !== (p.roomType ?? "") ||
    layoutKey !== (p.layoutKey ?? "") ||
    environment !== (p.propertyEnvironment ?? "") ||
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
    infantsAllowed !== p.infantsAllowed ||
    hasPrivateEntrance !== p.hasPrivateEntrance ||
    streetAddress !== (p.streetAddress ?? "") ||
    addressExtra !== (p.addressExtra ?? "") ||
    postalCode !== (p.postalCode ?? "") ||
    latitude !== p.latitude ||
    longitude !== p.longitude ||
    infraDirty;

  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = flashTimers.current;
    return () => { timers.forEach((t) => clearTimeout(t)); };
  }, []);

  function flashField(name: string) {
    setAutoFilled((prev) => new Set(prev).add(name));
    const existing = flashTimers.current.get(name);
    if (existing) clearTimeout(existing);
    flashTimers.current.set(name, setTimeout(() => {
      setAutoFilled((prev) => { const n = new Set(prev); n.delete(name); return n; });
      flashTimers.current.delete(name);
    }, 1500));
  }
  const autoFillCls = (name: string) => autoFilled.has(name) ? "!bg-[var(--color-primary-50)] !border-[var(--color-primary-400)]" : "";

  async function handlePinMove(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    try {
      const res = await fetch("/api/geo/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      if (data.matchFound) {
        if (data.streetAddress) { setStreetAddress(data.streetAddress); flashField("streetAddress"); }
        if (data.city) { setCity(data.city); flashField("city"); }
        if (data.country) { setCountry(data.country); flashField("country"); }
        if (data.postalCode) { setPostalCode(data.postalCode); flashField("postalCode"); }
        if (data.provinceId) { setProvince(data.provinceId); flashField("region"); }
        if (data.timezone && COMMON_TIMEZONES.some((tz) => tz.value === data.timezone)) { setTimezone(data.timezone); flashField("timezone"); }
      }
    } catch { /* ignore */ }
  }

  function handleAddressBlur() {
    if (country.trim() && city.trim() && streetAddress.trim() && !geocoding) handleGeocode();
  }

  async function handleGeocode() {
    if (geocoding || (!city && !country)) return;
    setGeocoding(true);
    try {
      const res = await fetch("/api/geo/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streetAddress: streetAddress || undefined, city, country }),
      });
      const data = await res.json();
      if (data.matchFound) {
        setLatitude(data.lat);
        setLongitude(data.lng);
        const d = data.derived;
        if (d?.timezone && COMMON_TIMEZONES.some((tz) => tz.value === d.timezone)) { setTimezone(d.timezone); flashField("timezone"); }
        if (d?.provinceId) { setProvince(d.provinceId); flashField("region"); }
        if (d?.postalCode) { setPostalCode(d.postalCode); flashField("postalCode"); }
      }
    } catch { /* geocode error — ignore, user can retry */ } finally {
      setGeocoding(false);
    }
  }

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
  const lkLabel = layoutKey ? (layoutKeyOptions.find((o) => o.id === layoutKey)?.label ?? "Sin definir") : "Sin definir";
  const envLabel = environment ? (findItem(propertyEnvironments, environment)?.label ?? "Sin definir") : "Sin definir";
  const locationParts = [city, country].filter(Boolean);
  const provLabel = provinces.find((pr) => pr.id === province)?.label;
  if (provLabel) locationParts.push(provLabel);
  const tzLabel = COMMON_TIMEZONES.find((t) => t.value === timezone)?.label ?? timezone ?? "";
  const locationLabel = locationParts.length > 0 ? `${locationParts.join(", ")} · ${tzLabel}` : "Sin definir";
  const guestsLabel = `${maxGuests} huéspedes (${maxAdults} adultos, ${maxChildren} niños)`;
  const infraConfigured = infraDirty || (infra.hasElevator != null || infra.buildingFloors != null);
  const infraLabel = !infraConfigured
    ? "Sin configurar"
    : hasElevator
      ? `${buildingFloors} planta${buildingFloors !== 1 ? "s" : ""} · Ascensor`
      : `${buildingFloors} planta${buildingFloors !== 1 ? "s" : ""}`;



  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href={`/properties/${propertyId}`} className="inline-flex items-center gap-1.5 text-xs text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]">
            <ArrowLeft size={12} aria-hidden="true" />
            Volver al panel
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Propiedad</h1>
        </div>
        <InlineSaveStatus status={pending ? "saving" : state?.success ? "saved" : state?.error ? "error" : "saved"} />
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="propertyType" value={propertyType} />
        <input type="hidden" name="roomType" value={roomType} />
        <input type="hidden" name="layoutKey" value={roomType === "rt.entire_place" ? layoutKey : ""} />
        <input type="hidden" name="propertyEnvironment" value={environment} />
        <input type="hidden" name="customPropertyTypeLabel" value={customPtLabel} />
        <input type="hidden" name="customPropertyTypeDesc" value={customPtDesc} />
        <input type="hidden" name="customRoomTypeLabel" value={customRtLabel} />
        <input type="hidden" name="customRoomTypeDesc" value={customRtDesc} />
        {/* Only send infrastructureJson when user changed infra fields — avoids overwriting existing JSON keys on unrelated saves */}
        {infraDirty && (
          <input type="hidden" name="infrastructureJson" value={JSON.stringify({ hasElevator, buildingFloors })} />
        )}

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
            <>
              <button type="button" onClick={() => setEditingName(true)} className="flex w-full items-center justify-between text-left group min-h-[44px] rounded-[var(--radius-md)] px-1 py-2 transition-colors hover:bg-[var(--color-neutral-50)]">
                <span className="text-lg font-bold text-[var(--foreground)]">{nickname}</span>
                <Pencil size={16} aria-hidden="true" className="text-[var(--color-neutral-400)] group-hover:text-[var(--color-primary-500)] transition-colors" />
              </button>
              <input type="hidden" name="propertyNickname" value={nickname} />
            </>
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

        {/* Distribución — solo para alojamiento completo */}
        {roomType === "rt.entire_place" && (
          <CollapsibleSection title="Distribución" selectedLabel={lkLabel} expanded={lkOpen} onToggle={() => setLkOpen(!lkOpen)}>
            <p className="mb-3 text-xs text-[var(--color-neutral-500)]">
              ¿Cómo están organizados los espacios? Esto determina qué tipos de espacio puedes añadir.
            </p>
            {layoutKey && layoutKey !== (p.layoutKey ?? "") && (
              <div className="mb-3 rounded-[var(--radius-md)] bg-[var(--color-warning-50)] border border-[var(--color-warning-200)] px-3 py-2 text-xs text-[var(--color-warning-700)]">
                Cambiar la distribución puede generar conflictos con los espacios ya creados. Revisa la sección Espacios tras guardar.
              </div>
            )}
            <RadioCardGroup
              name="_layoutKey"
              options={layoutKeyOptions}
              value={layoutKey || null}
              onChange={(val) => {
                setLayoutKey(val);
                setTimeout(() => setLkOpen(false), 200);
              }}
              showRecommended={false}
            />
          </CollapsibleSection>
        )}

        {/* Entorno */}
        <CollapsibleSection title="Entorno" selectedLabel={envLabel} expanded={envOpen} onToggle={() => setEnvOpen(!envOpen)}>
          <p className="mb-3 text-xs text-[var(--color-neutral-500)]">
            Selecciona el tipo de entorno de la propiedad. Esto ayuda a filtrar equipamiento y opciones relevantes.
          </p>
          <RadioCardGroup
            name="_environment"
            options={[
              { id: "", label: "Sin definir", description: "No establecer entorno por ahora" },
              ...environmentOptions,
            ]}
            value={environment ?? ""}
            onChange={(val) => {
              setEnvironment(val || "");
              setTimeout(() => setEnvOpen(false), 200);
            }}
            showRecommended={false}
          />
        </CollapsibleSection>

        {/* Ubicación y zona horaria */}
        <CollapsibleSection title="Ubicación y zona horaria" selectedLabel={locationLabel} expanded={locOpen} onToggle={() => setLocOpen(!locOpen)}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium">País *</span><input name="country" type="text" required value={country} onChange={(e) => setCountry(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm ${autoFillCls("country")}`} /></label>
              <label className="block"><span className="text-sm font-medium">Ciudad *</span><input name="city" type="text" required value={city} onChange={(e) => setCity(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm ${autoFillCls("city")}`} /></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block sm:col-span-2"><span className="text-sm font-medium">Dirección (vía y número) *</span><input name="streetAddress" type="text" required value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} onBlur={handleAddressBlur} placeholder="ej. Calle Ramón y Cajal, 17" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-neutral-400)]" /></label>
              <label className="block"><span className="text-sm font-medium">Piso / Puerta</span><input name="addressExtra" type="text" value={addressExtra} onChange={(e) => setAddressExtra(e.target.value)} placeholder="ej. 2º C" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm placeholder:text-[var(--color-neutral-400)]" /></label>
            </div>
            <input type="hidden" name="addressLevel" value={p.addressLevel ?? "exact"} />
            <input type="hidden" name="latitude" value={latitude ?? ""} />
            <input type="hidden" name="longitude" value={longitude ?? ""} />

            <button type="button" disabled={geocoding || !streetAddress.trim() || !city.trim()} onClick={handleGeocode} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary-500)] hover:text-[var(--color-primary-700)] disabled:opacity-40 transition-colors">
              <Search size={14} aria-hidden="true" />
              {geocoding ? "Buscando..." : "Encontrar ubicación"}
            </button>

            <LocationMap lat={latitude} lng={longitude} onPositionChange={handlePinMove} />
            {latitude != null && longitude != null && (
              <p className="text-xs text-[var(--color-neutral-400)]">{latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium text-[var(--color-neutral-500)]">Provincia</span><select name="region" value={province} onChange={(e) => setProvince(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm ${autoFillCls("region")}`}><option value="">Seleccionar</option>{provinces.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}</select></label>
              <label className="block"><span className="text-sm font-medium text-[var(--color-neutral-500)]">Código postal</span><input name="postalCode" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm ${autoFillCls("postalCode")}`} /></label>
            </div>
            <label className="block"><span className="text-sm font-medium text-[var(--color-neutral-500)]">Zona horaria *</span><select name="timezone" required value={timezone} onChange={(e) => setTimezone(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm ${autoFillCls("timezone")}`}>{COMMON_TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}</select></label>
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

        {/* Habitaciones y baños — derivados de Espacios */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--foreground)]">Habitaciones y baños</p>
            <Link
              href={`/properties/${propertyId}/spaces`}
              className="text-xs text-[var(--color-primary-600)] hover:underline"
            >
              Gestionar espacios →
            </Link>
          </div>
          <div className="mt-2 flex gap-6">
            <span className="text-sm text-[var(--color-neutral-600)]">
              <span className="font-medium text-[var(--foreground)]">{p.bedroomsCount ?? 0}</span> dormitorios
            </span>
            <span className="text-sm text-[var(--color-neutral-600)]">
              <span className="font-medium text-[var(--foreground)]">{p.bathroomsCount ?? 0}</span> baños
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-neutral-400)]">Calculado automáticamente a partir de los espacios definidos.</p>
        </div>

        {/* Infraestructura del edificio */}
        <CollapsibleSection title="Infraestructura del edificio" selectedLabel={infraLabel} expanded={infraOpen} onToggle={() => setInfraOpen(!infraOpen)}>
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-neutral-500)]">
              Los sistemas de calefacción y refrigeración se gestionan en la sección{" "}
              <Link href={`/properties/${propertyId}/systems`} className="text-[var(--color-primary-500)] hover:underline">Sistemas</Link>.
            </p>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary-500)]" checked={hasElevator} onChange={(e) => setHasElevator(e.target.checked)} />
              <span className="text-sm font-medium text-[var(--foreground)]">El edificio tiene ascensor</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="hasPrivateEntrance" className="h-4 w-4 accent-[var(--color-primary-500)]" checked={hasPrivateEntrance} onChange={(e) => setHasPrivateEntrance(e.target.checked)} />
              <span className="text-sm font-medium text-[var(--foreground)]">Entrada privada</span>
              <InfoTooltip text="La vivienda tiene una entrada independiente que el huésped usa sin compartir pasillos o zonas interiores con otros inquilinos o el anfitrión." />
            </label>
            <NumberStepper label="Número de plantas del edificio" value={buildingFloors} onChange={setBuildingFloors} min={1} max={200} />
          </div>
        </CollapsibleSection>

        {state?.error && <p className="text-sm text-[var(--color-danger-500)]">{state.error}</p>}

        <button type="submit" disabled={pending || !isDirty} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
