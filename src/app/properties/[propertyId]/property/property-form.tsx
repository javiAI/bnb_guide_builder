"use client";

import { useActionState, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Search, Home, UsersRound } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { NumberStepper } from "@/components/ui/number-stepper";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { TextLink } from "@/components/ui/text-link";
import { savePropertyAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { propertyTypes } from "@/lib/taxonomies/property-types";
import { roomTypes } from "@/lib/taxonomies/room-types";
import { spanishProvinces } from "@/lib/taxonomies/spanish-provinces";
import { spaceAvailabilityRules } from "@/lib/taxonomies/space-availability-rules";
import { propertyEnvironments } from "@/lib/taxonomies/property-environments";
import { getItems, findItem } from "@/lib/taxonomies/_helpers";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/ui/location-map").then((m) => m.LocationMap), { ssr: false, loading: () => <div className="h-64 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-default)] bg-[var(--color-background-muted)] flex items-center justify-center text-sm text-[var(--color-text-muted)]">Cargando mapa...</div> });

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

// Shared field-control classes — semantic tokens, AA contrast in light + dark.
const FIELD_CLS =
  "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)]";
const FIELD_LABEL_CLS = "text-sm font-medium text-[var(--color-text-primary)]";
const FIELD_LABEL_MUTED_CLS = "text-sm font-medium text-[var(--color-text-secondary)]";
const HELP_CLS = "text-xs text-[var(--color-text-muted)]";


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
  const autoFillCls = (name: string) => autoFilled.has(name) ? "!bg-[var(--color-action-primary-subtle)] !border-[var(--color-border-focus)]" : "";

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
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/properties/${propertyId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      >
        <ArrowLeft size={12} aria-hidden="true" />
        Volver al panel
      </Link>

      <PageHeader
        eyebrow="Datos básicos"
        title={nickname}
        description="Clasificación, ubicación, capacidad e infraestructura. Estos datos definen la base de la guía y alimentan el resto de secciones."
        actions={
          <InlineSaveStatus
            status={pending ? "saving" : state?.success ? "saved" : state?.error ? "error" : "saved"}
          />
        }
        chips={
          <>
            <PageHeaderChip icon={Home} label="Tipo" value={ptLabel} />
            <PageHeaderChip icon={UsersRound} label="Capacidad" value={`${maxGuests} huéspedes`} />
          </>
        }
      />

      <form action={formAction}>
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
        <div className="mb-8 rounded-[var(--radius-lg)] border-2 border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Nombre de la propiedad
          </span>
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
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-focus)] bg-[var(--color-background-elevated)] px-3 py-1.5 text-lg font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
            />
          ) : (
            <>
              <button type="button" onClick={() => setEditingName(true)} className="flex w-full items-center justify-between text-left group min-h-[44px] rounded-[var(--radius-md)] px-1 py-2 transition-colors hover:bg-[var(--color-interactive-hover)]">
                <span className="text-lg font-bold text-[var(--color-text-primary)]">{nickname}</span>
                <Pencil size={16} aria-hidden="true" className="text-[var(--color-text-muted)] group-hover:text-[var(--color-action-primary)] transition-colors" />
              </button>
              <input type="hidden" name="propertyNickname" value={nickname} />
            </>
          )}
        </div>

        <NumberedSection number="01" title="Clasificación">
          <div className="space-y-2">
            {/* Tipo de propiedad */}
            <CollapsibleSection title="Tipo de propiedad" selectedLabel={ptLabel} expanded={ptOpen} onToggle={() => setPtOpen(!ptOpen)}>
              <RadioCardGroup name="_propertyType" options={propertyTypeOptions} value={propertyType} onChange={setPropertyType} showRecommended={false} />
              {propertyType === "pt.other" && (
                <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] p-4">
                  <label className="block"><span className={FIELD_LABEL_CLS}>Nombre *</span><input type="text" value={customPtLabel} onChange={(e) => setCustomPtLabel(e.target.value)} className={FIELD_CLS} /></label>
                  <label className="block"><span className={FIELD_LABEL_CLS}>Descripción</span><textarea value={customPtDesc} onChange={(e) => setCustomPtDesc(e.target.value)} rows={2} className={FIELD_CLS} /></label>
                </div>
              )}
            </CollapsibleSection>

            {/* Tipo de espacio */}
            <CollapsibleSection title="Tipo de espacio" selectedLabel={rtLabel} expanded={rtOpen} onToggle={() => setRtOpen(!rtOpen)}>
              <RadioCardGroup name="_roomType" options={roomTypeOptions} value={roomType} onChange={setRoomType} showRecommended={false} />
              {roomType === "rt.other" && (
                <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] p-4">
                  <label className="block"><span className={FIELD_LABEL_CLS}>Nombre *</span><input type="text" value={customRtLabel} onChange={(e) => setCustomRtLabel(e.target.value)} className={FIELD_CLS} /></label>
                  <label className="block"><span className={FIELD_LABEL_CLS}>Descripción</span><textarea value={customRtDesc} onChange={(e) => setCustomRtDesc(e.target.value)} rows={2} className={FIELD_CLS} /></label>
                </div>
              )}
            </CollapsibleSection>

            {/* Distribución — solo para alojamiento completo */}
            {roomType === "rt.entire_place" && (
              <CollapsibleSection title="Distribución" selectedLabel={lkLabel} expanded={lkOpen} onToggle={() => setLkOpen(!lkOpen)}>
                <p className={`mb-3 ${HELP_CLS}`}>
                  ¿Cómo están organizados los espacios? Esto determina qué tipos de espacio puedes añadir.
                </p>
                {layoutKey && layoutKey !== (p.layoutKey ?? "") && (
                  <div className="mb-3 rounded-[var(--radius-md)] bg-[var(--color-status-warning-bg)] border border-[var(--color-status-warning-border)] px-3 py-2 text-xs text-[var(--color-status-warning-text)]">
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
              <p className={`mb-3 ${HELP_CLS}`}>
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
          </div>
        </NumberedSection>

        <NumberedSection number="02" title="Ubicación">
          {/* Ubicación y zona horaria */}
          <CollapsibleSection title="Ubicación y zona horaria" selectedLabel={locationLabel} expanded={locOpen} onToggle={() => setLocOpen(!locOpen)}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className={FIELD_LABEL_CLS}>País *</span><input name="country" type="text" required value={country} onChange={(e) => setCountry(e.target.value)} className={`${FIELD_CLS} ${autoFillCls("country")}`} /></label>
                <label className="block"><span className={FIELD_LABEL_CLS}>Ciudad *</span><input name="city" type="text" required value={city} onChange={(e) => setCity(e.target.value)} className={`${FIELD_CLS} ${autoFillCls("city")}`} /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block sm:col-span-2"><span className={FIELD_LABEL_CLS}>Dirección (vía y número) *</span><input name="streetAddress" type="text" required value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} onBlur={handleAddressBlur} placeholder="ej. Calle Ramón y Cajal, 17" className={`${FIELD_CLS} placeholder:text-[var(--color-text-placeholder)]`} /></label>
                <label className="block"><span className={FIELD_LABEL_CLS}>Piso / Puerta</span><input name="addressExtra" type="text" value={addressExtra} onChange={(e) => setAddressExtra(e.target.value)} placeholder="ej. 2º C" className={`${FIELD_CLS} placeholder:text-[var(--color-text-placeholder)]`} /></label>
              </div>
              <input type="hidden" name="addressLevel" value={p.addressLevel ?? "exact"} />
              <input type="hidden" name="latitude" value={latitude ?? ""} />
              <input type="hidden" name="longitude" value={longitude ?? ""} />

              <button type="button" disabled={geocoding || !streetAddress.trim() || !city.trim()} onClick={handleGeocode} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:underline disabled:opacity-40 transition-colors">
                <Search size={14} aria-hidden="true" />
                {geocoding ? "Buscando..." : "Encontrar ubicación"}
              </button>

              <LocationMap lat={latitude} lng={longitude} onPositionChange={handlePinMove} />
              {latitude != null && longitude != null && (
                <p className="text-xs text-[var(--color-text-muted)]">{latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className={FIELD_LABEL_MUTED_CLS}>Provincia</span><select name="region" value={province} onChange={(e) => setProvince(e.target.value)} className={`${FIELD_CLS} ${autoFillCls("region")}`}><option value="">Seleccionar</option>{provinces.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}</select></label>
                <label className="block"><span className={FIELD_LABEL_MUTED_CLS}>Código postal</span><input name="postalCode" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={`${FIELD_CLS} ${autoFillCls("postalCode")}`} /></label>
              </div>
              <label className="block"><span className={FIELD_LABEL_MUTED_CLS}>Zona horaria *</span><select name="timezone" required value={timezone} onChange={(e) => setTimezone(e.target.value)} className={`${FIELD_CLS} ${autoFillCls("timezone")}`}>{COMMON_TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}</select></label>
            </div>
          </CollapsibleSection>
        </NumberedSection>

        <NumberedSection number="03" title="Capacidad">
          <div className="space-y-2">
            {/* Huéspedes */}
            <CollapsibleSection title="Huéspedes" selectedLabel={guestsLabel} expanded={guestsOpen} onToggle={() => setGuestsOpen(!guestsOpen)}>
              <div className="space-y-3">
                <div className="flex items-center gap-1 mb-2">
                  <span className={FIELD_LABEL_CLS}>Máximo de huéspedes</span>
                  <InfoTooltip text="Define el máximo total de huéspedes. Siempre debe haber al menos 1 adulto. Los adultos adicionales representan plazas flexibles: cada una puede ser ocupada por un adulto o un niño. Si seleccionas niños, esas plazas solo pueden ser ocupadas por menores de 14 años." />
                </div>
                <NumberStepper label="Máximo de huéspedes" name="maxGuests" value={maxGuests} onChange={handleMaxGuestsChange} min={1} max={30} />
                <div className="ml-4 space-y-2 border-l-2 border-[var(--color-border-default)] pl-4">
                  <NumberStepper label="Número máximo de adultos" name="maxAdults" value={maxAdults} onChange={handleMaxAdultsChange} min={1} max={maxGuests} />
                  <NumberStepper label="Niños (menores de 14 años)" name="maxChildren" value={maxChildren} onChange={handleMaxChildrenChange} min={0} max={maxGuests - 1} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="infantsAllowed" checked={infantsAllowed} onChange={(e) => setInfantsAllowed(e.target.checked)} className="h-4 w-4 accent-[var(--color-action-primary)]" />
                  <span className="text-sm text-[var(--color-text-primary)]">Se admiten bebés (cuna disponible)</span>
                  <InfoTooltip text="Los bebés menores de 2 años no cuentan como huéspedes." />
                </label>
              </div>
            </CollapsibleSection>

            {/* Habitaciones y baños — derivados de Espacios */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Habitaciones y baños</p>
                <TextLink href={`/properties/${propertyId}/spaces`} size="sm" arrow>
                  Gestionar espacios
                </TextLink>
              </div>
              <div className="mt-2 flex gap-6">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  <span className="font-medium text-[var(--color-text-primary)]">{p.bedroomsCount ?? 0}</span> dormitorios
                </span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  <span className="font-medium text-[var(--color-text-primary)]">{p.bathroomsCount ?? 0}</span> baños
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Calculado automáticamente a partir de los espacios definidos.</p>
            </div>
          </div>
        </NumberedSection>

        <NumberedSection number="04" title="Edificio">
          {/* Infraestructura del edificio */}
          <CollapsibleSection title="Infraestructura del edificio" selectedLabel={infraLabel} expanded={infraOpen} onToggle={() => setInfraOpen(!infraOpen)}>
            <div className="space-y-4">
              <p className={HELP_CLS}>
                Los sistemas de calefacción y refrigeración se gestionan en la sección{" "}
                <TextLink href={`/properties/${propertyId}/systems`} size="sm">Sistemas</TextLink>.
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-action-primary)]" checked={hasElevator} onChange={(e) => setHasElevator(e.target.checked)} />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">El edificio tiene ascensor</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" name="hasPrivateEntrance" className="h-4 w-4 accent-[var(--color-action-primary)]" checked={hasPrivateEntrance} onChange={(e) => setHasPrivateEntrance(e.target.checked)} />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Entrada privada</span>
                <InfoTooltip text="La vivienda tiene una entrada independiente que el huésped usa sin compartir pasillos o zonas interiores con otros inquilinos o el anfitrión." />
              </label>
              <NumberStepper label="Número de plantas del edificio" value={buildingFloors} onChange={setBuildingFloors} min={1} max={200} />
            </div>
          </CollapsibleSection>
        </NumberedSection>

        {state?.error && <p className="mb-4 text-sm text-[var(--color-status-error-text)]">{state.error}</p>}

        <button type="submit" disabled={pending || !isDirty} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-5 py-2.5 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
