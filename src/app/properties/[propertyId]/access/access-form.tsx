"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, Clock, Clock4, Key, MapPin } from "lucide-react";
import { CheckboxCardGroup, type CheckboxCardOption } from "@/components/ui/checkbox-card-group";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/ui/page-header";
import { NumberedSection } from "@/components/ui/numbered-section";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { saveAccessAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { accessMethods } from "@/lib/taxonomies/access-methods";
import { buildingAccessMethods } from "@/lib/taxonomies/building-access-methods";
import { parkingOptions } from "@/lib/taxonomies/parking-options";
import { accessibilityFeatures } from "@/lib/taxonomies/accessibility-features";
import { getItems, findItem } from "@/lib/taxonomies/_helpers";
import { EntityGallery } from "@/components/media/entity-gallery";

function sameStringList(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

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

const PARKING_OPTIONS: CheckboxCardOption[] = getItems(parkingOptions).map((item) => ({
  id: item.id,
  label: item.label,
  description: item.description,
  recommended: item.recommended,
}));

const ACCESSIBILITY_OPTIONS: CheckboxCardOption[] = getItems(accessibilityFeatures).map(
  (item) => ({
    id: item.id,
    label: item.label,
    description: item.description,
    recommended: item.recommended,
  }),
);

interface AccessFormProps {
  propertyId: string;
  property: {
    checkInStart: string | null;
    checkInEnd: string | null;
    checkOutTime: string | null;
    isAutonomousCheckin: boolean;
    hasBuildingAccess: boolean;
    buildingAccess: { methods: string[]; customLabel?: string | null; customDesc?: string | null } | null;
    unitAccess: { methods: string[]; customLabel?: string | null; customDesc?: string | null } | null;
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

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveAccessAction, null);

  const isDirty = isAutonomous !== (p.isAutonomousCheckin ? "yes" : "no") ||
    hasBuildingAccess !== (p.hasBuildingAccess ? "yes" : "no") ||
    !sameStringList(buildingMethods, p.buildingAccess?.methods ?? []) ||
    !sameStringList(unitMethods, p.unitAccess?.methods ?? []) ||
    !sameStringList(parkingTypes, p.parkingTypes) ||
    !sameStringList(axFeatures, p.accessibilityFeatures) ||
    checkInEnd !== (p.checkInEnd ?? "22:00");

  const autonomousMode = isAutonomous === "yes";
  const showBuilding = hasBuildingAccess === "yes";
  const buildingOptions = getBuildingOptions(autonomousMode);
  const unitOptions = getUnitOptions(autonomousMode);

  function handleAutonomousChange(val: string) {
    setIsAutonomous(val);
    if (val === "yes") setCheckInEnd("flexible");
  }

  const checkInLabel = p.checkInStart ?? "—";
  const checkOutLabel = p.checkOutTime ?? "—";
  const checkInRangeText = p.checkInStart
    ? `A partir de las ${p.checkInStart}${checkInEnd === "flexible" ? ", sin hora límite" : `, hasta las ${checkInEnd}`}`
    : "Define un horario para que el huésped sepa cuándo puede llegar.";
  const arrivalBigHour = p.checkInStart ? p.checkInStart.split(":")[0] : "—";
  const arrivalBigMin = p.checkInStart ? p.checkInStart.split(":")[1] : "";

  const status: "saving" | "saved" | "error" = pending ? "saving" : state?.error ? "error" : "saved";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        eyebrow="Propiedad · Llegada"
        title="Llegada y acceso"
        description="La hora más frágil de toda la estancia. Documenta aquí cómo llegan, cómo entran y qué hacer en los primeros minutos."
        actions={
          <>
            <ButtonLink href={`/properties/${propertyId}`} variant="secondary" size="md">
              <ArrowLeft size={14} aria-hidden="true" />
              Volver
            </ButtonLink>
            <span className="inline-flex min-h-[44px] items-center px-1">
              <InlineSaveStatus status={status} />
            </span>
          </>
        }
        chips={
          <>
            <PageHeaderChip icon={Clock4} label="Check-in" value={checkInLabel} />
            <PageHeaderChip icon={Clock} label="Check-out" value={checkOutLabel} />
            <PageHeaderChip icon={Key} label={isAutonomous === "yes" ? "Entrada autónoma" : "Entrada con anfitrión"} />
            <PageHeaderChip icon={MapPin} label={hasBuildingAccess === "yes" ? "Edificio cerrado" : "Acceso directo"} />
          </>
        }
      />

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="isAutonomousCheckin" value={isAutonomous === "yes" ? "true" : "false"} />
        <input type="hidden" name="hasBuildingAccess" value={hasBuildingAccess === "yes" ? "true" : "false"} />
        {buildingMethods.map((m) => <input key={`bm-${m}`} type="hidden" name="buildingMethods" value={m} />)}
        {unitMethods.map((m) => <input key={`um-${m}`} type="hidden" name="unitMethods" value={m} />)}
        {parkingTypes.map((m) => <input key={`pk-${m}`} type="hidden" name="parkingTypes" value={m} />)}
        {axFeatures.map((m) => <input key={`ax-${m}`} type="hidden" name="accessibilityFeatures" value={m} />)}

        <NumberedSection number="01" title="Horarios">
          <div className="mb-4 grid grid-cols-[auto_1fr] items-center gap-5 rounded-[16px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5">
            <div
              className="grid h-[96px] w-[96px] place-items-center rounded-[20px] bg-[var(--color-action-primary)] font-semibold leading-none tracking-[-0.02em] text-[var(--color-action-primary-fg)]"
              style={{ fontSize: "40px", fontVariantNumeric: "tabular-nums" }}
              aria-hidden="true"
            >
              <span>
                {arrivalBigHour}
                {arrivalBigMin && (
                  <span className="ml-0.5 align-super text-[14px] font-medium opacity-70">:{arrivalBigMin}</span>
                )}
              </span>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Check-in por defecto
              </div>
              <div className="mt-1 text-[18px] font-semibold text-[var(--color-text-primary)]">
                {checkInRangeText}
              </div>
              <div className="mt-1 max-w-[60ch] text-[13px] leading-[1.5] text-[var(--color-text-secondary)]">
                {autonomousMode
                  ? "El huésped puede entrar solo. Las llegadas tardías reciben las instrucciones por chat."
                  : "Coordina la llegada con el huésped — alguien estará en la propiedad para recibirle."}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-[12px] text-[var(--color-text-secondary)]">Check-in desde *</span>
              <select name="checkInStart" required defaultValue={p.checkInStart ?? "16:00"} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] text-[var(--color-text-secondary)]">Check-in hasta *</span>
              <select name="checkInEnd" required value={checkInEnd} onChange={(e) => setCheckInEnd(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none">
                <option value="flexible">Sin límite (flexible)</option>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] text-[var(--color-text-secondary)]">Check-out *</span>
              <select name="checkOutTime" required defaultValue={p.checkOutTime ?? "11:00"} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </NumberedSection>

        <NumberedSection number="02" title="Modo de acceso">
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
                ¿El acceso es completamente autónomo?
                <InfoTooltip text="Un acceso completamente autónomo significa que el huésped puede entrar sin necesitar a nadie presente: mediante código, cerradura digital, caja de llaves, etc." />
              </h3>
              <RadioCardGroup name="_autonomousQ" options={YES_NO_OPTIONS} value={isAutonomous} onChange={handleAutonomousChange} showRecommended={false} />
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
                ¿La propiedad está dentro de un recinto, edificio o comunidad cerrada?
                <InfoTooltip text="Si el huésped necesita pasar por un portal, puerta de comunidad o recinto antes de llegar a la vivienda, selecciona Sí." />
              </h3>
              <RadioCardGroup name="_buildingQ" options={YES_NO_OPTIONS} value={hasBuildingAccess} onChange={setHasBuildingAccess} showRecommended={false} />
            </div>
          </div>
        </NumberedSection>

        <NumberedSection number="03" title="Método de acceso">
          <div className="space-y-5">
            {showBuilding && (
              <div>
                <h3 className="mb-2 text-[13px] font-semibold text-[var(--color-text-primary)]">Acceso al edificio o recinto</h3>
                <CheckboxCardGroup name="_buildingMethods" options={buildingOptions} value={buildingMethods} onChange={setBuildingMethods} />
                {buildingMethods.includes("ba.other") && (
                  <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] p-4">
                    <label className="block"><span className="text-sm font-medium">Nombre del método *</span><input name="buildingCustomLabel" type="text" defaultValue={p.buildingAccess?.customLabel ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm" /></label>
                    <label className="block"><span className="text-sm font-medium">Descripción</span><textarea name="buildingCustomDesc" rows={2} defaultValue={p.buildingAccess?.customDesc ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm" /></label>
                  </div>
                )}
              </div>
            )}
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-[var(--color-text-primary)]">Acceso a la vivienda</h3>
              <CheckboxCardGroup name="_unitMethods" options={unitOptions} value={unitMethods} onChange={setUnitMethods} />
              {unitMethods.includes("am.other") && (
                <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] p-4">
                  <label className="block"><span className="text-sm font-medium">Nombre del método *</span><input name="unitCustomLabel" type="text" defaultValue={p.unitAccess?.customLabel ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm" /></label>
                  <label className="block"><span className="text-sm font-medium">Descripción</span><textarea name="unitCustomDesc" rows={2} defaultValue={p.unitAccess?.customDesc ?? ""} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm" /></label>
                </div>
              )}
            </div>
          </div>
        </NumberedSection>

        <NumberedSection number="04" title="Aparcamiento">
          <CheckboxCardGroup name="_parkingTypes" options={PARKING_OPTIONS} value={parkingTypes} onChange={setParkingTypes} />
        </NumberedSection>

        <NumberedSection number="05" title="Accesibilidad">
          <p className="mb-3 text-[12px] text-[var(--color-text-secondary)]">
            Selecciona las características de accesibilidad de la entrada y zonas comunes. Las adaptaciones dentro de baños y dormitorios se configuran en cada espacio.
          </p>
          <CheckboxCardGroup name="_axFeatures" options={ACCESSIBILITY_OPTIONS} value={axFeatures} onChange={setAxFeatures} />
        </NumberedSection>

        <NumberedSection number="06" title="Fotos del acceso">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5">
            <EntityGallery
              propertyId={propertyId}
              entityType="access_method"
              entityId={propertyId}
              label="Fotos del acceso"
              defaultCollapsed={false}
            />
            <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
              Fotos del portal, cerradura, caja de llaves, camino de entrada, etc.
            </p>
          </div>
        </NumberedSection>

        {state?.error && <p className="text-sm text-[var(--color-status-error-text)]">{state.error}</p>}

        <button type="submit" disabled={pending || !isDirty} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-5 py-2.5 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
