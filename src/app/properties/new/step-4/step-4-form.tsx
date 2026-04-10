"use client";

import { useActionState, useState } from "react";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { CheckboxCardGroup, type CheckboxCardOption } from "@/components/ui/checkbox-card-group";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { saveStep4Action, type ActionResult } from "@/lib/actions/wizard.actions";
import { accessMethods, buildingAccessMethods, getItems, findItem } from "@/lib/taxonomy-loader";
import type { StepFormProps } from "@/lib/types/wizard";

const AUTONOMOUS_BUILDING_IDS = ["ba.portal_code", "ba.access_link", "ba.intercom_auto", "ba.lockbox", "ba.intercom_host", "ba.open_access"];
const AUTONOMOUS_UNIT_IDS = ["am.smart_lock", "am.keypad", "am.lockbox"];

// Building options: ordered as requested, filtered by autonomous mode
function getBuildingOptions(autonomous: boolean): CheckboxCardOption[] {
  const all = getItems(buildingAccessMethods);
  const filtered = autonomous
    ? all.filter((item) => AUTONOMOUS_BUILDING_IDS.includes(item.id) || item.id === "ba.other")
    : all;
  return filtered.map((item) => ({
    id: item.id, label: item.label, description: item.description, recommended: item.recommended,
  }));
}

