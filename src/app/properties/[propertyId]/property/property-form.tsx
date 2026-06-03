"use client";

import { useActionState, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Pencil, Search, Home, UsersRound } from "lucide-react";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { CheckboxCardGroup, type CheckboxCardOption } from "@/components/ui/checkbox-card-group";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { NumberStepper } from "@/components/ui/number-stepper";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { useFormAutoSave } from "@/lib/use-form-auto-save";
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

const propertyTypeOptions: RadioCardOption[] = getItems(propertyTypes).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));
const roomTypeOptions: RadioCardOption[] = getItems(roomTypes).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));
// Multiselect — a property can be e.g. mountain + ski + rural. No "Sin definir"
// sentinel: an empty selection IS "not defined". `env.other` carries a free label.
const environmentOptions: CheckboxCardOption[] = getItems(propertyEnvironments).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));
const provinces = getItems(spanishProvinces);

const HELP_CLS = "text-xs text-[var(--color-text-muted)]";

// "Otro (especifica)" fields — rendered *inside* the selected "Otro" tile (via
// the card group's `renderExpanded`), so the form reveals in place, no detached
// box. The tile supplies the border/tint + a top divider. `nameOnly` drops the
// description (environments only need a label).
function OtherDetailsFields({
  label,
  onLabelChange,
  desc,
  onDescChange,
  nameOnly,
  placeholder,
}: {
  label: string;
  onLabelChange: (value: string) => void;
  desc?: string;
  onDescChange?: (value: string) => void;
  nameOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-3">
      <FieldInput label="Nombre" required value={label} onChange={(e) => onLabelChange(e.target.value)} placeholder={placeholder} />
      {!nameOnly && onDescChange && (
        <FieldTextarea label="Descripción" value={desc ?? ""} onChange={(e) => onDescChange(e.target.value)} rows={2} />
      )}
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
    customEnvironmentLabel: string | null;
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
  const [editingName, setEditingName] = useState(false);
  const [nickname, setNickname] = useState(p.propertyNickname);

  const [propertyType, setPropertyType] = useState(p.propertyType ?? "");
  const [roomType, setRoomType] = useState(p.roomType ?? "");
  const [environments, setEnvironments] = useState<string[]>(p.propertyEnvironments ?? []);
  const [customPtLabel, setCustomPtLabel] = useState(p.customPropertyTypeLabel ?? "");
  const [customPtDesc, setCustomPtDesc] = useState(p.customPropertyTypeDesc ?? "");
  const [customRtLabel, setCustomRtLabel] = useState(p.customRoomTypeLabel ?? "");
  const [customRtDesc, setCustomRtDesc] = useState(p.customRoomTypeDesc ?? "");
  const [customEnvLabel, setCustomEnvLabel] = useState(p.customEnvironmentLabel ?? "");
  // Classification accordion: at most one picker open at a time (the rest show
  // their selected value as a summary). Default: all collapsed.
  const [openPicker, setOpenPicker] = useState<"propertyType" | "roomType" | "environment" | null>(null);
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

  const infra = (p.infrastructureJson as { buildingFloors?: number } | null) ?? {};
  const [buildingFloors, setBuildingFloors] = useState<number>(infra.buildingFloors ?? 1);
  // Elevator existence mirrors the `sys.elevator` system (single source).
  const [hasElevator, setHasElevator] = useState<boolean>(hasElevatorSystem);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePropertyAction, null);

  // Only send infrastructureJson when buildingFloors changed — avoids
  // overwriting any other infra keys on unrelated saves.
  const infraDirty = buildingFloors !== (infra.buildingFloors ?? 1);

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
  const envLabel = environments.length > 0
    ? environments
        .map((id) => (id === "env.other" ? (customEnvLabel || "Otro") : findItem(propertyEnvironments, id)?.label))
        .filter(Boolean)
        .join(", ")
    : "Sin definir";

  // Accordion: opening a picker collapses the others; clicking the open one closes it.
  const togglePicker = (key: "propertyType" | "roomType" | "environment") =>
    setOpenPicker((cur) => (cur === key ? null : key));

  return (
    <div>
      <PageHeader
        eyebrow="Datos básicos"
        title={nickname}
        description="Clasificación, ubicación, capacidad e infraestructura. Estos datos definen la base de la guía y alimentan el resto de secciones."
        actions={<AutoSaveStatus pending={pending} />}
        chips={
          <>
            <PageHeaderChip icon={Home} label="Tipo" value={ptLabel} />
            <PageHeaderChip icon={UsersRound} label="Capacidad" value={`${maxGuests} huéspedes`} />
          </>
        }
      />

      <form ref={formRef} action={formAction}>
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
        <input type="hidden" name="customEnvironmentLabel" value={customEnvLabel} />
        {/* Only send infrastructureJson when buildingFloors changed — avoids overwriting existing JSON keys on unrelated saves */}
        {infraDirty && (
          <input type="hidden" name="infrastructureJson" value={JSON.stringify({ buildingFloors })} />
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
              <button type="button" onClick={() => setEditingName(true)} className="group flex min-h-[44px] w-full items-center justify-between rounded-[var(--radius-md)] px-1 py-2 text-left transition-colors hover:bg-[var(--color-interactive-hover)]">
                <span className="text-lg font-bold text-[var(--color-text-primary)]">{nickname}</span>
                <Pencil size={16} aria-hidden="true" className="text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-action-primary)]" />
              </button>
              <input type="hidden" name="propertyNickname" value={nickname} />
            </>
          )}
        </div>

        <NumberedSection number="01" title="Clasificación">
          <div className="space-y-2">
            <CollapsibleSection title="Tipo de propiedad" selectedLabel={ptLabel} expanded={openPicker === "propertyType"} onToggle={() => togglePicker("propertyType")}>
              <p className={`mb-3 ${HELP_CLS}`}>¿Qué clase de alojamiento es? Define la base de la guía.</p>
              <RadioCardGroup
                name="_propertyType"
                options={propertyTypeOptions}
                value={propertyType}
                onChange={setPropertyType}
                showRecommended={false}
                layout="grid"
                renderExpanded={(id) =>
                  id === "pt.other" ? (
                    <OtherDetailsFields label={customPtLabel} onLabelChange={setCustomPtLabel} desc={customPtDesc} onDescChange={setCustomPtDesc} placeholder="ej. Casa flotante" />
                  ) : null
                }
              />
            </CollapsibleSection>

            <CollapsibleSection title="Tipo de espacio" selectedLabel={rtLabel} expanded={openPicker === "roomType"} onToggle={() => togglePicker("roomType")}>
              <p className={`mb-3 ${HELP_CLS}`}>¿El huésped reserva el alojamiento entero o una habitación?</p>
              <RadioCardGroup
                name="_roomType"
                options={roomTypeOptions}
                value={roomType}
                onChange={setRoomType}
                showRecommended={false}
                layout="grid"
                renderExpanded={(id) =>
                  id === "rt.other" ? (
                    <OtherDetailsFields label={customRtLabel} onLabelChange={setCustomRtLabel} desc={customRtDesc} onDescChange={setCustomRtDesc} placeholder="ej. Cápsula" />
                  ) : null
                }
              />
            </CollapsibleSection>

            <CollapsibleSection title="Entorno" selectedLabel={envLabel} expanded={openPicker === "environment"} onToggle={() => togglePicker("environment")}>
              <p className={`mb-3 ${HELP_CLS}`}>Selecciona todos los que apliquen — ayuda a filtrar equipamiento y opciones relevantes. Déjalo vacío si ninguno encaja.</p>
              <CheckboxCardGroup
                name="_environments"
                options={environmentOptions}
                value={environments}
                onChange={setEnvironments}
                showRecommended={false}
                layout="grid"
                renderExpanded={(id) =>
                  id === "env.other" ? (
                    <OtherDetailsFields label={customEnvLabel} onLabelChange={setCustomEnvLabel} nameOnly placeholder="ej. Desierto" />
                  ) : null
                }
              />
            </CollapsibleSection>
          </div>
        </NumberedSection>

        <NumberedSection number="02" title="Ubicación">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldInput label="País" required name="country" value={country} onChange={(e) => setCountry(e.target.value)} className={autoFillCls("country")} />
              <FieldInput label="Ciudad" required name="city" value={city} onChange={(e) => setCity(e.target.value)} className={autoFillCls("city")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <FieldInput label="Dirección (vía y número)" required name="streetAddress" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} onBlur={handleAddressBlur} placeholder="ej. Calle Ramón y Cajal, 17" />
              </div>
              <FieldInput label="Piso / Puerta" name="addressExtra" value={addressExtra} onChange={(e) => setAddressExtra(e.target.value)} placeholder="ej. 2º C" />
            </div>
            <input type="hidden" name="addressLevel" value={p.addressLevel ?? "exact"} />
            <input type="hidden" name="latitude" value={latitude ?? ""} />
            <input type="hidden" name="longitude" value={longitude ?? ""} />

            <button type="button" disabled={geocoding || !streetAddress.trim() || !city.trim()} onClick={handleGeocode} className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] hover:underline disabled:opacity-40">
              <Search size={14} aria-hidden="true" />
              {geocoding ? "Buscando..." : "Encontrar ubicación"}
            </button>

            <LocationMap lat={latitude} lng={longitude} onPositionChange={handlePinMove} />
            {latitude != null && longitude != null && (
              <p className="text-xs text-[var(--color-text-muted)]">{latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldSelect label="Provincia" labelTone="muted" name="region" value={province} onChange={(e) => setProvince(e.target.value)} className={autoFillCls("region")}>
                <option value="">Seleccionar</option>
                {provinces.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
              </FieldSelect>
              <FieldInput label="Código postal" labelTone="muted" name="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={autoFillCls("postalCode")} />
            </div>
            <FieldSelect label="Zona horaria" labelTone="muted" required name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={autoFillCls("timezone")}>
              {COMMON_TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </FieldSelect>
          </div>
        </NumberedSection>

        <NumberedSection number="03" title="Capacidad">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Máximo de huéspedes</span>
                <InfoTooltip text="Define el máximo total de huéspedes. Siempre debe haber al menos 1 adulto. Los adultos adicionales representan plazas flexibles: cada una puede ser ocupada por un adulto o un niño. Si seleccionas niños, esas plazas solo pueden ser ocupadas por menores de 14 años." />
              </div>
              <NumberStepper label="Máximo de huéspedes" name="maxGuests" value={maxGuests} onChange={handleMaxGuestsChange} min={1} max={30} />
              <div className="ml-4 space-y-2 border-l-2 border-[var(--color-border-default)] pl-4">
                <NumberStepper label="Número máximo de adultos" name="maxAdults" value={maxAdults} onChange={handleMaxAdultsChange} min={1} max={maxGuests} />
                <NumberStepper label="Niños (menores de 14 años)" name="maxChildren" value={maxChildren} onChange={handleMaxChildrenChange} min={0} max={maxGuests - 1} />
              </div>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
                <input type="checkbox" name="infantsAllowed" checked={infantsAllowed} onChange={(e) => setInfantsAllowed(e.target.checked)} className="h-4 w-4 accent-[var(--color-action-primary)]" />
                <span className="text-sm text-[var(--color-text-primary)]">Se admiten bebés (cuna disponible)</span>
                <InfoTooltip text="Los bebés menores de 2 años no cuentan como huéspedes." />
              </label>
            </div>

            {/* Habitaciones y baños — derivados de Espacios */}
            <Card variant="overview">
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
            </Card>
          </div>
        </NumberedSection>

        <NumberedSection number="04" title="Edificio">
          <div className="space-y-4">
            <NumberStepper label="Número de plantas del edificio" value={buildingFloors} onChange={setBuildingFloors} min={1} max={200} />

            {elevatorRelevant && (
              <div className="space-y-2">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-action-primary)]" checked={hasElevator} onChange={(e) => setHasElevator(e.target.checked)} />
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">El edificio tiene ascensor</span>
                  <InfoTooltip text="Marca si el edificio dispone de ascensor. Se guarda como parte de los sistemas del edificio; los detalles opcionales (ubicación, si requiere llave, plantas que cubre) se configuran en la sección Sistemas." />
                </label>
                <input type="hidden" name="hasElevator" value={hasElevator ? "true" : "false"} />
                {hasElevator && (
                  <p className={`pl-6 ${HELP_CLS}`}>
                    Detalles opcionales (ubicación, llave, plantas) en{" "}
                    <TextLink href={`/properties/${propertyId}/systems`} size="sm">Sistemas</TextLink>.
                  </p>
                )}
              </div>
            )}

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
              <input type="checkbox" name="hasPrivateEntrance" className="h-4 w-4 accent-[var(--color-action-primary)]" checked={hasPrivateEntrance} onChange={(e) => setHasPrivateEntrance(e.target.checked)} />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Entrada privada</span>
              <InfoTooltip text="La vivienda tiene una entrada independiente que el huésped usa sin compartir pasillos o zonas interiores con otros inquilinos o el anfitrión." />
            </label>
          </div>
        </NumberedSection>

        {state?.error && <p className="text-sm text-[var(--color-status-error-text)]">{state.error}</p>}
      </form>
    </div>
  );
}
