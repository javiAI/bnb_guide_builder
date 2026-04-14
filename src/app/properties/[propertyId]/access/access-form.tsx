"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CheckboxCardGroup, type CheckboxCardOption } from "@/components/ui/checkbox-card-group";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { saveAccessAction, type ActionResult } from "@/lib/actions/editor.actions";
import { accessMethods, buildingAccessMethods, parkingOptions, accessibilityFeatures, getItems, findItem } from "@/lib/taxonomy-loader";

const AUTONOMOUS_BUILDING_IDS = ["ba.portal_code", "ba.access_link", "ba.intercom_auto", "ba.lockbox", "ba.intercom_host", "ba.open_access"];
const AUTONOMOUS_UNIT_IDS = ["am.smart_lock", "am.keypad", "am.lockbox"];

function getBuildingOptions(autonomous: boolean): CheckboxCardOption[] {
  const all = getItems(buildingAccessMethods);
  const filtered = autonomous
    ? all.filter((item) => AUTONOMOUS_BUILDING_IDS.includes(item.id) || item.id === "ba.other")
    : all;
  return filtered.map((item) => ({ id: item.id, label: item.label, description: item.description, recommended: item.recommended }));
}

function getUnitOptions(autonomous: boolean): CheckboxCardOption[] {
  const all = getItems(accessMethods);
  const filtered = autonomous
    ? all.filter((item) => AUTONOMOUS_UNIT_IDS.includes(item.id) || item.id === "am.other")
    : all;
  return filtered.map((item) => ({ id: item.id, label: item.label, description: item.description, recommended: item.recommended }));
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const YES_NO_OPTIONS: RadioCardOption[] = [
  { id: "yes", label: "Sí", description: "" },
  { id: "no", label: "No", description: "" },
];

interface AccessFormProps {
  propertyId: string;
  property: {
    checkInStart: string | null;
    checkInEnd: string | null;
    checkOutTime: string | null;
    isAutonomousCheckin: boolean;
    hasBuildingAccess: boolean;
    buildingAccess: { methods: string[]; customLabel?: string; customDesc?: string } | null;
    unitAccess: { methods: string[]; customLabel?: string; customDesc?: string } | null;
    parkingTypes: string[];
    accessibilityFeatures: string[];
  };
}

export function AccessForm({ propertyId, property: p }: AccessFormProps) {
  const [isAutonomous, setIsAutonomous] = useState<string>(p.isAutonomousCheckin ? "yes" : "no");
  const [hasBuildingAccess, setHasBuildingAccess] = useState<string>(p.hasBuildingAccess ? "yes" : "no");
  const [buildingMethods, setBuildingMethods] = useState<string[]>(p.buildingAccess?.methods ?? []);
  const [unitMethods, setUnitMethods] = useState<string[]>(p.unitAccess?.methods ?? []);
  const [parkingTypes, setParkingTypes] = useState<string[]>(p.parkingTypes);
  const [axFeatures, setAxFeatures] = useState<string[]>(p.accessibilityFeatures);
  const [checkInEnd, setCheckInEnd] = useState(p.checkInEnd ?? "22:00");

  const [hoursOpen, setHoursOpen] = useState(true);
  const [typeOpen, setTypeOpen] = useState(false);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [parkingOpen, setParkingOpen] = useState(false);
  const [axOpen, setAxOpen] = useState(false);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveAccessAction, null);

  // Dirty tracking
  const isDirty = isAutonomous !== (p.isAutonomousCheckin ? "yes" : "no") ||
    hasBuildingAccess !== (p.hasBuildingAccess ? "yes" : "no") ||
    JSON.stringify(buildingMethods) !== JSON.stringify(p.buildingAccess?.methods ?? []) ||
    JSON.stringify(unitMethods) !== JSON.stringify(p.unitAccess?.methods ?? []) ||
    JSON.stringify(parkingTypes) !== JSON.stringify(p.parkingTypes) ||
    JSON.stringify(axFeatures) !== JSON.stringify(p.accessibilityFeatures) ||
    checkInEnd !== (p.checkInEnd ?? "22:00");

  const autonomousMode = isAutonomous === "yes";
  const showBuilding = hasBuildingAccess === "yes";
  const buildingOptions = getBuildingOptions(autonomousMode);
  const unitOptions = getUnitOptions(autonomousMode);

  function handleAutonomousChange(val: string) {
    setIsAutonomous(val);
    if (val === "yes") setCheckInEnd("flexible");
  }

  const hoursLabel = p.checkInStart ? `${p.checkInStart} — ${checkInEnd === "flexible" ? "Flexible" : checkInEnd} · Salida ${p.checkOutTime ?? "—"}` : "Sin definir";
  const typeLabel = `Autónomo: ${isAutonomous === "yes" ? "Sí" : "No"} · Edificio: ${hasBuildingAccess === "yes" ? "Sí" : "No"}`;
  const buildingLabel = buildingMethods.length > 0 ? buildingMethods.map((id) => findItem(buildingAccessMethods, id)?.label ?? id).join(", ") : "Sin definir";
  const unitLabel = unitMethods.length > 0 ? unitMethods.map((id) => findItem(accessMethods, id)?.label ?? id).join(", ") : "Sin definir";
  const parkingLabel = parkingTypes.length > 0 ? parkingTypes.map((id) => findItem(parkingOptions, id)?.label ?? id).join(", ") : "Sin definir";
  const parkingOpts: CheckboxCardOption[] = getItems(parkingOptions).map((item) => ({ id: item.id, label: item.label, description: item.description, recommended: item.recommended }));
  const axOpts: CheckboxCardOption[] = getItems(accessibilityFeatures).map((item) => ({ id: item.id, label: item.label, description: item.description, recommended: item.recommended }));
  const axLabel = axFeatures.length > 0 ? axFeatures.map((id) => findItem(accessibilityFeatures, id)?.label ?? id).join(", ") : "Ninguna";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href={`/properties/${propertyId}`} className="text-xs text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]">&larr; Volver al panel</Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Acceso y check-in</h1>
        </div>
        <InlineSaveStatus status={pending ? "saving" : state?.success ? "saved" : state?.error ? "error" : "saved"} />
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="isAutonomousCheckin" value={isAutonomous === "yes" ? "true" : "false"} />
        <input type="hidden" name="hasBuildingAccess" value={hasBuildingAccess === "yes" ? "true" : "false"} />
        {buildingMethods.map((m) => <input key={`bm-${m}`} type="hidden" name="buildingMethods" value={m} />)}
        {unitMethods.map((m) => <input key={`um-${m}`} type="hidden" name="unitMethods" value={m} />)}
        {parkingTypes.map((m) => <input key={`pk-${m}`} type="hidden" name="parkingTypes" value={m} />)}
        {axFeatures.map((m) => <input key={`ax-${m}`} type="hidden" name="accessibilityFeatures" value={m} />)}

        {/* Horarios */}
        <CollapsibleSection title="Horarios" selectedLabel={hoursLabel} expanded={hoursOpen} onToggle={() => setHoursOpen(!hoursOpen)}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs text-[var(--color-neutral-500)]">Check-in desde *</span>
              <select name="checkInStart" required defaultValue={p.checkInStart ?? "16:00"} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm focus:border-[var(--color-primary-400)] focus:outline-none">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-neutral-500)]">Check-in hasta *</span>
              <select name="checkInEnd" required value={checkInEnd} onChange={(e) => setCheckInEnd(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm focus:border-[var(--color-primary-400)] focus:outline-none">
                <option value="flexible">Sin límite (flexible)</option>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-neutral-500)]">Check-out *</span>
              <select name="checkOutTime" required defaultValue={p.checkOutTime ?? "11:00"} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm focus:border-[var(--color-primary-400)] focus:outline-none">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </CollapsibleSection>

        {/* Tipo de acceso */}
        <CollapsibleSection title="Tipo de acceso" selectedLabel={typeLabel} expanded={typeOpen} onToggle={() => setTypeOpen(!typeOpen)}>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium">¿El acceso es completamente autónomo? <InfoTooltip text="Un acceso completamente autónomo significa que el huésped puede entrar sin necesitar a nadie presente: mediante código, cerradura digital, caja de llaves, etc." /></h3>
              <RadioCardGroup name="_autonomousQ" options={YES_NO_OPTIONS} value={isAutonomous} onChange={handleAutonomousChange} showRecommended={false} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">¿La propiedad está dentro de un recinto, edificio o comunidad cerrada? <InfoTooltip text="Si el huésped necesita pasar por un portal, puerta de comunidad o recinto antes de llegar a la vivienda, selecciona Sí." /></h3>
              <RadioCardGroup name="_buildingQ" options={YES_NO_OPTIONS} value={hasBuildingAccess} onChange={setHasBuildingAccess} showRecommended={false} />
            </div>
          </div>
        </CollapsibleSection>

        {/* Acceso edificio */}
        {showBuilding && (
          <CollapsibleSection title="Acceso al edificio / recinto" selectedLabel={buildingLabel} expanded={buildingOpen} onToggle={() => setBuildingOpen(!buildingOpen)}>
            <CheckboxCardGroup name="_buildingMethods" options={buildingOptions} value={buildingMethods} onChange={setBuildingMethods} />
            {buildingMethods.includes("ba.other") && (
              <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
                <label className="block"><span className="text-sm font-medium">Nombre del método *</span><input name="buildingCustomLabel" type="text" defaultValue={p.buildingAccess?.customLabel ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
                <label className="block"><span className="text-sm font-medium">Descripción</span><textarea name="buildingCustomDesc" rows={2} defaultValue={p.buildingAccess?.customDesc ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Acceso vivienda */}
        <CollapsibleSection title="Acceso a la vivienda" selectedLabel={unitLabel} expanded={unitOpen} onToggle={() => setUnitOpen(!unitOpen)}>
          <CheckboxCardGroup name="_unitMethods" options={unitOptions} value={unitMethods} onChange={setUnitMethods} />
          {unitMethods.includes("am.other") && (
            <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
              <label className="block"><span className="text-sm font-medium">Nombre del método *</span><input name="unitCustomLabel" type="text" defaultValue={p.unitAccess?.customLabel ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-sm font-medium">Descripción</span><textarea name="unitCustomDesc" rows={2} defaultValue={p.unitAccess?.customDesc ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></label>
            </div>
          )}
        </CollapsibleSection>

        {/* Aparcamiento */}
        <CollapsibleSection title="Aparcamiento" selectedLabel={parkingLabel} expanded={parkingOpen} onToggle={() => setParkingOpen(!parkingOpen)}>
          <CheckboxCardGroup name="_parkingTypes" options={parkingOpts} value={parkingTypes} onChange={setParkingTypes} />
        </CollapsibleSection>

        {/* Accesibilidad */}
        <CollapsibleSection title="Accesibilidad" selectedLabel={axLabel} expanded={axOpen} onToggle={() => setAxOpen(!axOpen)}>
          <p className="mb-3 text-xs text-[var(--color-neutral-500)]">
            Selecciona las características de accesibilidad de la entrada y zonas comunes. Las adaptaciones dentro de baños y dormitorios se configuran en cada espacio.
          </p>
          <CheckboxCardGroup name="_axFeatures" options={axOpts} value={axFeatures} onChange={setAxFeatures} />
        </CollapsibleSection>

        {state?.error && <p className="text-sm text-[var(--color-danger-500)]">{state.error}</p>}

        <button type="submit" disabled={pending || !isDirty} className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