// Unit options: ordered as in taxonomy (smart_lock, keypad, lockbox first), filtered by autonomous mode
function getUnitOptions(autonomous: boolean): CheckboxCardOption[] {
  const all = getItems(accessMethods);
  const filtered = autonomous
    ? all.filter((item) => AUTONOMOUS_UNIT_IDS.includes(item.id) || item.id === "am.other")
    : all;
  return filtered.map((item) => ({
    id: item.id, label: item.label, description: item.description, recommended: item.recommended,
  }));
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

type Step4FormProps = StepFormProps;

export function Step4Form({ sessionId, initialState, maxStepReached, snapshot, snapshotStep }: Step4FormProps) {
  const initBuilding = (initialState.buildingAccess as { methods?: string[]; customLabel?: string; customDesc?: string }) ?? {};
  const initUnit = (initialState.unitAccess as { methods?: string[]; customLabel?: string; customDesc?: string }) ?? {};

  const [isAutonomous, setIsAutonomous] = useState<string | null>(
    initialState.isAutonomousCheckin != null ? ((initialState.isAutonomousCheckin as boolean) ? "yes" : "no") : null,
  );
  const [hasBuildingAccess, setHasBuildingAccess] = useState<string | null>(
    initialState.hasBuildingAccess != null ? ((initialState.hasBuildingAccess as boolean) ? "yes" : "no") : null,
  );

  const [buildingMethods, setBuildingMethods] = useState<string[]>(initBuilding.methods ?? []);
  const [unitMethods, setUnitMethods] = useState<string[]>(initUnit.methods ?? []);
  const [checkInEnd, setCheckInEnd] = useState((initialState.checkInEnd as string) ?? "22:00");

  // Progressive collapse for questions
  const [autonomousExpanded, setAutonomousExpanded] = useState(isAutonomous === null);
  const [buildingQExpanded, setBuildingQExpanded] = useState(isAutonomous !== null && hasBuildingAccess === null);

  // Access section collapse + save flow
  const [buildingSaved, setBuildingSaved] = useState((initBuilding.methods?.length ?? 0) > 0);
  const [unitSaved, setUnitSaved] = useState((initUnit.methods?.length ?? 0) > 0);
  const [buildingExpanded, setBuildingExpanded] = useState(!buildingSaved);
  const [unitExpanded, setUnitExpanded] = useState(!unitSaved && (hasBuildingAccess !== "yes" || buildingSaved));

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveStep4Action,
    null,
  );

  const fieldError = (field: string) => state?.fieldErrors?.[field]?.[0];

  const showBuilding = hasBuildingAccess === "yes";
  const autonomousMode = isAutonomous === "yes";
  const bothQuestionsAnswered = isAutonomous !== null && hasBuildingAccess !== null;

  const buildingOptions = getBuildingOptions(autonomousMode);
  const unitOptions = getUnitOptions(autonomousMode);

  function handleAutonomousChange(val: string) {
    setIsAutonomous(val);
    if (val === "yes") setCheckInEnd("flexible");
    setTimeout(() => {
      setAutonomousExpanded(false);
      setBuildingQExpanded(true);
    }, 200);
  }

  function handleBuildingQChange(val: string) {
    setHasBuildingAccess(val);
    setTimeout(() => setBuildingQExpanded(false), 200);
    // If building access, show building section first (unit hidden until building saved)
    if (val === "yes") {
      setBuildingExpanded(true);
      setUnitExpanded(false);
    } else {
      setUnitExpanded(true);
    }
  }

  function saveBuildingAccess() {
    setBuildingSaved(true);
    setTimeout(() => {
      setBuildingExpanded(false);
      setUnitExpanded(true);
    }, 200);
  }

  function saveUnitAccess() {
    setUnitSaved(true);
    setTimeout(() => setUnitExpanded(false), 200);
  }

  const canContinue = unitMethods.length > 0 && unitSaved;

  function buildingSelectedLabel(): string | null {
    if (buildingMethods.length === 0) return null;
    return buildingMethods.map((id) => findItem(buildingAccessMethods, id)?.label ?? id).join(", ");
  }
  function unitSelectedLabel(): string | null {
    if (unitMethods.length === 0) return null;
    return unitMethods.map((id) => findItem(accessMethods, id)?.label ?? id).join(", ");
  }

  return (
    <WizardShell
      currentStep={4}
      totalSteps={4}
      title="Acceso y check-in"
      subtitle="Define cómo acceden los huéspedes y los horarios de entrada y salida."
      backHref={`/properties/new/step-3?sessionId=${sessionId}`}
      sessionId={sessionId}
      maxStepReached={maxStepReached}
      snapshot={snapshot}
      snapshotStep={snapshotStep}
    >
      <form action={formAction} data-wizard-form className="space-y-6">
        <input type="hidden" name="sessionId" value={sessionId} />
        {isAutonomous !== null && (
          <input type="hidden" name="isAutonomousCheckin" value={isAutonomous === "yes" ? "true" : "false"} />
        )}
        {hasBuildingAccess !== null && (
          <input type="hidden" name="hasBuildingAccess" value={hasBuildingAccess === "yes" ? "true" : "false"} />
        )}
        {buildingMethods.map((m) => <input key={`bm-${m}`} type="hidden" name="buildingMethods" value={m} />)}
        {unitMethods.map((m) => <input key={`um-${m}`} type="hidden" name="unitMethods" value={m} />)}

        {/* Q1: Autonomous? */}
        <CollapsibleSection
          title={<>¿El acceso es completamente autónomo? <InfoTooltip text="Un acceso completamente autónomo significa que el huésped puede entrar sin necesitar a nadie presente: mediante código, cerradura digital, caja de llaves, etc." /></>}
          selectedLabel={isAutonomous === "yes" ? "Sí" : isAutonomous === "no" ? "No" : null}
          expanded={autonomousExpanded}
          onToggle={() => setAutonomousExpanded(!autonomousExpanded)}
        >
          <RadioCardGroup name="_autonomousQ" options={YES_NO_OPTIONS} value={isAutonomous} onChange={handleAutonomousChange} showRecommended={false} />
        </CollapsibleSection>

        {/* Q2: Building access? */}
        {isAutonomous !== null && (
          <CollapsibleSection
            title={<>¿La propiedad está dentro de un recinto, edificio o comunidad cerrada? <InfoTooltip text="Si el huésped necesita pasar por un portal, puerta de comunidad o recinto antes de llegar a la vivienda, selecciona Sí." /></>}
            selectedLabel={hasBuildingAccess === "yes" ? "Sí" : hasBuildingAccess === "no" ? "No" : null}
            expanded={buildingQExpanded}
            onToggle={() => setBuildingQExpanded(!buildingQExpanded)}
          >
            <RadioCardGroup name="_buildingQ" options={YES_NO_OPTIONS} value={hasBuildingAccess} onChange={handleBuildingQChange} showRecommended={false} />
          </CollapsibleSection>
        )}

        {/* Main content */}
        {bothQuestionsAnswered && (
          <>
            {/* Horarios */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Horarios</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs text-[var(--color-neutral-500)]">Check-in desde *</span>
                  <select name="checkInStart" required defaultValue={(initialState.checkInStart as string) ?? "16:00"} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none">
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--color-neutral-500)]">Check-in hasta *</span>
                  <select name="checkInEnd" required value={checkInEnd} onChange={(e) => setCheckInEnd(e.target.value)} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none">
                    <option value="flexible">Sin límite (flexible)</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--color-neutral-500)]">Check-out *</span>
                  <select name="checkOutTime" required defaultValue={(initialState.checkOutTime as string) ?? "11:00"} className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none">
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {/* Building access — only when has building, save-to-collapse */}
            {showBuilding && (
              <CollapsibleSection
                title="Acceso al edificio / recinto"
                selectedLabel={buildingSelectedLabel()}
                expanded={buildingExpanded}
                onToggle={() => { setBuildingExpanded(!buildingExpanded); if (!buildingExpanded) setBuildingSaved(false); }}
              >
                <CheckboxCardGroup name="_buildingMethods" options={buildingOptions} value={buildingMethods} onChange={setBuildingMethods} />
                {buildingMethods.includes("ba.other") && (
                  <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--foreground)]">Nombre del método *</span>
                      <input name="buildingCustomLabel" type="text" required defaultValue={initBuilding.customLabel ?? ""} placeholder="ej. Acceso por garaje..." className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--foreground)]">Descripción</span>
                      <textarea name="buildingCustomDesc" rows={2} defaultValue={initBuilding.customDesc ?? ""} placeholder="Instrucciones para el huésped" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" />
                    </label>
                  </div>
                )}
                <button type="button" disabled={buildingMethods.length === 0} onClick={saveBuildingAccess} className="mt-4 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-40 transition-colors">
                  Guardar
                </button>
              </CollapsibleSection>
            )}

            {/* Unit access — visible after building saved (or no building) */}
            {(!showBuilding || buildingSaved) && (
              <CollapsibleSection
                title="Acceso a la vivienda"
                selectedLabel={unitSelectedLabel()}
                expanded={unitExpanded}
                onToggle={() => { setUnitExpanded(!unitExpanded); if (!unitExpanded) setUnitSaved(false); }}
              >
                <CheckboxCardGroup name="_unitMethods" options={unitOptions} value={unitMethods} onChange={setUnitMethods} />
                {unitMethods.includes("am.other") && (
                  <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--foreground)]">Nombre del método *</span>
                      <input name="unitCustomLabel" type="text" required defaultValue={initUnit.customLabel ?? ""} placeholder="ej. Portero automático..." className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--foreground)]">Descripción</span>
                      <textarea name="unitCustomDesc" rows={2} defaultValue={initUnit.customDesc ?? ""} placeholder="Instrucciones para el huésped" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" />
                    </label>
                  </div>
                )}
                {fieldError("unitAccess") && <p className="mt-2 text-sm text-[var(--color-danger-500)]">{fieldError("unitAccess")}</p>}
                <button type="button" disabled={unitMethods.length === 0} onClick={saveUnitAccess} className="mt-4 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-40 transition-colors">
                  Guardar
                </button>
              </CollapsibleSection>
            )}

            {/* Host info */}
            <div>
              <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Datos del anfitrión</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[var(--foreground)]">Anfitrión</span>
                  <input name="hostName" type="text" defaultValue={(initialState.hostName as string) ?? ""} placeholder="Nombre del anfitrión" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[var(--foreground)]">Teléfono</span>
                  <input name="hostContactPhone" type="tel" defaultValue={(initialState.hostContactPhone as string) ?? ""} placeholder="+34 600 000 000" className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none" />
                </label>
              </div>
            </div>

            <button type="submit" disabled={pending || !canContinue} className="mt-4 inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-[var(--color-primary-600)] disabled:opacity-50">
              {pending ? "Guardando…" : "Continuar a revisión"}
            </button>
          </>
        )}
      </form>
    </WizardShell>
  );
}
