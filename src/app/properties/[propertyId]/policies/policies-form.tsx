"use client";

import { useActionState, useState, useRef, type ReactNode } from "react";
import {
  Moon,
  Cigarette,
  PartyPopper,
  Camera,
  SprayCan,
  UserPlus,
  CheckCheck,
  CircleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { IconBadge } from "@/components/ui/icon-badge";
import { Switch } from "@/components/ui/switch";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { Tooltip } from "@/components/ui/tooltip";
import { InlineStepper } from "@/components/ui/inline-stepper";
import { FieldInput, FieldTextarea } from "@/components/ui/field";
import { Banner } from "@/components/ui/banner";
import { TextLink } from "@/components/ui/text-link";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { autoSaveSubmit, useFormAutoSave } from "@/lib/use-form-auto-save";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { savePoliciesAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import type { TaxonomyOption } from "@/lib/types/taxonomy";
import { getPolicyOptions, getPolicyFieldOptions } from "@/lib/taxonomies/policies";
import type { PoliciesData } from "@/lib/schemas/editor.schema";
import {
  policyMissingSignals,
  POLICY_RULE_COUNT,
  slotToHHMM,
  hhmmToSlot,
} from "./policy-progress";

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
// tinted badge. The `value` slot is the kit's right-aligned `.val` (rule-narr) —
// used only where the value isn't already visible as an active chip below. ──

function FieldHeading({
  icon,
  label,
  hint,
  tooltip,
  value,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  tooltip?: string;
  value?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <IconBadge icon={icon} tone="primary" size="md" iconSize={16} />
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
          {tooltip && <InfoTooltip text={tooltip} />}
          {value != null && (
            <span className="ml-auto text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
              {value}
            </span>
          )}
        </div>
        {hint && <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{hint}</p>}
      </div>
    </div>
  );
}

// ── Switch + visible (non-clickable) label. Wrapping both in a button would
// nest buttons (invalid HTML), so the label-click is dropped by design — the
// Switch keeps its own 44px hit area and aria-label. ──

function SwitchRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <Switch checked={checked} onChange={onChange} ariaLabel={label} size="md" />
      <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
    </div>
  );
}

// ── Policy enum chips (single-select, no null state — the schema always has a
// value) + multiselect chips; both mirror the Spaces gold standard, descriptions
// surfaced via the canonical Tooltip. ──

function PolicyEnumChips({
  options,
  value,
  onChange,
}: {
  options: TaxonomyOption[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Tooltip key={opt.id} text={opt.description}>
          <ToggleChip active={value === opt.id} hideCheck onToggle={() => onChange(opt.id)}>
            {opt.label}
          </ToggleChip>
        </Tooltip>
      ))}
    </div>
  );
}

function PolicyMultiChips({
  options,
  value,
  onChange,
}: {
  options: TaxonomyOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const checked = value.includes(opt.id);
        return (
          <Tooltip key={opt.id} text={opt.description}>
            <ToggleChip
              active={checked}
              onToggle={() =>
                onChange(checked ? value.filter((id) => id !== opt.id) : [...value, opt.id])
              }
            >
              {opt.label}
            </ToggleChip>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── Quiet-hours range — one InlineStepper per bound, slot 0–47 (30-min steps),
// cyclic wrap (23:30 → 00:00 in one click), formatted HH:MM. Labels above. ──

function TimeRangeSteppers({
  fromSlot,
  toSlot,
  onFromChange,
  onToChange,
}: {
  fromSlot: number;
  toSlot: number;
  onFromChange: (slot: number) => void;
  onToChange: (slot: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-primary)]">Desde</p>
        <InlineStepper
          value={fromSlot}
          min={0}
          max={47}
          wrap
          format={slotToHHMM}
          label="hora de inicio del silencio"
          onChange={onFromChange}
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-primary)]">Hasta</p>
        <InlineStepper
          value={toSlot}
          min={0}
          max={47}
          wrap
          format={slotToHHMM}
          label="hora de fin del silencio"
          onChange={onToChange}
        />
      </div>
    </div>
  );
}

