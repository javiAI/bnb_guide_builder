"use client";

import { useActionState, useState, useCallback } from "react";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { saveStep1Action } from "@/lib/actions/wizard.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { propertyTypes, roomTypes, spaceAvailabilityRules, getItems, findItem } from "@/lib/taxonomy-loader";
import type { StepFormProps } from "@/lib/types/wizard";

const propertyTypeOptions: RadioCardOption[] = getItems(propertyTypes).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));

const roomTypeOptions: RadioCardOption[] = getItems(roomTypes).map((item) => ({
  id: item.id, label: item.label, description: item.description,
}));

const layoutKeyOptions: RadioCardOption[] = spaceAvailabilityRules.layoutKeys.map((lk) => ({
  id: lk.id, label: lk.label, description: lk.description,
}));

type Step1FormProps = StepFormProps;

export function Step1Form({ sessionId, initialState, maxStepReached, snapshot, snapshotStep }: Step1FormProps) {
  const initPt = (initialState.propertyType as string) ?? null;
  const initRt = (initialState.roomType as string) ?? null;
  const initLk = (initialState.layoutKey as string) ?? null;

  const [propertyType, setPropertyType] = useState<string | null>(initPt);
  const [roomType, setRoomType] = useState<string | null>(initRt);
  const [layoutKey, setLayoutKey] = useState<string | null>(initLk);
  const [customPtLabel, setCustomPtLabel] = useState((initialState.customPropertyTypeLabel as string) ?? "");
  const [customPtDesc, setCustomPtDesc] = useState((initialState.customPropertyTypeDesc as string) ?? "");
  const [customRtLabel, setCustomRtLabel] = useState((initialState.customRoomTypeLabel as string) ?? "");
  const [customRtDesc, setCustomRtDesc] = useState((initialState.customRoomTypeDesc as string) ?? "");

  // Collapse state
  const [ptExpanded, setPtExpanded] = useState(!initPt);
  const [rtExpanded, setRtExpanded] = useState(!!initPt && !initRt);
  const [lkExpanded, setLkExpanded] = useState(!!initRt && initRt === "rt.entire_place" && !initLk);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveStep1Action,
    null,
  );

  const handlePropertyTypeSelect = useCallback((value: string) => {
    setPropertyType(value);
    if (value !== "pt.other") {
      // Auto-collapse property type, expand room type
      setTimeout(() => {
        setPtExpanded(false);
        setRtExpanded(true);
      }, 200);
    }
    // If "pt.other" — stay expanded so user can fill custom fields
  }, []);

  const handleRoomTypeSelect = useCallback((value: string) => {
    setRoomType(value);
    setLayoutKey(null); // reset layout when room type changes
    if (value !== "rt.other") {
      setTimeout(() => {
        setRtExpanded(false);
        if (value === "rt.entire_place") setLkExpanded(true);
      }, 200);
    }
  }, []);

  // "Guardar" for custom property type
  function savePtOther() {
    setTimeout(() => {
      setPtExpanded(false);
      setRtExpanded(true);
    }, 200);
  }

  function saveRtOther() {
    setTimeout(() => setRtExpanded(false), 200);
  }

  const ptLabel = propertyType
    ? (propertyType === "pt.other" ? (customPtLabel || "Otro") : findItem(propertyTypes, propertyType)?.label ?? null)
    : null;
  const rtLabel = roomType
    ? (roomType === "rt.other" ? (customRtLabel || "Otro") : findItem(roomTypes, roomType)?.label ?? null)
    : null;

  const ptReady = !!propertyType && (propertyType !== "pt.other" || customPtLabel.length > 0);
  const rtReady = !!roomType && (roomType !== "rt.other" || customRtLabel.length > 0);
  const lkReady = roomType !== "rt.entire_place" || !!layoutKey;
  const canContinue = ptReady && rtReady && lkReady;

  const lkLabel = layoutKey ? layoutKeyOptions.find((o) => o.id === layoutKey)?.label ?? null : null;

  return (
    <WizardShell
      currentStep={1}
      totalSteps={4}
      title="Tipo de alojamiento"
      subtitle="Selecciona qué tipo de propiedad ofreces y cómo la utilizarán los huéspedes."
      backHref={`/properties/new/welcome?sessionId=${sessionId}`}
      sessionId={sessionId}
      maxStepReached={maxStepReached}
      snapshot={snapshot}
      snapshotStep={snapshotStep}
    >
      <form action={formAction} data-wizard-form>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="propertyType" value={propertyType ?? ""} />
        <input type="hidden" name="roomType" value={roomType ?? ""} />
        <input type="hidden" name="layoutKey" value={layoutKey ?? ""} />
        <input type="hidden" name="customPropertyTypeLabel" value={customPtLabel} />
        <input type="hidden" name="customPropertyTypeDesc" value={customPtDesc} />
        <input type="hidden" name="customRoomTypeLabel" value={customRtLabel} />
        <input type="hidden" name="customRoomTypeDesc" value={customRtDesc} />

        <div className="space-y-4">
          {/* Property type */}
          <CollapsibleSection
            title="Tipo de propiedad"
            selectedLabel={ptLabel}
            expanded={ptExpanded}
            onToggle={() => setPtExpanded(!ptExpanded)}
          >
            <RadioCardGroup
              name="_propertyType"
              options={propertyTypeOptions}
              value={propertyType}
              onChange={handlePropertyTypeSelect}
              showRecommended={false}
            />
            {propertyType === "pt.other" && (
              <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
                <label className="block">
                  <span className="text-sm font-medium text-[var(--foreground)]">Nombre del tipo *</span>
                  <input
                    type="text"
                    value={customPtLabel}
                    onChange={(e) => setCustomPtLabel(e.target.value)}
                    placeholder="ej. Cabaña, Finca rústica..."
                    className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[var(--foreground)]">Descripción</span>
                  <textarea
                    value={customPtDesc}
                    onChange={(e) => setCustomPtDesc(e.target.value)}
                    rows={2}
                    placeholder="Breve descripción del tipo de alojamiento"
                    className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  disabled={!customPtLabel.trim()}
                  onClick={savePtOther}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-40 transition-colors"
                >
                  Guardar
                </button>
              </div>
            )}
            {state?.fieldErrors?.propertyType && (
              <p className="mt-2 text-sm text-[var(--color-danger-500)]">{state.fieldErrors.propertyType[0]}</p>
            )}
            {state?.fieldErrors?.customPropertyTypeLabel && (
              <p className="mt-2 text-sm text-[var(--color-danger-500)]">{state.fieldErrors.customPropertyTypeLabel[0]}</p>
            )}
          </CollapsibleSection>

          {/* Room type — visible once property type is set */}
          {ptReady && (
            <CollapsibleSection
              title="Tipo de espacio"
              selectedLabel={rtLabel}
              expanded={rtExpanded}
              onToggle={() => setRtExpanded(!rtExpanded)}
            >
              <RadioCardGroup
                name="_roomType"
                options={roomTypeOptions}
                value={roomType}
                onChange={handleRoomTypeSelect}
                showRecommended={false}
              />
              {roomType === "rt.other" && (
                <div className="mt-3 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
                  <label className="block">
                    <span className="text-sm font-medium text-[var(--foreground)]">Nombre del espacio *</span>
                    <input
                      type="text"
                      value={customRtLabel}
                      onChange={(e) => setCustomRtLabel(e.target.value)}
                      placeholder="ej. Suite familiar, Glamping..."
                      className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-[var(--foreground)]">Descripción</span>
                    <textarea
                      value={customRtDesc}
                      onChange={(e) => setCustomRtDesc(e.target.value)}
                      rows={2}
                      placeholder="Breve descripción del tipo de espacio"
                      className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!customRtLabel.trim()}
                    onClick={saveRtOther}
                    className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-40 transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              )}
              {state?.fieldErrors?.roomType && (
                <p className="mt-2 text-sm text-[var(--color-danger-500)]">{state.fieldErrors.roomType[0]}</p>
              )}
              {state?.fieldErrors?.customRoomTypeLabel && (
                <p className="mt-2 text-sm text-[var(--color-danger-500)]">{state.fieldErrors.customRoomTypeLabel[0]}</p>
              )}
            </CollapsibleSection>
          )}

          {/* Layout — only for entire place */}
          {rtReady && roomType === "rt.entire_place" && (
            <CollapsibleSection
              title="Distribución"
              selectedLabel={lkLabel}
              expanded={lkExpanded}
              onToggle={() => setLkExpanded(!lkExpanded)}
            >
              <p className="mb-3 text-xs text-[var(--color-neutral-500)]">
                ¿Cómo están organizados los espacios del alojamiento?
              </p>
              <RadioCardGroup
                name="_layoutKey"
                options={layoutKeyOptions}
                value={layoutKey}
                onChange={(value) => {
                  setLayoutKey(value);
                  setTimeout(() => setLkExpanded(false), 200);
                }}
                showRecommended={false}
              />
              {state?.fieldErrors?.layoutKey && (
                <p className="mt-2 text-sm text-[var(--color-danger-500)]">{state.fieldErrors.layoutKey[0]}</p>
              )}
            </CollapsibleSection>
          )}
        </div>

        <button
          type="submit"
          disabled={pending || !canContinue}
          className="mt-8 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-[var(--color-primary-600)] disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Continuar"}
        </button>
      </form>
    </WizardShell>
  );
}
