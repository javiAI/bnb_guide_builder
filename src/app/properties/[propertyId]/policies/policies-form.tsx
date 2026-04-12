"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { RadioCardGroup } from "@/components/ui/radio-card-group";
import { CheckboxCardGroup } from "@/components/ui/checkbox-card-group";
import { NumberStepper } from "@/components/ui/number-stepper";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { savePoliciesAction, type ActionResult } from "@/lib/actions/editor.actions";
import { getPolicyOptions, getPolicyFieldOptions } from "@/lib/taxonomy-loader";
import type { PoliciesData } from "@/lib/schemas/editor.schema";

// ── Time options (30min intervals) ──

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

// ── Options loaded from policy_taxonomy.json ──

const SMOKING_OPTIONS = getPolicyOptions("pol.smoking");
const EVENTS_OPTIONS = getPolicyOptions("pol.events");
const PHOTOGRAPHY_OPTIONS = getPolicyOptions("pol.commercial_photography");
const PET_TYPE_OPTIONS = getPolicyFieldOptions("pol.pets", "types");
const PET_SIZE_OPTIONS = getPolicyFieldOptions("pol.pets", "size_restriction");
const PET_FEE_OPTIONS = getPolicyFieldOptions("pol.pets", "fee_mode");
const PET_RESTRICTION_OPTIONS = getPolicyFieldOptions("pol.pets", "restrictions");
const SERVICE_TYPE_OPTIONS = getPolicyOptions("pol.services_in_home");

// ── Helpers ──

function buildSummaryLabel(policies: PoliciesData): Record<string, string | null> {
  const labels: Record<string, string | null> = {};

  // Convivencia
  const parts: string[] = [];
  if (policies.quietHours.enabled) parts.push(`Silencio ${policies.quietHours.from ?? "22:00"}–${policies.quietHours.to ?? "08:00"}`);
  const smokingLabel = SMOKING_OPTIONS.find((o) => o.id === policies.smoking)?.label;
  if (smokingLabel && policies.smoking !== "not_allowed") parts.push(`Fumar: ${smokingLabel}`);
  labels.convivencia = parts.length ? parts.join(", ") : null;

  // Mascotas
  labels.mascotas = policies.pets.allowed ? "Se admiten mascotas" : "No se admiten mascotas";

  // Suplementos
  const supParts: string[] = [];
  if (policies.supplements.cleaning.enabled) supParts.push(`Limpieza: ${policies.supplements.cleaning.amount ?? 0} EUR`);
  if (policies.supplements.extraGuest.enabled) supParts.push(`Huésped extra: ${policies.supplements.extraGuest.amount ?? 0} EUR`);
  labels.suplementos = supParts.length ? supParts.join(", ") : "Sin suplementos";

  // Servicios
  labels.servicios = policies.services.allowed ? "Servicios permitidos" : "No permitidos";

  return labels;
}

// ── Component ──

interface PoliciesFormProps {
  propertyId: string;
  policies: PoliciesData;
  propertyDefaults: {
    maxGuests: number | null;
  };
}

