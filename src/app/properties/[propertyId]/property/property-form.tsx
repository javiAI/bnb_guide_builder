"use client";

import { useActionState, useState, useRef, useEffect, useMemo } from "react";
import { Search, Home, UsersRound, DoorOpen, MapPin, Plus, X, Baby, BedDouble, ArrowUpDown, type LucideIcon } from "lucide-react";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { CheckboxCardGroup, type CheckboxCardOption } from "@/components/ui/checkbox-card-group";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { NumberStepper } from "@/components/ui/number-stepper";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/field";
import { InlineEditText } from "@/components/ui/inline-edit-text";
import { roundCoord } from "@/lib/round-coord";
import { withViewTransition } from "@/lib/view-transition";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { useFormAutoSave, autoSaveSubmit } from "@/lib/use-form-auto-save";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { TextLink } from "@/components/ui/text-link";
import { savePropertyAction } from "@/lib/actions/editor.actions";
import { isSystemRelevant } from "@/lib/services/system-relevance";
import { findSystemItem } from "@/lib/taxonomy-loader";
import type { ActionResult } from "@/lib/types/action-result";
import { propertyTypes } from "@/lib/taxonomies/property-types";
import { roomTypes } from "@/lib/taxonomies/room-types";
import { spanishProvinces } from "@/lib/taxonomies/spanish-provinces";
import { propertyEnvironments } from "@/lib/taxonomies/property-environments";
import { getItems, findItem } from "@/lib/taxonomies/_helpers";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/ui/location-map").then((m) => m.LocationMap), { ssr: false, loading: () => <div className="flex h-64 items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-default)] bg-[var(--color-background-muted)] text-sm text-[var(--color-text-muted)]">Cargando mapa...</div> });

// "Otro" is no longer a selectable tile — it's a "+ Añadir otro" button. The
// `*.other` sentinels stay in the taxonomy (single-select value + export
// mapping) but are filtered out of the grid.
const propertyTypeOptions: RadioCardOption[] = getItems(propertyTypes)
  .filter((item) => item.id !== "pt.other")
  .map((item) => ({ id: item.id, label: item.label, description: item.description }));
const roomTypeOptions: RadioCardOption[] = getItems(roomTypes)
  .filter((item) => item.id !== "rt.other")
  .map((item) => ({ id: item.id, label: item.label, description: item.description }));
// Multiselect — a property can be e.g. mountain + ski + rural. No "Sin definir"
// sentinel: an empty selection IS "not defined". Custom environments are free
// labels managed separately (customEnvironmentLabels), not taxonomy items.
const environmentOptions: CheckboxCardOption[] = getItems(propertyEnvironments).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));
const provinces = getItems(spanishProvinces);

const HELP_CLS = "text-xs text-[var(--color-text-muted)]";
const MAX_TOTAL_GUESTS = 30;

// "+ Añadir otro" affordance — dashed, signals "add a custom option" without
// being a selectable tile. Shared by the type/space/environment pickers.
function AddOtherButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text-primary)]"
    >
      <Plus size={16} aria-hidden="true" />
      {label}
    </button>
  );
}

// Reusable "remove" icon-button for custom entries.
function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Quitar"
      className="recipe-icon-btn-32 grid h-8 w-8 flex-none place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-background-muted)] hover:text-[var(--color-text-secondary)]"
    >
      <X size={14} aria-hidden="true" />
    </button>
  );
}

// Feature toggle row: icon · label + helper · checkbox. The whole row is the
// (≥44) hit target. Omit `name` when submission goes through a sibling hidden
// input (e.g. the elevator's explicit true/false intent).
function ToggleRow({ icon, label, helper, checked, onChange, name, className }: {
  icon: LucideIcon;
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
  className?: string;
}) {
  return (
    <label className={`flex min-h-[44px] cursor-pointer items-center gap-3 ${className ?? ""}`}>
      <IconBadge icon={icon} tone="neutral" />
      <span className="flex-1">
        <span className="block text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
        {helper && <span className="block text-xs text-[var(--color-text-muted)]">{helper}</span>}
      </span>
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-action-primary)]" />
    </label>
  );
}

