"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Moon, Cigarette, PartyPopper, Camera, SprayCan, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NumberedSection } from "@/components/ui/numbered-section";
import { IconBadge } from "@/components/ui/icon-badge";
import { RadioCardGroup } from "@/components/ui/radio-card-group";
import { CheckboxCardGroup } from "@/components/ui/checkbox-card-group";
import { NumberStepper } from "@/components/ui/number-stepper";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { savePoliciesAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { getPolicyOptions, getPolicyFieldOptions } from "@/lib/taxonomies/policies";
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

// ── Field heading (icon-led — mirrors the per-rule icon anatomy of the
// page-normas kit, where every rule leads with a circular Lucide glyph in a
// tinted badge: `.rn-ic` 32×32 accent for narrative rows). We use the
// canonical <IconBadge tone="primary" size="md"> so the accent circle reads
// as the kit's leading affordance, not a flat inline glyph. ──

function FieldHeading({
  icon,
  label,
  hint,
  tooltip,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  tooltip?: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <IconBadge icon={icon} tone="primary" size="md" iconSize={16} />
      <div className="min-w-0 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        {hint && <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{hint}</p>}
      </div>
    </div>
  );
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

  // ── Shared styles (Liora semantic tokens) ──
  const inputCls = "block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none";
  const labelCls = "block text-sm font-medium text-[var(--color-text-primary)]";
  const subLabelCls = "block text-xs text-[var(--color-text-secondary)] mt-0.5 mb-2";

  // Switch: the visual track (h-6) sits inside a 44-tall button so the hit
  // area meets the touch-target floor without inflating the control. The
  // background lives on the inner span, so the touch-target gate reads the
  // button as a min-h floor, not a fixed-square icon button. Tapping either
  // the track or the label toggles.
  function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-3 text-left"
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-[var(--color-action-primary)]" : "bg-[var(--color-border-strong)]"}`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
          />
        </span>
        <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        formData.set("policiesJson", JSON.stringify(buildPoliciesJson()));
        formAction(formData);
      }}
      className="mx-auto max-w-3xl px-6 py-8"
    >
      <PageHeader
        eyebrow="Propiedad · Normas"
        title="Normas de la casa"
        description="Lo que puede y no puede hacer el huésped. Escribe con el mismo tono con el que hablarías en persona — firme y cálido, no burocrático."
      />

      <input type="hidden" name="propertyId" value={propertyId} />

      {state?.error && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-status-error-bg)] p-3 text-sm text-[var(--color-status-error-text)]">
          {state.error}
        </p>
      )}

      {/* ── Block 1: Convivencia ── */}
      <NumberedSection number="01" title="Convivencia">
        <div className="space-y-6">
          {/* Quiet hours */}
          <div>
            <FieldHeading
              icon={Moon}
              label="Horario de silencio"
              tooltip="El horario de silencio se comunicará a los huéspedes en la guía. Establece las horas en las que se debe evitar ruido excesivo."
            />
            <Toggle checked={quietEnabled} onChange={setQuietEnabled} label="¿Hay restricción de ruido?" />
            {quietEnabled && (
              <div className="mt-3 flex items-center gap-3">
                <label className="block">
                  <span className="text-xs text-[var(--color-text-muted)]">Desde</span>
                  <select value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} className={inputCls}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--color-text-muted)]">Hasta</span>
                  <select value={quietTo} onChange={(e) => setQuietTo(e.target.value)} className={inputCls}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Smoking */}
          <div>
            <FieldHeading icon={Cigarette} label="Fumar" hint="Política de tabaco en la propiedad" />
            <RadioCardGroup name="_smoking" options={SMOKING_OPTIONS} value={smoking} onChange={(v) => setSmoking(v as PoliciesData["smoking"])} showRecommended={false} />
            {smoking === "designated_area" && (
              <label className="mt-3 block">
                <span className="text-xs text-[var(--color-text-muted)]">¿Dónde se puede fumar?</span>
                <input type="text" value={smokingArea} onChange={(e) => setSmokingArea(e.target.value)} placeholder="Ej: terraza trasera" className={inputCls} />
              </label>
            )}
          </div>

          {/* Events */}
          <div>
            <FieldHeading icon={PartyPopper} label="Eventos y reuniones" hint="Política sobre reuniones y eventos en la propiedad" />
            <RadioCardGroup name="_events" options={EVENTS_OPTIONS} value={eventsPolicy} onChange={(v) => setEventsPolicy(v as PoliciesData["events"]["policy"])} showRecommended={false} />
            {eventsPolicy === "small_gatherings" && (
              <div className="mt-3">
                <NumberStepper label="Máximo de personas" value={eventsMaxPeople} onChange={setEventsMaxPeople} min={2} max={50} />
              </div>
            )}
            {eventsPolicy === "with_approval" && (
              <label className="mt-3 block">
                <span className="text-xs text-[var(--color-text-muted)]">Instrucciones para solicitar aprobación</span>
                <textarea value={eventsApproval} onChange={(e) => setEventsApproval(e.target.value)} rows={2} placeholder="Ej: contactar al anfitrión con 48h de antelación" className={inputCls} />
              </label>
            )}
          </div>

          {/* Commercial photography */}
          <div>
            <FieldHeading icon={Camera} label="Fotografía / filmación comercial" hint="Uso comercial de la propiedad para sesiones de foto o vídeo" />
            <RadioCardGroup name="_photo" options={PHOTOGRAPHY_OPTIONS} value={commercialPhoto} onChange={(v) => setCommercialPhoto(v as PoliciesData["commercialPhotography"])} showRecommended={false} />
          </div>
        </div>
      </NumberedSection>

      {/* ── Block 2: Mascotas ── */}
      <NumberedSection number="02" title="Mascotas">
        <div className="space-y-6">
          <Toggle checked={petsAllowed} onChange={setPetsAllowed} label="¿Se admiten mascotas?" />

          {petsAllowed ? (
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
                  <label className="mt-3 block">
                    <span className="text-xs text-[var(--color-text-muted)]">Importe (EUR)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={petFeeAmount}
                      onChange={(e) => setPetFeeAmount(Number(e.target.value))}
                      className={`${inputCls} max-w-[10rem]`}
                    />
                  </label>
                )}
              </div>

              {/* Restrictions */}
              <div>
                <span className={labelCls}>Restricciones adicionales</span>
                <CheckboxCardGroup name="_petRestrictions" options={PET_RESTRICTION_OPTIONS} value={petRestrictions} onChange={setPetRestrictions} showRecommended={false} />
              </div>

              {/* Service animals info */}
              <div className="rounded-[var(--radius-md)] bg-[var(--color-action-primary-subtle)] p-3">
                <p className="text-xs text-[var(--color-action-primary-subtle-fg)]">
                  Los animales de servicio / asistencia están siempre permitidos sin cargo adicional, según la legislación vigente.
                </p>
              </div>

              {/* Notes */}
              <label className="block">
                <span className={labelCls}>Notas adicionales</span>
                <span className={subLabelCls}>Información extra sobre la política de mascotas (opcional)</span>
                <textarea value={petNotes} onChange={(e) => setPetNotes(e.target.value)} rows={2} placeholder="Ej: se requiere documentación veterinaria al día" className={inputCls} />
              </label>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              No se admiten mascotas en la propiedad. Si más adelante quieres recibirlas, aquí defines tipos, tamaño y suplementos.
            </p>
          )}
        </div>
      </NumberedSection>

      {/* ── Block 3: Suplementos ── */}
      <NumberedSection number="03" title="Suplementos y cargos">
        <div className="space-y-6">
          {/* Cleaning fee */}
          <div>
            <FieldHeading
              icon={SprayCan}
              label="Suplemento de limpieza"
              tooltip="Cargo único que se aplica una vez por reserva, independientemente de la duración de la estancia."
            />
            <Toggle checked={cleaningEnabled} onChange={setCleaningEnabled} label="¿Se cobra suplemento de limpieza?" />
            {cleaningEnabled && (
              <label className="mt-3 block">
                <span className="text-xs text-[var(--color-text-muted)]">Importe (EUR)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cleaningAmount}
                  onChange={(e) => setCleaningAmount(Number(e.target.value))}
                  className={`${inputCls} max-w-[10rem]`}
                />
              </label>
            )}
          </div>

          {/* Extra guest fee */}
          <div>
            <FieldHeading
              icon={UserPlus}
              label="Suplemento por huésped extra"
              tooltip="Cargo adicional por noche para cada huésped que exceda el límite base. Se aplica por noche y por persona."
            />
            <Toggle checked={extraGuestEnabled} onChange={setExtraGuestEnabled} label="¿Se cobra suplemento por huésped extra?" />
            {extraGuestEnabled && (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-xs text-[var(--color-text-muted)]">Importe por huésped extra (EUR / noche)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={extraGuestAmount}
                    onChange={(e) => setExtraGuestAmount(Number(e.target.value))}
                    className={`${inputCls} max-w-[10rem]`}
                  />
                </label>
                <div>
                  <NumberStepper label="A partir de cuántos huéspedes" value={extraGuestFrom} onChange={setExtraGuestFrom} min={1} max={propertyDefaults.maxGuests ?? 20} />
                  <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                    Máximo de huéspedes: {propertyDefaults.maxGuests ?? "—"} ·{" "}
                    <Link href={`/properties/${propertyId}/property`} className="text-[var(--color-text-link)] underline">
                      Editar en Propiedad
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Pet fee reference */}
          {petsAllowed && petFeeMode !== "none" && (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-default)] p-3">
              <span className="text-xs text-[var(--color-text-muted)]">Suplemento por mascota</span>
              <p className="text-sm text-[var(--color-text-primary)]">
                {petFeeAmount} EUR / {PET_FEE_OPTIONS.find((o) => o.id === petFeeMode)?.label?.toLowerCase()}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Se configura en la sección Mascotas.
              </p>
            </div>
          )}
        </div>
      </NumberedSection>

      {/* ── Block 4: Servicios ── */}
      <NumberedSection number="04" title="Servicios permitidos">
        <div className="space-y-6">
          <Toggle checked={servicesAllowed} onChange={setServicesAllowed} label="¿Se permite contratar servicios externos?" />

          {servicesAllowed ? (
            <>
              <div>
                <span className={labelCls}>Tipos de servicio permitidos</span>
                <span className={subLabelCls}>Selecciona los servicios que los huéspedes pueden contratar</span>
                <CheckboxCardGroup name="_serviceTypes" options={SERVICE_TYPE_OPTIONS} value={serviceTypes} onChange={setServiceTypes} showRecommended={false} />
              </div>
              <label className="block">
                <span className={labelCls}>Notas sobre servicios</span>
                <textarea value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)} rows={2} placeholder="Ej: coordinar con el anfitrión con 24h de antelación" className={inputCls} />
              </label>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Los huéspedes no pueden contratar servicios externos durante la estancia. Si en el futuro quieres ofrecerlos, configúralos aquí.
            </p>
          )}
        </div>
      </NumberedSection>

      {/* ── Submit ── */}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-6 py-2.5 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar normas"}
        </button>
        {saveStatus && <InlineSaveStatus status={saveStatus} />}
      </div>
    </form>
  );
}