export function PoliciesForm({ propertyId, policies: initial, propertyDefaults }: PoliciesFormProps) {
  // ── Convivencia state ──
  const [quietEnabled, setQuietEnabled] = useState(initial.quietHours.enabled);
  const [quietFrom, setQuietFrom] = useState(initial.quietHours.from ?? "22:00");
  const [quietTo, setQuietTo] = useState(initial.quietHours.to ?? "08:00");
  const [smoking, setSmoking] = useState(initial.smoking);
  const [smokingArea, setSmokingArea] = useState(initial.smokingArea ?? "");
  const [eventsPolicy, setEventsPolicy] = useState(initial.events.policy);
  const [eventsMaxPeople, setEventsMaxPeople] = useState(initial.events.maxPeople ?? 6);
  const [eventsApproval, setEventsApproval] = useState(initial.events.approvalInstructions ?? "");
  const [commercialPhoto, setCommercialPhoto] = useState(initial.commercialPhotography);

  // ── Mascotas state ──
  const validPetTypeIds = new Set(PET_TYPE_OPTIONS.map((o) => o.id));
  const validPetRestrictionIds = new Set(PET_RESTRICTION_OPTIONS.map((o) => o.id));
  const validServiceTypeIds = new Set(SERVICE_TYPE_OPTIONS.map((o) => o.id));

  const [petsAllowed, setPetsAllowed] = useState(initial.pets.allowed);
  const [petTypes, setPetTypes] = useState<string[]>((initial.pets.types ?? []).filter((id) => validPetTypeIds.has(id)));
  const [petSize, setPetSize] = useState(initial.pets.sizeRestriction ?? "none");
  const [petMaxWeight, setPetMaxWeight] = useState(initial.pets.maxWeightKg ?? 15);
  const [petMaxCount, setPetMaxCount] = useState(initial.pets.maxCount ?? 2);
  const [petFeeMode, setPetFeeMode] = useState(initial.pets.feeMode ?? "none");
  const [petFeeAmount, setPetFeeAmount] = useState(initial.pets.feeAmount ?? 0);
  const [petRestrictions, setPetRestrictions] = useState<string[]>((initial.pets.restrictions ?? []).filter((id) => validPetRestrictionIds.has(id)));
  const [petNotes, setPetNotes] = useState(initial.pets.notes ?? "");

  // ── Suplementos state ──
  const [cleaningEnabled, setCleaningEnabled] = useState(initial.supplements.cleaning.enabled);
  const [cleaningAmount, setCleaningAmount] = useState(initial.supplements.cleaning.amount ?? 0);
  const [extraGuestEnabled, setExtraGuestEnabled] = useState(initial.supplements.extraGuest.enabled);
  const [extraGuestAmount, setExtraGuestAmount] = useState(initial.supplements.extraGuest.amount ?? 0);
  const [extraGuestFrom, setExtraGuestFrom] = useState(initial.supplements.extraGuest.fromGuest ?? 3);

  // ── Servicios state ──
  const [servicesAllowed, setServicesAllowed] = useState(initial.services.allowed);
  const [serviceTypes, setServiceTypes] = useState<string[]>((initial.services.types ?? []).filter((id) => validServiceTypeIds.has(id)));
  const [serviceNotes, setServiceNotes] = useState(initial.services.notes ?? "");

  // ── Section expand state ──
  const [convivenciaOpen, setConvivenciaOpen] = useState(true);
  const [mascotasOpen, setMascotasOpen] = useState(false);
  const [suplementosOpen, setSuplementosOpen] = useState(false);
  const [serviciosOpen, setServiciosOpen] = useState(false);

  // ── Form action ──
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePoliciesAction, null);

  const saveStatus = pending ? "saving" : state?.success ? "saved" : state?.error ? "error" : undefined;

  // Build the typed JSON for submission
  function buildPoliciesJson(): PoliciesData {
    return {
      quietHours: {
        enabled: quietEnabled,
        ...(quietEnabled ? { from: quietFrom, to: quietTo } : {}),
      },
      smoking,
      ...(smoking === "designated_area" ? { smokingArea: smokingArea || null } : {}),
      events: {
        policy: eventsPolicy,
        ...(eventsPolicy === "small_gatherings" ? { maxPeople: eventsMaxPeople } : {}),
        ...(eventsPolicy === "with_approval" ? { approvalInstructions: eventsApproval || null } : {}),
      },
      commercialPhotography: commercialPhoto,
      pets: {
        allowed: petsAllowed,
        ...(petsAllowed
          ? {
              types: petTypes,
              sizeRestriction: petSize,
              ...(petSize === "custom_weight" ? { maxWeightKg: petMaxWeight } : {}),
              maxCount: petMaxCount,
              feeMode: petFeeMode,
              ...(petFeeMode !== "none" ? { feeAmount: petFeeAmount } : {}),
              restrictions: petRestrictions,
              notes: petNotes || null,
            }
          : {}),
      },
      supplements: {
        cleaning: {
          enabled: cleaningEnabled,
          ...(cleaningEnabled ? { amount: cleaningAmount } : {}),
        },
        extraGuest: {
          enabled: extraGuestEnabled,
          ...(extraGuestEnabled ? { amount: extraGuestAmount, fromGuest: extraGuestFrom } : {}),
        },
      },
      services: {
        allowed: servicesAllowed,
        ...(servicesAllowed ? { types: serviceTypes, notes: serviceNotes || null } : {}),
      },
    };
  }

  const summaryLabels = buildSummaryLabel(buildPoliciesJson());

  // ── Shared styles ──
  const inputCls = "block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";
  const labelCls = "block text-sm font-medium text-[var(--foreground)]";
  const subLabelCls = "block text-xs text-[var(--color-neutral-500)] mt-0.5 mb-2";
  const toggleCls = "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer";
  const toggleDotCls = "inline-block h-4 w-4 rounded-full bg-white transition-transform";

  function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
      <label className="flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`${toggleCls} ${checked ? "bg-[var(--color-primary-500)]" : "bg-[var(--color-neutral-300)]"}`}
        >
          <span className={`${toggleDotCls} ${checked ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm text-[var(--foreground)]">{label}</span>
      </label>
    );
  }

  return (
    <form
      action={(formData) => {
        formData.set("policiesJson", JSON.stringify(buildPoliciesJson()));
        formAction(formData);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="propertyId" value={propertyId} />

      <div className="flex items-center justify-between">
        <span />
        {saveStatus && <InlineSaveStatus status={saveStatus} />}
      </div>

      {state?.error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      {/* ── Block 1: Convivencia ── */}
      <CollapsibleSection
        title="Convivencia"
        selectedLabel={summaryLabels.convivencia}
        expanded={convivenciaOpen}
        onToggle={() => setConvivenciaOpen(!convivenciaOpen)}
      >
        <div className="space-y-6">
          {/* Quiet hours */}
          <div>
            <div className="flex items-center gap-1 mb-3">
              <span className={labelCls}>Horario de silencio</span>
              <InfoTooltip text="El horario de silencio se comunicará a los huéspedes en la guía. Establece las horas en las que se debe evitar ruido excesivo." />
            </div>
            <Toggle checked={quietEnabled} onChange={setQuietEnabled} label="¿Hay restricción de ruido?" />
            {quietEnabled && (
              <div className="mt-3 flex items-center gap-3">
                <div>
                  <span className="text-xs text-[var(--color-neutral-500)]">Desde</span>
                  <select value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} className={inputCls}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-xs text-[var(--color-neutral-500)]">Hasta</span>
                  <select value={quietTo} onChange={(e) => setQuietTo(e.target.value)} className={inputCls}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Smoking */}
          <div>
            <span className={labelCls}>Fumar</span>
            <span className={subLabelCls}>Política de tabaco en la propiedad</span>
            <RadioCardGroup name="_smoking" options={SMOKING_OPTIONS} value={smoking} onChange={(v) => setSmoking(v as PoliciesData["smoking"])} showRecommended={false} />
            {smoking === "designated_area" && (
              <div className="mt-3">
                <span className="text-xs text-[var(--color-neutral-500)]">¿Dónde se puede fumar?</span>
                <input type="text" value={smokingArea} onChange={(e) => setSmokingArea(e.target.value)} placeholder="Ej: terraza trasera" className={inputCls} />
              </div>
            )}
          </div>

          {/* Events */}
          <div>
            <span className={labelCls}>Eventos y reuniones</span>
            <span className={subLabelCls}>Política sobre reuniones y eventos en la propiedad</span>
            <RadioCardGroup name="_events" options={EVENTS_OPTIONS} value={eventsPolicy} onChange={(v) => setEventsPolicy(v as PoliciesData["events"]["policy"])} showRecommended={false} />
            {eventsPolicy === "small_gatherings" && (
              <div className="mt-3">
                <NumberStepper label="Máximo de personas" value={eventsMaxPeople} onChange={setEventsMaxPeople} min={2} max={50} />
              </div>
            )}
            {eventsPolicy === "with_approval" && (
              <div className="mt-3">
                <span className="text-xs text-[var(--color-neutral-500)]">Instrucciones para solicitar aprobación</span>
                <textarea value={eventsApproval} onChange={(e) => setEventsApproval(e.target.value)} rows={2} placeholder="Ej: contactar al anfitrión con 48h de antelación" className={inputCls} />
              </div>
            )}
          </div>

          {/* Commercial photography */}
          <div>
            <span className={labelCls}>Fotografía / filmación comercial</span>
            <span className={subLabelCls}>Uso comercial de la propiedad para sesiones de foto o vídeo</span>
            <RadioCardGroup name="_photo" options={PHOTOGRAPHY_OPTIONS} value={commercialPhoto} onChange={(v) => setCommercialPhoto(v as PoliciesData["commercialPhotography"])} showRecommended={false} />
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Block 2: Mascotas ── */}
      <CollapsibleSection
        title="Mascotas"
        selectedLabel={summaryLabels.mascotas}
        expanded={mascotasOpen}
        onToggle={() => setMascotasOpen(!mascotasOpen)}
      >
        <div className="space-y-6">
          <Toggle checked={petsAllowed} onChange={setPetsAllowed} label="¿Se admiten mascotas?" />

          {petsAllowed && (
            <>
              {/* Pet types */}
              <div>
                <span className={labelCls}>Tipos permitidos</span>
                <span className={subLabelCls}>¿Qué tipos de mascotas se admiten?</span>
                <CheckboxCardGroup name="_petTypes" options={PET_TYPE_OPTIONS} value={petTypes} onChange={setPetTypes} showRecommended={false} />
              </div>

              {/* Size restriction */}
              <div>
                <span className={labelCls}>Restricción de tamaño</span>
                <span className={subLabelCls}>Límite de peso para mascotas</span>
                <RadioCardGroup name="_petSize" options={PET_SIZE_OPTIONS} value={petSize} onChange={(v) => setPetSize(v as NonNullable<PoliciesData["pets"]["sizeRestriction"]>)} showRecommended={false} />
                {petSize === "custom_weight" && (
                  <div className="mt-3">
                    <NumberStepper label="Peso máximo" value={petMaxWeight} onChange={setPetMaxWeight} min={1} max={100} suffix="kg" />
                  </div>
                )}
              </div>

              {/* Max count */}
              <div>
                <NumberStepper label="Número máximo de mascotas" value={petMaxCount} onChange={setPetMaxCount} min={1} max={10} />
              </div>

              {/* Fee */}
              <div>
                <span className={labelCls}>Cargos por mascota</span>
                <span className={subLabelCls}>¿Se cobra suplemento por traer mascotas?</span>
                <RadioCardGroup name="_petFee" options={PET_FEE_OPTIONS} value={petFeeMode} onChange={(v) => setPetFeeMode(v as NonNullable<PoliciesData["pets"]["feeMode"]>)} showRecommended={false} />
                {petFeeMode !== "none" && (
                  <div className="mt-3">
                    <span className="text-xs text-[var(--color-neutral-500)]">Importe (EUR)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={petFeeAmount}
                      onChange={(e) => setPetFeeAmount(Number(e.target.value))}
                      className={`${inputCls} max-w-[10rem]`}
                    />
                  </div>
                )}
              </div>

              {/* Restrictions */}
              <div>
                <span className={labelCls}>Restricciones adicionales</span>
                <CheckboxCardGroup name="_petRestrictions" options={PET_RESTRICTION_OPTIONS} value={petRestrictions} onChange={setPetRestrictions} showRecommended={false} />
              </div>

              {/* Service animals info */}
              <div className="rounded-[var(--radius-md)] bg-[var(--color-primary-50)] p-3">
                <p className="text-xs text-[var(--color-primary-700)]">
                  Los animales de servicio / asistencia están siempre permitidos sin cargo adicional, según la legislación vigente.
                </p>
              </div>

              {/* Notes */}
              <div>
                <span className={labelCls}>Notas adicionales</span>
                <span className={subLabelCls}>Información extra sobre la política de mascotas (opcional)</span>
                <textarea value={petNotes} onChange={(e) => setPetNotes(e.target.value)} rows={2} placeholder="Ej: se requiere documentación veterinaria al día" className={inputCls} />
              </div>
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Block 3: Suplementos ── */}
      <CollapsibleSection
        title="Suplementos y cargos"
        selectedLabel={summaryLabels.suplementos}
        expanded={suplementosOpen}
        onToggle={() => setSuplementosOpen(!suplementosOpen)}
      >
        <div className="space-y-6">
          {/* Cleaning fee */}
          <div>
            <div className="flex items-center gap-1 mb-3">
              <span className={labelCls}>Suplemento de limpieza</span>
              <InfoTooltip text="Cargo único que se aplica una vez por reserva, independientemente de la duración de la estancia." />
            </div>
            <Toggle checked={cleaningEnabled} onChange={setCleaningEnabled} label="¿Se cobra suplemento de limpieza?" />
            {cleaningEnabled && (
              <div className="mt-3">
                <span className="text-xs text-[var(--color-neutral-500)]">Importe (EUR)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cleaningAmount}
                  onChange={(e) => setCleaningAmount(Number(e.target.value))}
                  className={`${inputCls} max-w-[10rem]`}
                />
              </div>
            )}
          </div>

          {/* Extra guest fee */}
          <div>
            <div className="flex items-center gap-1 mb-3">
              <span className={labelCls}>Suplemento por huésped extra</span>
              <InfoTooltip text="Cargo adicional por noche para cada huésped que exceda el límite base. Se aplica por noche y por persona." />
            </div>
            <Toggle checked={extraGuestEnabled} onChange={setExtraGuestEnabled} label="¿Se cobra suplemento por huésped extra?" />
            {extraGuestEnabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <span className="text-xs text-[var(--color-neutral-500)]">Importe por huésped extra (EUR / noche)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={extraGuestAmount}
                    onChange={(e) => setExtraGuestAmount(Number(e.target.value))}
                    className={`${inputCls} max-w-[10rem]`}
                  />
                </div>
                <div>
                  <NumberStepper label="A partir de cuántos huéspedes" value={extraGuestFrom} onChange={setExtraGuestFrom} min={1} max={propertyDefaults.maxGuests ?? 20} />
                  <p className="mt-1.5 text-xs text-[var(--color-neutral-400)]">
                    Máximo de huéspedes: {propertyDefaults.maxGuests ?? "—"} ·{" "}
                    <Link href={`/properties/${propertyId}/property`} className="text-[var(--color-primary-500)] hover:underline">
                      Editar en Propiedad
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Pet fee reference */}
          {petsAllowed && petFeeMode !== "none" && (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] p-3">
              <span className="text-xs text-[var(--color-neutral-500)]">Suplemento por mascota</span>
              <p className="text-sm">
                {petFeeAmount} EUR / {PET_FEE_OPTIONS.find((o) => o.id === petFeeMode)?.label?.toLowerCase()}
              </p>
              <button
                type="button"
                onClick={() => { setMascotasOpen(true); setSuplementosOpen(false); }}
                className="mt-1 text-xs text-[var(--color-primary-500)] hover:underline"
              >
                Configurado en Mascotas
              </button>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Block 4: Servicios ── */}
      <CollapsibleSection
        title="Servicios permitidos"
        selectedLabel={summaryLabels.servicios}
        expanded={serviciosOpen}
        onToggle={() => setServiciosOpen(!serviciosOpen)}
      >
        <div className="space-y-6">
          <Toggle checked={servicesAllowed} onChange={setServicesAllowed} label="¿Se permite contratar servicios externos?" />

          {servicesAllowed ? (
            <>
              <div>
                <span className={labelCls}>Tipos de servicio permitidos</span>
                <span className={subLabelCls}>Selecciona los servicios que los huéspedes pueden contratar</span>
                <CheckboxCardGroup name="_serviceTypes" options={SERVICE_TYPE_OPTIONS} value={serviceTypes} onChange={setServiceTypes} showRecommended={false} />
              </div>
              <div>
                <span className={labelCls}>Notas sobre servicios</span>
                <textarea value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)} rows={2} placeholder="Ej: coordinar con el anfitrión con 24h de antelación" className={inputCls} />
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--color-neutral-500)]">
              No se permiten servicios externos en la propiedad.
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar normas"}
      </button>
    </form>
  );
}
