"use client";

import { useActionState, useState } from "react";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { saveStep2Action, type ActionResult } from "@/lib/actions/wizard.actions";
import { spanishProvinces, getItems } from "@/lib/taxonomy-loader";
import type { StepFormProps } from "@/lib/types/wizard";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/ui/location-map").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="h-48 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] flex items-center justify-center text-sm text-[var(--color-neutral-500)]">Cargando mapa...</div>,
});

const provinces = getItems(spanishProvinces);

type Step2FormProps = StepFormProps;

export function Step2Form({ sessionId, initialState, maxStepReached, snapshot, snapshotStep }: Step2FormProps) {
  const [country, setCountry] = useState((initialState.country as string) ?? "España");
  const [city, setCity] = useState((initialState.city as string) ?? "");
  const [streetAddress, setStreetAddress] = useState((initialState.streetAddress as string) ?? "");
  const [addressExtra, setAddressExtra] = useState((initialState.addressExtra as string) ?? "");
  const [province, setProvince] = useState((initialState.region as string) ?? "");
  const [postalCode, setPostalCode] = useState((initialState.postalCode as string) ?? "");
  const [timezone, setTimezone] = useState((initialState.timezone as string) ?? "Europe/Madrid");
  const [latitude, setLatitude] = useState<number | null>((initialState.latitude as number) ?? null);
  const [longitude, setLongitude] = useState<number | null>((initialState.longitude as number) ?? null);
  const [geocoding, setGeocoding] = useState(false);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveStep2Action, null);
  const fieldError = (field: string) => state?.fieldErrors?.[field]?.[0];
  const canContinue = country.trim().length > 0 && city.trim().length > 0 && streetAddress.trim().length > 0 && timezone.length > 0;

  function flashField(name: string) {
    setAutoFilled((prev) => new Set(prev).add(name));
    setTimeout(() => setAutoFilled((prev) => { const n = new Set(prev); n.delete(name); return n; }), 1500);
  }

  const autoFillCls = (name: string) => autoFilled.has(name) ? "!bg-[var(--color-primary-50)] !border-[var(--color-primary-400)]" : "";

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
        if (d?.timezone) { setTimezone(d.timezone); flashField("timezone"); }
        if (d?.provinceId) { setProvince(d.provinceId); flashField("region"); }
        if (d?.postalCode) { setPostalCode(d.postalCode); flashField("postalCode"); }
      }
    } finally {
      setGeocoding(false);
    }
  }

  function handleAddressBlur() {
    if (country.trim() && city.trim() && streetAddress.trim()) handleGeocode();
  }

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
        if (data.timezone) { setTimezone(data.timezone); flashField("timezone"); }
      }
    } catch { /* ignore reverse geocode errors */ }
  }

  return (
    <WizardShell
      currentStep={2}
      totalSteps={4}
      title="Ubicación"
      subtitle="¿Dónde está la propiedad? Introduce la dirección para ubicarla automáticamente."
      backHref={`/properties/new/step-1?sessionId=${sessionId}`}
      sessionId={sessionId}
      maxStepReached={maxStepReached}
      snapshot={snapshot}
      snapshotStep={snapshotStep}
    >
      <form action={formAction} data-wizard-form className="space-y-5">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="addressLevel" value="exact" />
        <input type="hidden" name="latitude" value={latitude ?? ""} />
        <input type="hidden" name="longitude" value={longitude ?? ""} />

        {/* Required fields */}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">País *</span>
            <input name="country" type="text" required value={country} onChange={(e) => setCountry(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)] ${autoFillCls("country")}`} />
            {fieldError("country") && <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("country")}</p>}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">Ciudad *</span>
            <input name="city" type="text" required value={city} onChange={(e) => setCity(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)] ${autoFillCls("city")}`} />
            {fieldError("city") && <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("city")}</p>}
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-[var(--foreground)]">Dirección (vía y número) *</span>
            <input name="streetAddress" type="text" required value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} onBlur={handleAddressBlur} placeholder="ej. Calle Ramón y Cajal, 17" className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)] ${autoFillCls("streetAddress")}`} />
            {fieldError("streetAddress") && <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("streetAddress")}</p>}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">Piso / Puerta</span>
            <input name="addressExtra" type="text" value={addressExtra} onChange={(e) => setAddressExtra(e.target.value)} placeholder="ej. 2º C" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)]" />
          </label>
        </div>

        {/* Search button */}
        <button
          type="button"
          disabled={geocoding || !canContinue}
          onClick={handleGeocode}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary-500)] hover:text-[var(--color-primary-700)] disabled:opacity-40 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" /></svg>
          {geocoding ? "Buscando..." : "Encontrar ubicación"}
        </button>

        {/* Map */}
        <LocationMap lat={latitude} lng={longitude} onPositionChange={handlePinMove} />
        {latitude != null && longitude != null && (
          <p className="text-xs text-[var(--color-neutral-400)]">{latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
        )}

        {/* Auto-filled fields */}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">Provincia</span>
            <select name="region" value={province} onChange={(e) => setProvince(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)] ${autoFillCls("region")}`}>
              <option value="">Seleccionar provincia</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--color-neutral-500)]">Código postal</span>
            <input name="postalCode" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)] ${autoFillCls("postalCode")}`} />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-[var(--color-neutral-500)]">Zona horaria *</span>
          <select name="timezone" required value={timezone} onChange={(e) => setTimezone(e.target.value)} className={`mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-400)] ${autoFillCls("timezone")}`}>
            {COMMON_TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.labelFull}</option>)}
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