// Indented reveal wrapper for conditional sub-fields (mirrors the Spaces
// shown_if indent).
function Reveal({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 space-y-3 border-l-2 border-[var(--color-border-default)] pl-4">
      {children}
    </div>
  );
}

function FieldLabelXs({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-primary)]">{children}</p>
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
  const [quietFromSlot, setQuietFromSlot] = useState(hhmmToSlot(initial.quietHours.from ?? "22:00"));
  const [quietToSlot, setQuietToSlot] = useState(hhmmToSlot(initial.quietHours.to ?? "08:00"));
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

  // Build the typed JSON for submission (per render — cheap). Both the hidden
  // mirror and the autosave `watch` signal read this same string.
  function buildPoliciesJson(): PoliciesData {
    return {
      quietHours: {
        enabled: quietEnabled,
        ...(quietEnabled ? { from: slotToHHMM(quietFromSlot), to: slotToHHMM(quietToSlot) } : {}),
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

  const data = buildPoliciesJson();
  const policiesJson = JSON.stringify(data);

  // Auto-save: edits persist as you make them (no "Guardar" button). The payload
  // is built state→JSON, so the watch string (same as the hidden mirror) is the
  // authoritative change signal — toggles/steppers/chips have no `name`. The
  // hidden-mirror pattern (identical to featuresJson in space-card) carries the
  // JSON to the action; the action persists partial-but-shape-valid JSON
  // (completeness is a UI signal, never a persistence gate).
  const formRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(formRef, 700, () => policiesJson);

  // Header chips — live counts from the policy-progress missing-signals (honest
  // "X de 8 definidas / N por completar", computed from the live state).
  const missing = policyMissingSignals(data);
  const defined = POLICY_RULE_COUNT - missing.length;

  return (
    <form ref={formRef} onSubmit={autoSaveSubmit(formAction)}>
      <PageHeader
        eyebrow="Propiedad · Normas"
        title="Normas de la casa"
        description="Lo que puede y no puede hacer el huésped. Escribe con el mismo tono con el que hablarías en persona — firme y cálido, no burocrático."
        actions={<AutoSaveStatus pending={pending} />}
        chips={
          <>
            <PageHeaderChip
              icon={CheckCheck}
              label={
                <>
                  <b className="font-semibold text-[var(--color-text-primary)]">{defined}</b> de{" "}
                  {POLICY_RULE_COUNT} definidas
                </>
              }
            />
            {missing.length > 0 && (
              <Tooltip text={`Falta: ${missing.join(" · ")}`}>
                <PageHeaderChip
                  icon={CircleAlert}
                  label={
                    <>
                      <b className="font-semibold text-[var(--color-text-primary)]">
                        {missing.length}
                      </b>{" "}
                      por completar
                    </>
                  }
                />
              </Tooltip>
            )}
          </>
        }
      />

      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="policiesJson" value={policiesJson} />

      {state?.error && (
        <div className="mb-4">
          <Banner type="danger" message={state.error} />
        </div>
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
              value={quietEnabled ? `${slotToHHMM(quietFromSlot)} – ${slotToHHMM(quietToSlot)}` : undefined}
            />
            <SwitchRow checked={quietEnabled} onChange={setQuietEnabled} label="¿Hay restricción de ruido?" />
            {quietEnabled && (
              <Reveal>
                <TimeRangeSteppers
                  fromSlot={quietFromSlot}
                  toSlot={quietToSlot}
                  onFromChange={setQuietFromSlot}
                  onToChange={setQuietToSlot}
                />
              </Reveal>
            )}
          </div>

          {/* Smoking */}
          <div>
            <FieldHeading icon={Cigarette} label="Fumar" hint="Política de tabaco en la propiedad" />
            <PolicyEnumChips
              options={SMOKING_OPTIONS}
              value={smoking}
              onChange={(v) => setSmoking(v as PoliciesData["smoking"])}
            />
            {smoking === "designated_area" && (
              <Reveal>
                <FieldInput
                  label="¿Dónde se puede fumar?"
                  type="text"
                  value={smokingArea}
                  placeholder="Ej: terraza trasera"
                  onChange={(e) => setSmokingArea(e.target.value)}
                />
              </Reveal>
            )}
          </div>

          {/* Events */}
          <div>
            <FieldHeading icon={PartyPopper} label="Eventos y reuniones" hint="Política sobre reuniones y eventos en la propiedad" />
            <PolicyEnumChips
              options={EVENTS_OPTIONS}
              value={eventsPolicy}
              onChange={(v) => setEventsPolicy(v as PoliciesData["events"]["policy"])}
            />
            {eventsPolicy === "small_gatherings" && (
              <Reveal>
                <div>
                  <FieldLabelXs>Máximo de personas</FieldLabelXs>
                  <InlineStepper
                    value={eventsMaxPeople}
                    min={2}
                    max={50}
                    label="máximo de personas"
                    onChange={setEventsMaxPeople}
                  />
                </div>
              </Reveal>
            )}
            {eventsPolicy === "with_approval" && (
              <Reveal>
                <FieldTextarea
                  label="Instrucciones para solicitar aprobación"
                  rows={2}
                  value={eventsApproval}
                  placeholder="Ej: avisar al anfitrión con 48 h de antelación"
                  onChange={(e) => setEventsApproval(e.target.value)}
                />
              </Reveal>
            )}
          </div>

          {/* Commercial photography */}
          <div>
            <FieldHeading icon={Camera} label="Fotografía / filmación comercial" hint="Uso comercial de la propiedad para sesiones de foto o vídeo" />
            <PolicyEnumChips
              options={PHOTOGRAPHY_OPTIONS}
              value={commercialPhoto}
              onChange={(v) => setCommercialPhoto(v as PoliciesData["commercialPhotography"])}
            />
          </div>
        </div>
      </NumberedSection>

      {/* ── Block 2: Mascotas ── */}
      <NumberedSection number="02" title="Mascotas">
        <div className="space-y-6">
          <SwitchRow checked={petsAllowed} onChange={setPetsAllowed} label="¿Se admiten mascotas?" />

          {petsAllowed ? (
            <>
              {/* Pet types */}
              <div>
                <FieldLabelXs>Tipos permitidos</FieldLabelXs>
                <PolicyMultiChips options={PET_TYPE_OPTIONS} value={petTypes} onChange={setPetTypes} />
              </div>

              {/* Size restriction */}
              <div>
                <FieldLabelXs>Restricción de tamaño</FieldLabelXs>
                <PolicyEnumChips
                  options={PET_SIZE_OPTIONS}
                  value={petSize}
                  onChange={(v) => setPetSize(v as NonNullable<PoliciesData["pets"]["sizeRestriction"]>)}
                />
                {petSize === "custom_weight" && (
                  <Reveal>
                    <div>
                      <FieldLabelXs>Peso máximo</FieldLabelXs>
                      <InlineStepper
                        value={petMaxWeight}
                        min={1}
                        max={100}
                        format={(n) => `${n} kg`}
                        label="peso máximo de la mascota"
                        onChange={setPetMaxWeight}
                      />
                    </div>
                  </Reveal>
                )}
              </div>

              {/* Max count */}
              <div>
                <FieldLabelXs>Número máximo de mascotas</FieldLabelXs>
                <InlineStepper
                  value={petMaxCount}
                  min={1}
                  max={10}
                  label="número máximo de mascotas"
                  onChange={setPetMaxCount}
                />
              </div>

              {/* Fee */}
              <div>
                <FieldLabelXs>Cargos por mascota</FieldLabelXs>
                <PolicyEnumChips
                  options={PET_FEE_OPTIONS}
                  value={petFeeMode}
                  onChange={(v) => setPetFeeMode(v as NonNullable<PoliciesData["pets"]["feeMode"]>)}
                />
                {petFeeMode !== "none" && (
                  <Reveal>
                    <div className="w-36">
                      <FieldInput
                        label="Importe (EUR)"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={petFeeAmount}
                        onChange={(e) => setPetFeeAmount(Number(e.target.value))}
                      />
                    </div>
                  </Reveal>
                )}
              </div>

              {/* Restrictions */}
              <div>
                <FieldLabelXs>Restricciones adicionales</FieldLabelXs>
                <PolicyMultiChips
                  options={PET_RESTRICTION_OPTIONS}
                  value={petRestrictions}
                  onChange={setPetRestrictions}
                />
              </div>

              {/* Service animals info */}
              <Banner
                type="info"
                message="Los animales de servicio / asistencia están siempre permitidos sin cargo adicional, según la legislación vigente."
              />

              {/* Notes */}
              <FieldTextarea
                label="Notas adicionales"
                help="Información extra sobre la política de mascotas (opcional)"
                rows={2}
                value={petNotes}
                placeholder="Ej: se requiere documentación veterinaria al día"
                onChange={(e) => setPetNotes(e.target.value)}
              />
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
              value={cleaningEnabled && cleaningAmount > 0 ? `${cleaningAmount} EUR` : undefined}
            />
            <SwitchRow checked={cleaningEnabled} onChange={setCleaningEnabled} label="¿Se cobra suplemento de limpieza?" />
            {cleaningEnabled && (
              <Reveal>
                <div className="w-36">
                  <FieldInput
                    label="Importe (EUR)"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={cleaningAmount}
                    onChange={(e) => setCleaningAmount(Number(e.target.value))}
                  />
                </div>
              </Reveal>
            )}
          </div>

          {/* Extra guest fee */}
          <div>
            <FieldHeading
              icon={UserPlus}
              label="Suplemento por huésped extra"
              tooltip="Cargo adicional por noche para cada huésped que exceda el límite base. Se aplica por noche y por persona."
              value={extraGuestEnabled && extraGuestAmount > 0 ? `${extraGuestAmount} EUR/noche` : undefined}
            />
            <SwitchRow checked={extraGuestEnabled} onChange={setExtraGuestEnabled} label="¿Se cobra suplemento por huésped extra?" />
            {extraGuestEnabled && (
              <Reveal>
                <div className="w-44">
                  <FieldInput
                    label="Importe por huésped extra (EUR / noche)"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={extraGuestAmount}
                    onChange={(e) => setExtraGuestAmount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <FieldLabelXs>A partir de cuántos huéspedes</FieldLabelXs>
                  <InlineStepper
                    value={extraGuestFrom}
                    min={1}
                    max={propertyDefaults.maxGuests ?? 20}
                    label="a partir de cuántos huéspedes"
                    onChange={setExtraGuestFrom}
                  />
                  <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                    Máximo de huéspedes: {propertyDefaults.maxGuests ?? "—"} ·{" "}
                    <TextLink size="xs" href={`/properties/${propertyId}/property`}>
                      Editar en Propiedad
                    </TextLink>
                  </p>
                </div>
              </Reveal>
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

      {/* ── Block 4: Servicios externos ── */}
      <NumberedSection number="04" title="Servicios externos">
        <div className="space-y-6">
          <SwitchRow checked={servicesAllowed} onChange={setServicesAllowed} label="¿Se permite contratar servicios externos?" />

          {servicesAllowed ? (
            <>
              <div>
                <FieldLabelXs>Tipos de servicio permitidos</FieldLabelXs>
                <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
                  Selecciona los servicios que los huéspedes pueden contratar
                </p>
                <PolicyMultiChips
                  options={SERVICE_TYPE_OPTIONS}
                  value={serviceTypes}
                  onChange={setServiceTypes}
                />
              </div>
              <FieldTextarea
                label="Notas sobre servicios"
                rows={2}
                value={serviceNotes}
                placeholder="Ej: coordinar con el anfitrión con 24h de antelación"
                onChange={(e) => setServiceNotes(e.target.value)}
              />
            </>
          ) : (
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Los huéspedes no pueden contratar servicios externos durante la estancia. Si en el futuro quieres ofrecerlos, configúralos aquí.
            </p>
          )}
        </div>
      </NumberedSection>
    </form>
  );
}