// Single custom "Otro" card (type/space): name + description, primary-tinted to
// read as the selected option, with a remove control.
function CustomOptionCard({ label, onLabelChange, desc, onDescChange, onRemove, placeholder }: {
  label: string;
  onLabelChange: (v: string) => void;
  desc: string;
  onDescChange: (v: string) => void;
  onRemove: () => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border-2 border-[var(--color-action-primary)] bg-[var(--color-interactive-selected)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Tu opción personalizada</span>
        <RemoveButton onClick={onRemove} />
      </div>
      <FieldInput label="Nombre" required value={label} onChange={(e) => onLabelChange(e.target.value)} placeholder={placeholder} />
      <FieldTextarea label="Descripción" value={desc} onChange={(e) => onDescChange(e.target.value)} rows={2} />
    </div>
  );
}

interface PropertyFormProps {
  propertyId: string;
  hasElevatorSystem: boolean;
  property: {
    propertyNickname: string;
    propertyType: string | null;
    roomType: string | null;
    propertyEnvironments: string[];
    customPropertyTypeLabel: string | null;
    customPropertyTypeDesc: string | null;
    customRoomTypeLabel: string | null;
    customRoomTypeDesc: string | null;
    customEnvironmentLabels: string[];
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

export function PropertyForm({ propertyId, hasElevatorSystem, property: p }: PropertyFormProps) {
  const [nickname, setNickname] = useState(p.propertyNickname);

  const [propertyType, setPropertyType] = useState(p.propertyType ?? "");
  const [roomType, setRoomType] = useState(p.roomType ?? "");
  const [environments, setEnvironments] = useState<string[]>(p.propertyEnvironments ?? []);
  const [customPtLabel, setCustomPtLabel] = useState(p.customPropertyTypeLabel ?? "");
  const [customPtDesc, setCustomPtDesc] = useState(p.customPropertyTypeDesc ?? "");
  const [customRtLabel, setCustomRtLabel] = useState(p.customRoomTypeLabel ?? "");
  const [customRtDesc, setCustomRtDesc] = useState(p.customRoomTypeDesc ?? "");
  // Entorno is multiselect, so several custom environments are allowed.
  const [customEnvLabels, setCustomEnvLabels] = useState<string[]>(p.customEnvironmentLabels ?? []);
  const addCustomEnv = () => withViewTransition(() => setCustomEnvLabels((l) => [...l, ""]));
  const updateCustomEnv = (i: number, v: string) => setCustomEnvLabels((l) => l.map((x, j) => (j === i ? v : x)));
  const removeCustomEnv = (i: number) => withViewTransition(() => setCustomEnvLabels((l) => l.filter((_, j) => j !== i)));
  // Classification accordion: at most one picker open at a time (the rest show
  // their selected value as a summary). Default: all collapsed.
  const [openPicker, setOpenPicker] = useState<"propertyType" | "roomType" | "environment" | null>(null);
  const [country, setCountry] = useState(p.country ?? "España");
  const [city, setCity] = useState(p.city ?? "");
  const [province, setProvince] = useState(p.region ?? "");
  // The address is a single full field now (no separate Piso/Puerta) — merge any
  // legacy addressExtra into it on load; addressExtra is then cleared on save.
  const [streetAddress, setStreetAddress] = useState(
    [p.streetAddress, p.addressExtra].map((s) => s?.trim()).filter(Boolean).join(", "),
  );
  const [postalCode, setPostalCode] = useState(p.postalCode ?? "");
  const [timezone, setTimezone] = useState(p.timezone ?? "Europe/Madrid");
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [latitude, setLatitude] = useState<number | null>(p.latitude != null ? roundCoord(p.latitude) : null);
  const [longitude, setLongitude] = useState<number | null>(p.longitude != null ? roundCoord(p.longitude) : null);
  const [geocoding, setGeocoding] = useState(false);
  // Capacity follows the industry-standard model: adults + children counters,
  // total derived from their sum (no separate "total" control). Submitted via a
  // hidden maxGuests input; self-heals any legacy row where maxGuests drifted
  // from maxAdults + maxChildren.
  const [maxAdults, setMaxAdults] = useState(Math.max(1, p.maxAdults));
  const [maxChildren, setMaxChildren] = useState(Math.max(0, p.maxChildren));
  const totalGuests = maxAdults + maxChildren;
  const [infantsAllowed, setInfantsAllowed] = useState(p.infantsAllowed);
  const [hasPrivateEntrance, setHasPrivateEntrance] = useState(p.hasPrivateEntrance);

  const infra = (p.infrastructureJson as { buildingFloors?: number } | null) ?? {};
  const [buildingFloors, setBuildingFloors] = useState<number>(infra.buildingFloors ?? 1);
  // Elevator existence mirrors the `sys.elevator` system (single source).
  const [hasElevator, setHasElevator] = useState<boolean>(hasElevatorSystem);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePropertyAction, null);

  // Elevator relevance (config-driven, FUTURE §28): the `sys.elevator` taxonomy
  // item carries a `relevantWhen` rule (not a house & multi-floor). Evaluating
  // it here gates the checkbox so the option only appears when it makes sense —
  // the same engine + rule the future system-wide rollout will use.
  const elevatorRelevant = useMemo(() => {
    const item = findSystemItem("sys.elevator");
    if (!item) return false;
    return isSystemRelevant(item, {
      property: { id: propertyId, propertyType: propertyType || null, buildingFloors },
      spaces: [],
      systems: [],
      amenities: [],
    });
  }, [propertyId, propertyType, buildingFloors]);

  // Auto-save: edits persist as you make them (no "Guardar" button). The hook
  // reads the form's live FormData, so every control is captured generically.
  const formRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(formRef);

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
    setLatitude(roundCoord(lat));
    setLongitude(roundCoord(lng));
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

  // Geocoding runs ONLY when the operator clicks "Encontrar ubicación" — never
  // automatically. Auto-geocoding on blur fought manual edits (e.g. clearing the
  // provincia) by re-deriving + re-saving them, which read as a glitchy loop.
  async function handleGeocode() {
    // País + Ciudad + Dirección son obligatorios para una búsqueda determinista.
    if (geocoding || !country.trim() || !city.trim() || !streetAddress.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch("/api/geo/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streetAddress: streetAddress || undefined, city, country }),
      });
      const data = await res.json();
      if (data.matchFound) {
        setLatitude(roundCoord(data.lat));
        setLongitude(roundCoord(data.lng));
        const d = data.derived;
        if (d?.timezone && COMMON_TIMEZONES.some((tz) => tz.value === d.timezone)) { setTimezone(d.timezone); flashField("timezone"); }
        if (d?.provinceId) { setProvince(d.provinceId); flashField("region"); }
        if (d?.postalCode) { setPostalCode(d.postalCode); flashField("postalCode"); }
      }
    } catch { /* geocode error — ignore, user can retry */ } finally {
      setGeocoding(false);
    }
  }

  const ptLabel = propertyType === "pt.other" ? (customPtLabel || "Otro") : findItem(propertyTypes, propertyType)?.label ?? "Sin definir";
  const rtLabel = roomType === "rt.other" ? (customRtLabel || "Otro") : findItem(roomTypes, roomType)?.label ?? "Sin definir";
  const envParts = [
    ...environments.map((id) => findItem(propertyEnvironments, id)?.label),
    ...customEnvLabels.map((l) => l.trim()).filter(Boolean),
  ].filter(Boolean);
  const envLabel = envParts.length > 0 ? envParts.join(", ") : "Sin definir";

  // Accordion: opening a picker collapses the others; clicking the open one closes it.
  const togglePicker = (key: "propertyType" | "roomType" | "environment") =>
    setOpenPicker((cur) => (cur === key ? null : key));

  return (
    <div>
      <PageHeader
        eyebrow="Datos básicos"
        title={
          <InlineEditText
            value={nickname}
            onCommit={setNickname}
            placeholder="Nombre de la propiedad"
            ariaLabel="Nombre de la propiedad"
            textClassName="text-[22px] font-semibold leading-[1.15] tracking-[-0.015em] sm:text-[28px]"
            iconSize={20}
          />
        }
        description="Clasificación, ubicación, capacidad e infraestructura. Estos datos definen la base de la guía y alimentan el resto de secciones."
        actions={<AutoSaveStatus pending={pending} />}
        chips={
          <>
            <PageHeaderChip icon={Home} label="Tipo" value={ptLabel} />
            <PageHeaderChip icon={DoorOpen} label="Espacio" value={rtLabel} />
            <PageHeaderChip icon={UsersRound} label="Capacidad" value={`${totalGuests} huéspedes`} />
            {city.trim() && <PageHeaderChip icon={MapPin} label="Ubicación" value={city} />}
          </>
        }
      />

      <form ref={formRef} onSubmit={autoSaveSubmit(formAction)}>
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="propertyType" value={propertyType} />
        <input type="hidden" name="roomType" value={roomType} />
        {environments.map((env) => (
          <input key={`env-${env}`} type="hidden" name="propertyEnvironments" value={env} />
        ))}
        <input type="hidden" name="customPropertyTypeLabel" value={customPtLabel} />
        <input type="hidden" name="customPropertyTypeDesc" value={customPtDesc} />
        <input type="hidden" name="customRoomTypeLabel" value={customRtLabel} />
        <input type="hidden" name="customRoomTypeDesc" value={customRtDesc} />
        {customEnvLabels.map((l, i) => (l.trim() ? <input key={`cenv-${i}`} type="hidden" name="customEnvironmentLabels" value={l} /> : null))}
        {/* infrastructureJson owns exactly { buildingFloors } — always sent so the
            serialised form is stable across saves (no mount/unmount diff loop). */}
        <input type="hidden" name="infrastructureJson" value={JSON.stringify({ buildingFloors })} />
        {/* Property name is edited inline in the page title above. */}
        <input type="hidden" name="propertyNickname" value={nickname} />

        <NumberedSection number="01" title="Clasificación">
          <div className="space-y-2">
            <CollapsibleSection title="Tipo de propiedad" selectedLabel={ptLabel} expanded={openPicker === "propertyType"} onToggle={() => togglePicker("propertyType")}>
              <p className={`mb-3 ${HELP_CLS}`}>¿Qué clase de alojamiento es? Define la base de la guía.</p>
              <div className="space-y-3">
                <RadioCardGroup name="_propertyType" options={propertyTypeOptions} value={propertyType} onChange={setPropertyType} showRecommended={false} layout="grid" />
                {propertyType === "pt.other" ? (
                  <CustomOptionCard label={customPtLabel} onLabelChange={setCustomPtLabel} desc={customPtDesc} onDescChange={setCustomPtDesc} onRemove={() => withViewTransition(() => setPropertyType(""))} placeholder="ej. Casa flotante" />
                ) : (
                  <AddOtherButton label="Añadir otro tipo" onClick={() => withViewTransition(() => setPropertyType("pt.other"))} />
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Tipo de espacio" selectedLabel={rtLabel} expanded={openPicker === "roomType"} onToggle={() => togglePicker("roomType")}>
              <p className={`mb-3 ${HELP_CLS}`}>¿El huésped reserva el alojamiento entero o una habitación?</p>
              <div className="space-y-3">
                <RadioCardGroup name="_roomType" options={roomTypeOptions} value={roomType} onChange={setRoomType} showRecommended={false} layout="grid" />
                {roomType === "rt.other" ? (
                  <CustomOptionCard label={customRtLabel} onLabelChange={setCustomRtLabel} desc={customRtDesc} onDescChange={setCustomRtDesc} onRemove={() => withViewTransition(() => setRoomType(""))} placeholder="ej. Cápsula" />
                ) : (
                  <AddOtherButton label="Añadir otro tipo de espacio" onClick={() => withViewTransition(() => setRoomType("rt.other"))} />
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Entorno" selectedLabel={envLabel} expanded={openPicker === "environment"} onToggle={() => togglePicker("environment")}>
              <p className={`mb-3 ${HELP_CLS}`}>Selecciona todos los que apliquen — ayuda a filtrar equipamiento y opciones relevantes. Déjalo vacío si ninguno encaja.</p>
              <div className="space-y-3">
                <CheckboxCardGroup name="_environments" options={environmentOptions} value={environments} onChange={setEnvironments} showRecommended={false} layout="grid" />
                {customEnvLabels.map((lbl, i) => (
                  <div key={`ce-${i}`} className="flex items-start gap-2 rounded-[var(--radius-lg)] border-2 border-[var(--color-action-primary)] bg-[var(--color-interactive-selected)] p-3">
                    <div className="min-w-0 flex-1">
                      <FieldInput label="Entorno personalizado" required value={lbl} onChange={(e) => updateCustomEnv(i, e.target.value)} placeholder="ej. Desierto" />
                    </div>
                    <div className="pt-6"><RemoveButton onClick={() => removeCustomEnv(i)} /></div>
                  </div>
                ))}
                <AddOtherButton label="Añadir otro entorno" onClick={addCustomEnv} />
              </div>
            </CollapsibleSection>
          </div>
        </NumberedSection>

        <NumberedSection number="02" title="Ubicación">
          <div className="space-y-4">
            {/* Address block in postal order: país/ciudad → provincia/CP → calle.
                Provincia + CP sit beside Ciudad (geographically related) and are
                auto-filled by geocoding (muted labels + flash) but editable. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldInput label="País" required name="country" value={country} onChange={(e) => setCountry(e.target.value)} className={autoFillCls("country")} />
              <FieldInput label="Ciudad" required name="city" value={city} onChange={(e) => setCity(e.target.value)} className={autoFillCls("city")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldSelect label="Provincia" labelTone="muted" name="region" value={province} onChange={(e) => setProvince(e.target.value)} className={autoFillCls("region")}>
                <option value="">Seleccionar</option>
                {provinces.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
              </FieldSelect>
              <FieldInput label="Código postal" labelTone="muted" name="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={autoFillCls("postalCode")} />
            </div>
            <FieldInput label="Dirección" required name="streetAddress" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="ej. Calle Ramón y Cajal 17, 2º C" help="Dirección completa: vía, número y, si aplica, piso/puerta." />
            {/* Piso/Puerta merged into the full address above — clear the legacy column on save. */}
            <input type="hidden" name="addressExtra" value="" />
            <input type="hidden" name="addressLevel" value={p.addressLevel ?? "exact"} />
            <input type="hidden" name="latitude" value={latitude ?? ""} />
            <input type="hidden" name="longitude" value={longitude ?? ""} />

            <button type="button" disabled={geocoding || !country.trim() || !city.trim() || !streetAddress.trim()} onClick={handleGeocode} className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] hover:underline disabled:opacity-40">
              <Search size={14} aria-hidden="true" />
              {geocoding ? "Buscando..." : "Encontrar ubicación"}
            </button>

            <LocationMap lat={latitude} lng={longitude} onPositionChange={handlePinMove} />
            {latitude != null && longitude != null && (
              <p className="text-xs text-[var(--color-text-muted)]">{latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
            )}

            {/* Timezone is derived from país/coords on geocode — editable, not required. */}
            <FieldSelect label="Zona horaria" labelTone="muted" name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={autoFillCls("timezone")}>
              {COMMON_TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </FieldSelect>
          </div>
        </NumberedSection>

        <NumberedSection number="03" title="Capacidad">
          <div className="space-y-4">
            {/* Aforo — adults + children counters; total is their live sum. */}
            <Card variant="overview">
              <div className="flex items-center gap-2">
                <IconBadge icon={UsersRound} tone="primary" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Aforo de huéspedes</h3>
                <InfoTooltip text="Debe haber al menos 1 adulto. Los bebés menores de 2 años no cuentan en el aforo." />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <NumberStepper layout="stacked" label="Adultos" name="maxAdults" value={maxAdults} onChange={setMaxAdults} min={1} max={MAX_TOTAL_GUESTS - maxChildren} />
                <NumberStepper layout="stacked" label="Niños (−14)" name="maxChildren" value={maxChildren} onChange={setMaxChildren} min={0} max={MAX_TOTAL_GUESTS - maxAdults} />
              </div>

              {/* Derived total — the result of adults + children. */}
              <div className="mt-3 flex items-baseline justify-between border-t border-[var(--color-border-default)] pt-3">
                <span className="text-sm text-[var(--color-text-secondary)]">Aforo total</span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  <span className="text-base font-semibold text-[var(--color-text-primary)]">{totalGuests}</span> huéspedes
                </span>
              </div>
              <input type="hidden" name="maxGuests" value={totalGuests} />

              <ToggleRow
                icon={Baby}
                label="Se admiten bebés (cuna disponible)"
                helper="No cuentan en el aforo."
                name="infantsAllowed"
                checked={infantsAllowed}
                onChange={setInfantsAllowed}
                className="mt-3 border-t border-[var(--color-border-default)] pt-3"
              />
            </Card>

            {/* Dormitorios y baños — derived (read-only) from Espacios. */}
            <Card variant="overview">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <IconBadge icon={BedDouble} tone="neutral" />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Dormitorios y baños</h3>
                </div>
                <TextLink href={`/properties/${propertyId}/spaces`} size="sm" arrow>
                  Gestionar espacios
                </TextLink>
              </div>
              <div className="mt-3 flex gap-8">
                <div>
                  <p className="text-xl font-semibold text-[var(--color-text-primary)]">{p.bedroomsCount ?? 0}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">dormitorios</p>
                </div>
                <div>
                  <p className="text-xl font-semibold text-[var(--color-text-primary)]">{p.bathroomsCount ?? 0}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">baños</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">Calculado automáticamente a partir de los espacios definidos.</p>
            </Card>
          </div>
        </NumberedSection>

        <NumberedSection number="04" title="Edificio">
          <div className="space-y-4">
            <NumberStepper label="Plantas del edificio" value={buildingFloors} onChange={setBuildingFloors} min={1} max={200} />

            {/* Building features — consistent toggle rows (icon · label · helper · check). */}
            <Card variant="overview">
              <div className="space-y-3">
                {elevatorRelevant && (
                  <div>
                    <ToggleRow
                      icon={ArrowUpDown}
                      label="El edificio tiene ascensor"
                      helper="Se guarda en los sistemas del edificio."
                      checked={hasElevator}
                      onChange={setHasElevator}
                    />
                    <input type="hidden" name="hasElevator" value={hasElevator ? "true" : "false"} />
                    {hasElevator && (
                      <p className={`mt-1 pl-[42px] ${HELP_CLS}`}>
                        Detalles opcionales (ubicación, llave, plantas) en{" "}
                        <TextLink href={`/properties/${propertyId}/systems`} size="sm">Sistemas</TextLink>.
                      </p>
                    )}
                  </div>
                )}

                <ToggleRow
                  icon={DoorOpen}
                  label="Entrada privada"
                  helper="Entrada independiente, sin zonas compartidas con otros inquilinos o el anfitrión."
                  name="hasPrivateEntrance"
                  checked={hasPrivateEntrance}
                  onChange={setHasPrivateEntrance}
                  className={elevatorRelevant ? "border-t border-[var(--color-border-default)] pt-3" : ""}
                />
              </div>
            </Card>
          </div>
        </NumberedSection>

        {state?.error && <p className="text-sm text-[var(--color-status-error-text)]">{state.error}</p>}
      </form>
    </div>
  );
}
