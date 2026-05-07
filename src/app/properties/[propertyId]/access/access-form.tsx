"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  Camera,
  Clock,
  Clock4,
  FileText,
  Key,
  MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { TextLink } from "@/components/ui/text-link";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
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
import type { ItemTaxonomyFile } from "@/lib/types/taxonomy";
import { EntityGallery } from "@/components/media/entity-gallery";
import {
  ACCESS_COCKPIT_IDS,
  ACCESS_USAGE_KEYS,
  SUBSYSTEM_HEADER_ICONS,
  type AccessCockpitId,
  buildingIconFor,
  unitIconFor,
  parkingIconFor,
  accessibilityIconFor,
} from "@/lib/icons/access-icons";
import { CockpitGrid, type CardRole } from "./_components/cockpit-grid";
import { SubsystemCard, type SubsystemStatus } from "./_components/subsystem-card";
import { MethodList } from "./_components/method-list";
import { MethodRow } from "./_components/method-row";
import { ArrivalSteps, type ArrivalStepStatus } from "./_components/arrival-steps";

const AUTONOMOUS_UNIT_IDS = ["am.smart_lock", "am.keypad", "am.lockbox"];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

interface AccessibilityGroup {
  key: string;
  label: string;
  ids: readonly string[];
}

const ACCESSIBILITY_GROUPS: readonly AccessibilityGroup[] = [
  {
    key: "entrance",
    label: "Entrada y recorrido",
    ids: [
      "ax.single_level_home",
      "ax.step_free_guest_entrance",
      "ax.guest_entrance_wide_81cm",
      "ax.step_free_path_to_entrance",
      "ax.accessible_parking_spot",
    ],
  },
  {
    key: "interior",
    label: "Movilidad interior",
    ids: ["ax.step_free_bedroom_access", "ax.bedroom_entrance_wide_81cm"],
  },
  {
    key: "bathroom",
    label: "Baño",
    ids: [
      "ax.step_free_bathroom_access",
      "ax.bathroom_entrance_wide_81cm",
      "ax.step_free_shower",
      "ax.shower_grab_bar",
      "ax.toilet_grab_bar",
    ],
  },
  {
    key: "equipment",
    label: "Equipamiento",
    ids: ["ax.shower_bath_chair", "ax.ceiling_mobile_hoist"],
  },
  {
    key: "other",
    label: "Otra característica",
    ids: ["ax.other"],
  },
];

function sameStringList(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function statusFor(
  arr: string[],
  customLabel: string | null | undefined,
  customSentinel: string | null,
  primary?: string | null,
): SubsystemStatus {
  if (arr.length === 0) return "empty";
  // *.other selected without a custom label = layer is incomplete, not configured.
  // Operator picked "Otro" but never typed the name → reality says "por completar".
  if (customSentinel && arr.includes(customSentinel) && !customLabel?.trim())
    return "pending";
  // If the layer carries a primary concept and the stored primary is no longer
  // among the selected methods (deselected without re-promotion), the layer
  // is in an inconsistent state.
  if (primary !== undefined && primary !== null && !arr.includes(primary))
    return "pending";
  return "configured";
}

// Wrap state updates that change item order in a View Transition so the rows
// FLIP-animate to their new positions. flushSync is required so React commits
// synchronously inside the transition callback (otherwise the new DOM would not
// be ready when the browser captures the "after" snapshot).
function withViewTransition(update: () => void): void {
  if (
    typeof document !== "undefined" &&
    typeof (
      document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      }
    ).startViewTransition === "function"
  ) {
    (
      document as Document & { startViewTransition: (cb: () => void) => unknown }
    ).startViewTransition(() => {
      flushSync(update);
    });
    return;
  }
  update();
}

// Selected-first ordering for method rows. Within "selected", primary (if any)
// goes first; the rest preserve taxonomy order. Within "unselected", taxonomy
// order is preserved.
function sortSelectedFirst<T extends { id: string }>(
  items: readonly T[],
  selected: readonly string[],
  primary?: string | null,
): T[] {
  const sel = items.filter((it) => selected.includes(it.id));
  const rest = items.filter((it) => !selected.includes(it.id));
  if (!primary) return [...sel, ...rest];
  const primaryItem = sel.filter((it) => it.id === primary);
  const others = sel.filter((it) => it.id !== primary);
  return [...primaryItem, ...others, ...rest];
}

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function countWords(s: string | null): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function stepStatus(hasContent: boolean, photoCount: number): ArrivalStepStatus {
  if (hasContent && photoCount >= 1) return "done";
  if (hasContent || photoCount >= 1) return "cur";
  return "empty";
}

// Effective primary = operator's explicit choice if still selected, else first
// selected method, else null. Used both for the hidden form field and for the
// collapsed-card icon strip's primary highlight.
function pickPrimary(selected: readonly string[], stored: string | null): string | null {
  if (selected.length === 0) return null;
  if (stored && selected.includes(stored)) return stored;
  return selected[0];
}

interface SubsystemItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

// Build the icon-strip items the SubsystemCard consumes. Order is the operator's
// selection order; the card re-orders to primary-first internally.
function toSubsystemItems(
  ids: readonly string[],
  taxonomy: ItemTaxonomyFile,
  iconFor: (id: string) => LucideIcon,
): SubsystemItem[] {
  return ids
    .map((id): SubsystemItem | null => {
      const item = findItem(taxonomy, id);
      return item ? { id, icon: iconFor(id), label: item.label } : null;
    })
    .filter((it): it is SubsystemItem => it !== null);
}

// ESC handler must NOT collapse the cockpit while the user is typing inside an
// input/textarea/select/contenteditable — that would feel like the editor swallowed
// their work. Restrict collapse-on-ESC to non-editable focus targets.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

interface AccessFormProps {
  propertyId: string;
  publicSlug: string | null;
  streetAddress: string | null;
  propertyMediaCount: number;
  buildingPhotoCount: number;
  unitPhotoCount: number;
  parkingPhotoCount: number;
  accessibilityPhotoCount: number;
  legacyAccessPhotoCount: number;
  property: {
    checkInStart: string | null;
    checkInEnd: string | null;
    checkOutTime: string | null;
    buildingAccess: {
      methods: string[];
      customLabel?: string | null;
      customDesc?: string | null;
      primary?: string | null;
    } | null;
    unitAccess: {
      methods: string[];
      customLabel?: string | null;
      customDesc?: string | null;
    } | null;
    primaryUnitMethod: string | null;
    parkingTypes: string[];
    parkingCustomLabel: string | null;
    parkingCustomDesc: string | null;
    parkingPrimary: string | null;
    accessibilityFeatures: string[];
    accessibilityCustomLabel: string | null;
    accessibilityCustomDesc: string | null;
  };
}

export function AccessForm({
  propertyId,
  publicSlug,
  streetAddress,
  propertyMediaCount,
  buildingPhotoCount,
  unitPhotoCount,
  parkingPhotoCount,
  accessibilityPhotoCount,
  legacyAccessPhotoCount,
  property: p,
}: AccessFormProps) {
  const [checkInStart, setCheckInStart] = useState(p.checkInStart ?? "16:00");
  const [checkInEnd, setCheckInEnd] = useState(p.checkInEnd ?? "22:00");
  const [checkOutTime, setCheckOutTime] = useState(p.checkOutTime ?? "11:00");
  const [buildingMethods, setBuildingMethods] = useState<string[]>(
    p.buildingAccess?.methods ?? [],
  );
  const [unitMethods, setUnitMethods] = useState<string[]>(p.unitAccess?.methods ?? []);
  const [parkingTypes, setParkingTypes] = useState<string[]>(p.parkingTypes);
  const [axFeatures, setAxFeatures] = useState<string[]>(p.accessibilityFeatures);
  const [buildingCustomLabel, setBuildingCustomLabel] = useState(
    p.buildingAccess?.customLabel ?? "",
  );
  const [buildingCustomDesc, setBuildingCustomDesc] = useState(
    p.buildingAccess?.customDesc ?? "",
  );
  const [unitCustomLabel, setUnitCustomLabel] = useState(
    p.unitAccess?.customLabel ?? "",
  );
  const [unitCustomDesc, setUnitCustomDesc] = useState(p.unitAccess?.customDesc ?? "");
  const [parkingCustomLabel, setParkingCustomLabel] = useState(
    p.parkingCustomLabel ?? "",
  );
  const [parkingCustomDesc, setParkingCustomDesc] = useState(
    p.parkingCustomDesc ?? "",
  );
  const [axCustomLabel, setAxCustomLabel] = useState(
    p.accessibilityCustomLabel ?? "",
  );
  const [axCustomDesc, setAxCustomDesc] = useState(
    p.accessibilityCustomDesc ?? "",
  );
  // Primary marker per layer (NOT accessibility — a11y features are independent
  // attributes, not a primary/secondary hierarchy). Stored as the user's
  // explicit choice; the "effective" primary is derived against the current
  // selected set so a deselected primary auto-falls-back to methods[0].
  const [primaryBuilding, setPrimaryBuilding] = useState<string | null>(
    p.buildingAccess?.primary ?? null,
  );
  const [primaryUnit, setPrimaryUnit] = useState<string | null>(
    p.primaryUnitMethod ?? null,
  );
  const [primaryParking, setPrimaryParking] = useState<string | null>(
    p.parkingPrimary ?? null,
  );

  const [expandedCard, setExpandedCard] = useState<AccessCockpitId | null>(null);

  // View Transitions API: morphs each card from idle position+size to expanded
  // (and back) without flicker. Falls back to snap behavior if unsupported.
  //
  // The `vt-expand` class on <html> is the discriminator that prevents the
  // expand-desync regression: MethodRow rows carry `view-transition-name:
  // method-row-${id}` so they FLIP during primary-swap, but if those names
  // were honored during expand the rows would escape the parent card's
  // snapshot and animate independently — content would arrive ahead of
  // silhouette. The CSS rule `html.vt-expand .method-row { view-transition-
  // name: none !important; }` short-circuits the row names ONLY while the
  // class is on <html>, so during expand the rows compose into the
  // cockpit-card snapshot and morph as one unit. The class is removed in
  // `finished.finally` so subsequent primary-swap transitions get the FLIP.
  const setExpandedCardAnimated = useCallback((next: AccessCockpitId | null) => {
    type DocVT = Document & {
      startViewTransition?: (cb: () => void) => { finished?: Promise<void> };
    };
    const docVT = document as DocVT;
    if (typeof document !== "undefined" && typeof docVT.startViewTransition === "function") {
      document.documentElement.classList.add("vt-expand");
      const transition = docVT.startViewTransition!(() => {
        flushSync(() => setExpandedCard(next));
      });
      transition.finished?.finally(() => {
        document.documentElement.classList.remove("vt-expand");
      });
      return;
    }
    setExpandedCard(next);
  }, []);

  useEffect(() => {
    if (!expandedCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isEditableTarget(e.target)) return;
      setExpandedCardAnimated(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedCard, setExpandedCardAnimated]);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveAccessAction,
    null,
  );

  const isAutonomousDerived =
    unitMethods.length > 0 && unitMethods.every((m) => AUTONOMOUS_UNIT_IDS.includes(m));
  const hasBuildingAccessDerived = buildingMethods.length > 0;

  // Effective primary = user's explicit choice if still selected, else first
  // selected method. The hidden form input emits this value, not raw state.
  const effectivePrimaryBuilding = pickPrimary(buildingMethods, primaryBuilding);
  const effectivePrimaryUnit = pickPrimary(unitMethods, primaryUnit);
  const effectivePrimaryParking = pickPrimary(parkingTypes, primaryParking);

  const isDirty =
    checkInStart !== (p.checkInStart ?? "16:00") ||
    checkInEnd !== (p.checkInEnd ?? "22:00") ||
    checkOutTime !== (p.checkOutTime ?? "11:00") ||
    !sameStringList(buildingMethods, p.buildingAccess?.methods ?? []) ||
    !sameStringList(unitMethods, p.unitAccess?.methods ?? []) ||
    !sameStringList(parkingTypes, p.parkingTypes) ||
    !sameStringList(axFeatures, p.accessibilityFeatures) ||
    buildingCustomLabel !== (p.buildingAccess?.customLabel ?? "") ||
    buildingCustomDesc !== (p.buildingAccess?.customDesc ?? "") ||
    unitCustomLabel !== (p.unitAccess?.customLabel ?? "") ||
    unitCustomDesc !== (p.unitAccess?.customDesc ?? "") ||
    parkingCustomLabel !== (p.parkingCustomLabel ?? "") ||
    parkingCustomDesc !== (p.parkingCustomDesc ?? "") ||
    axCustomLabel !== (p.accessibilityCustomLabel ?? "") ||
    axCustomDesc !== (p.accessibilityCustomDesc ?? "") ||
    effectivePrimaryBuilding !== (p.buildingAccess?.primary ?? null) ||
    effectivePrimaryUnit !== (p.primaryUnitMethod ?? null) ||
    effectivePrimaryParking !== (p.parkingPrimary ?? null);

  const checkInRangeText = checkInStart
    ? `A partir de las ${checkInStart}${checkInEnd === "flexible" ? ", sin hora límite" : `, hasta las ${checkInEnd}`}`
    : "Define un horario para que el huésped sepa cuándo puede llegar.";
  const arrivalBigHour = checkInStart.split(":")[0];
  const arrivalBigMin = checkInStart.split(":")[1];

  const status: "saving" | "saved" | "error" = pending
    ? "saving"
    : state?.error
      ? "error"
      : "saved";

  const allBuilding = getItems(buildingAccessMethods);
  const allUnit = getItems(accessMethods);
  const allParking = getItems(parkingOptions);

  const toggleMember = useCallback(
    <T,>(arr: T[], setArr: (next: T[]) => void, item: T) => {
      const idx = arr.indexOf(item);
      const next = idx === -1 ? [...arr, item] : arr.filter((_, i) => i !== idx);
      withViewTransition(() => setArr(next));
    },
    [],
  );

  const buildingStatus = statusFor(
    buildingMethods,
    buildingCustomLabel,
    "ba.other",
    effectivePrimaryBuilding,
  );
  const unitStatus = statusFor(
    unitMethods,
    unitCustomLabel,
    "am.other",
    effectivePrimaryUnit,
  );
  const parkingStatus = statusFor(
    parkingTypes,
    parkingCustomLabel,
    "pk.other",
    effectivePrimaryParking,
  );
  const axStatus = statusFor(axFeatures, axCustomLabel, "ax.other");

  // Selected items per layer — drives the collapsed-card icon strip.
  const buildingItems = toSubsystemItems(buildingMethods, buildingAccessMethods, buildingIconFor);
  const unitItems = toSubsystemItems(unitMethods, accessMethods, unitIconFor);
  const parkingItems = toSubsystemItems(parkingTypes, parkingOptions, parkingIconFor);
  const axItems = toSubsystemItems(axFeatures, accessibilityFeatures, accessibilityIconFor);

  const accessMethodMediaCount =
    buildingPhotoCount + unitPhotoCount + legacyAccessPhotoCount;

  const step1HasContent = Boolean(streetAddress && streetAddress.trim().length >= 10);
  const step2HasContent = buildingMethods.length > 0;
  const step3HasContent = unitMethods.length > 0;

  const buildingMethodsText =
    buildingMethods.length > 0
      ? buildingMethods
          .map((id) => findItem(buildingAccessMethods, id)?.label)
          .filter(Boolean)
          .join(" · ")
      : "Sin redactar — describe cómo entrar al portal o edificio.";
  const unitMethodsText =
    unitMethods.length > 0
      ? unitMethods
          .map((id) => findItem(accessMethods, id)?.label)
          .filter(Boolean)
          .join(" · ")
      : "Sin redactar — describe cómo abrir la puerta del piso.";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        eyebrow="Propiedad · Llegada"
        title="Llegada y acceso"
        description="La hora más frágil de toda la estancia. Documenta aquí cómo llegan, cómo entran y qué hacer en los primeros minutos."
        actions={
          <>
            <ButtonLink
              href={`/properties/${propertyId}`}
              variant="secondary"
              size="md"
            >
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
            <PageHeaderChip icon={Clock4} label="Check-in" value={checkInStart} />
            <PageHeaderChip icon={Clock} label="Check-out" value={checkOutTime} />
            {isAutonomousDerived && (
              <PageHeaderChip icon={Key} label="Entrada autónoma" />
            )}
            {hasBuildingAccessDerived && (
              <PageHeaderChip icon={MapPin} label="Edificio cerrado" />
            )}
          </>
        }
      />

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="propertyId" value={propertyId} />
        <input
          type="hidden"
          name="isAutonomousCheckin"
          value={isAutonomousDerived ? "true" : "false"}
        />
        <input
          type="hidden"
          name="hasBuildingAccess"
          value={hasBuildingAccessDerived ? "true" : "false"}
        />
        {buildingMethods.map((m) => (
          <input key={`bm-${m}`} type="hidden" name="buildingMethods" value={m} />
        ))}
        {unitMethods.map((m) => (
          <input key={`um-${m}`} type="hidden" name="unitMethods" value={m} />
        ))}
        {parkingTypes.map((m) => (
          <input key={`pk-${m}`} type="hidden" name="parkingTypes" value={m} />
        ))}
        {axFeatures.map((m) => (
          <input key={`ax-${m}`} type="hidden" name="accessibilityFeatures" value={m} />
        ))}
        <input type="hidden" name="checkInStart" value={checkInStart} />
        <input type="hidden" name="checkInEnd" value={checkInEnd} />
        <input type="hidden" name="checkOutTime" value={checkOutTime} />
        <input
          type="hidden"
          name="primaryBuildingMethod"
          value={effectivePrimaryBuilding ?? ""}
        />
        <input
          type="hidden"
          name="primaryUnitMethod"
          value={effectivePrimaryUnit ?? ""}
        />
        <input
          type="hidden"
          name="primaryParkingMethod"
          value={effectivePrimaryParking ?? ""}
        />
        {buildingMethods.includes("ba.other") && (
          <>
            <input
              type="hidden"
              name="buildingCustomLabel"
              value={buildingCustomLabel}
            />
            <input
              type="hidden"
              name="buildingCustomDesc"
              value={buildingCustomDesc}
            />
          </>
        )}
        {unitMethods.includes("am.other") && (
          <>
            <input type="hidden" name="unitCustomLabel" value={unitCustomLabel} />
            <input type="hidden" name="unitCustomDesc" value={unitCustomDesc} />
          </>
        )}
        {parkingTypes.includes("pk.other") && (
          <>
            <input
              type="hidden"
              name="parkingCustomLabel"
              value={parkingCustomLabel}
            />
            <input
              type="hidden"
              name="parkingCustomDesc"
              value={parkingCustomDesc}
            />
          </>
        )}
        {axFeatures.includes("ax.other") && (
          <>
            <input
              type="hidden"
              name="accessibilityCustomLabel"
              value={axCustomLabel}
            />
            <input
              type="hidden"
              name="accessibilityCustomDesc"
              value={axCustomDesc}
            />
          </>
        )}

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
                  <span className="ml-0.5 align-super text-[14px] font-medium opacity-70">
                    :{arrivalBigMin}
                  </span>
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
                {isAutonomousDerived
                  ? "El huésped puede entrar solo. Las llegadas tardías reciben las instrucciones por chat."
                  : hasBuildingAccessDerived
                    ? "Acceso a través de un edificio o recinto cerrado — coordina la llegada con el huésped."
                    : "Coordina la llegada con el huésped — alguien estará en la propiedad para recibirle."}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-[12px] text-[var(--color-text-secondary)]">
                Check-in desde *
              </span>
              <select
                value={checkInStart}
                onChange={(e) => setCheckInStart(e.target.value)}
                required
                className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] text-[var(--color-text-secondary)]">
                Check-in hasta *
              </span>
              <select
                value={checkInEnd}
                onChange={(e) => setCheckInEnd(e.target.value)}
                required
                className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none"
              >
                <option value="flexible">Sin límite (flexible)</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] text-[var(--color-text-secondary)]">
                Check-out *
              </span>
              <select
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                required
                className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </NumberedSection>

        <NumberedSection number="02" title="Acceso">
          <p className="mb-3 text-[12px] text-[var(--color-text-secondary)]">
            Pulsa una tarjeta para revisar o modificar.
          </p>
          <CockpitGrid expandedId={expandedCard} ids={ACCESS_COCKPIT_IDS}>
            {(id, role) => {
              const cardId = id as AccessCockpitId;
              if (cardId === "building") {
                return (
                  <SubsystemCard
                    role={role}
                    icon={SUBSYSTEM_HEADER_ICONS.building}
                    title="Edificio"
                    selectedItems={buildingItems}
                    primaryId={effectivePrimaryBuilding}
                    photoCount={buildingPhotoCount}
                    status={buildingStatus}
                    cockpitId="building"
                    onExpand={() => setExpandedCardAnimated("building")}
                    onCollapse={() => setExpandedCardAnimated(null)}
                    expandedSubtitle="Métodos para entrar al portal, recinto o comunidad. Si la vivienda no está dentro de un edificio cerrado, deja esta sección vacía."
                  >
                    <BuildingPanel
                      allBuilding={allBuilding}
                      buildingMethods={buildingMethods}
                      setBuildingMethods={setBuildingMethods}
                      buildingCustomLabel={buildingCustomLabel}
                      setBuildingCustomLabel={setBuildingCustomLabel}
                      buildingCustomDesc={buildingCustomDesc}
                      setBuildingCustomDesc={setBuildingCustomDesc}
                      toggleMember={toggleMember}
                      propertyId={propertyId}
                      primary={effectivePrimaryBuilding}
                      setPrimary={setPrimaryBuilding}
                    />
                  </SubsystemCard>
                );
              }
              if (cardId === "unit") {
                return (
                  <SubsystemCard
                    role={role}
                    icon={SUBSYSTEM_HEADER_ICONS.unit}
                    title="Vivienda"
                    selectedItems={unitItems}
                    primaryId={effectivePrimaryUnit}
                    photoCount={unitPhotoCount}
                    status={unitStatus}
                    cockpitId="unit"
                    onExpand={() => setExpandedCardAnimated("unit")}
                    onCollapse={() => setExpandedCardAnimated(null)}
                    expandedSubtitle="Métodos para abrir la puerta del piso o casa."
                  >
                    <UnitPanel
                      allUnit={allUnit}
                      unitMethods={unitMethods}
                      setUnitMethods={setUnitMethods}
                      unitCustomLabel={unitCustomLabel}
                      setUnitCustomLabel={setUnitCustomLabel}
                      unitCustomDesc={unitCustomDesc}
                      setUnitCustomDesc={setUnitCustomDesc}
                      toggleMember={toggleMember}
                      propertyId={propertyId}
                      legacyCount={legacyAccessPhotoCount}
                      primary={effectivePrimaryUnit}
                      setPrimary={setPrimaryUnit}
                    />
                  </SubsystemCard>
                );
              }
              if (cardId === "parking") {
                return (
                  <SubsystemCard
                    role={role}
                    icon={SUBSYSTEM_HEADER_ICONS.parking}
                    title="Aparcamiento"
                    selectedItems={parkingItems}
                    primaryId={effectivePrimaryParking}
                    photoCount={parkingPhotoCount}
                    status={parkingStatus}
                    cockpitId="parking"
                    onExpand={() => setExpandedCardAnimated("parking")}
                    onCollapse={() => setExpandedCardAnimated(null)}
                    expandedSubtitle="Tipos de aparcamiento disponibles para el huésped."
                  >
                    <ParkingPanel
                      allParking={allParking}
                      parkingTypes={parkingTypes}
                      setParkingTypes={setParkingTypes}
                      parkingCustomLabel={parkingCustomLabel}
                      setParkingCustomLabel={setParkingCustomLabel}
                      parkingCustomDesc={parkingCustomDesc}
                      setParkingCustomDesc={setParkingCustomDesc}
                      toggleMember={toggleMember}
                      propertyId={propertyId}
                      primary={effectivePrimaryParking}
                      setPrimary={setPrimaryParking}
                    />
                  </SubsystemCard>
                );
              }
              return (
                <SubsystemCard
                  role={role}
                  icon={SUBSYSTEM_HEADER_ICONS.accessibility}
                  title="Accesibilidad"
                  selectedItems={axItems}
                  primaryId={null}
                  photoCount={accessibilityPhotoCount}
                  status={axStatus}
                  cockpitId="accessibility"
                  onExpand={() => setExpandedCardAnimated("accessibility")}
                  onCollapse={() => setExpandedCardAnimated(null)}
                  expandedSubtitle="Características de accesibilidad de la entrada y zonas comunes. Las adaptaciones internas se configuran en cada espacio."
                >
                  <AccessibilityPanel
                    axFeatures={axFeatures}
                    setAxFeatures={setAxFeatures}
                    axCustomLabel={axCustomLabel}
                    setAxCustomLabel={setAxCustomLabel}
                    axCustomDesc={axCustomDesc}
                    setAxCustomDesc={setAxCustomDesc}
                    toggleMember={toggleMember}
                    propertyId={propertyId}
                  />
                </SubsystemCard>
              );
            }}
          </CockpitGrid>
        </NumberedSection>

        <NumberedSection
          number="03"
          title="Pasos de llegada"
          action={
            publicSlug && (
              <TextLink href={`/g/${publicSlug}/preview`} size="sm" arrow>
                Previsualizar guía
              </TextLink>
            )
          }
        >
          <ArrivalSteps
            items={[
              {
                id: "step-1",
                num: "Paso 1",
                title: "Cómo llegar",
                body: streetAddress
                  ? truncate(streetAddress, 140)
                  : "Sin redactar — añade la dirección de la propiedad para que el huésped sepa cómo llegar.",
                status: stepStatus(step1HasContent, propertyMediaCount),
                meta: [
                  {
                    icon: FileText,
                    label: `${countWords(streetAddress)} palabras`,
                  },
                  {
                    icon: Camera,
                    label: `${propertyMediaCount} ${propertyMediaCount === 1 ? "foto" : "fotos"}`,
                  },
                ],
              },
              {
                id: "step-2",
                num: "Paso 2",
                title: "Entrada al edificio",
                body: buildingMethodsText,
                status: stepStatus(step2HasContent, buildingPhotoCount),
                meta: [
                  {
                    icon: Camera,
                    label: `${buildingPhotoCount} ${buildingPhotoCount === 1 ? "foto" : "fotos"}`,
                  },
                ],
              },
              {
                id: "step-3",
                num: "Paso 3",
                title: "Abrir la puerta del piso",
                body: unitMethodsText,
                status: stepStatus(step3HasContent, unitPhotoCount),
                meta: [
                  {
                    icon: Camera,
                    label: `${accessMethodMediaCount} ${accessMethodMediaCount === 1 ? "foto" : "fotos"}`,
                  },
                ],
              },
            ]}
          />
        </NumberedSection>

        {state?.error && (
          <p className="text-sm text-[var(--color-status-error-text)]">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending || !isDirty}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-5 py-2.5 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}

// ── Sub-card panels (rendered inside SubsystemCard's expanded body) ──

interface BuildingPanelProps {
  allBuilding: ReturnType<typeof getItems>;
  buildingMethods: string[];
  setBuildingMethods: (next: string[]) => void;
  buildingCustomLabel: string;
  setBuildingCustomLabel: (s: string) => void;
  buildingCustomDesc: string;
  setBuildingCustomDesc: (s: string) => void;
  toggleMember: <T>(arr: T[], setArr: (next: T[]) => void, item: T) => void;
  propertyId: string;
  primary: string | null;
  setPrimary: (id: string | null) => void;
}

function BuildingPanel({
  allBuilding,
  buildingMethods,
  setBuildingMethods,
  buildingCustomLabel,
  setBuildingCustomLabel,
  buildingCustomDesc,
  setBuildingCustomDesc,
  toggleMember,
  propertyId,
  primary,
  setPrimary,
}: BuildingPanelProps) {
  const sortedBuilding = sortSelectedFirst(allBuilding, buildingMethods, primary);
  return (
    <div className="space-y-4">
      <MethodList>
        {sortedBuilding.map((item) => (
          <MethodRow
            key={item.id}
            id={item.id}
            icon={buildingIconFor(item.id)}
            name={item.label}
            description={item.description}
            selected={buildingMethods.includes(item.id)}
            recommended={item.recommended}
            onClick={() => toggleMember(buildingMethods, setBuildingMethods, item.id)}
            isOther={item.id === "ba.other"}
            customLabel={buildingCustomLabel}
            customDesc={buildingCustomDesc}
            onCustomLabelChange={setBuildingCustomLabel}
            onCustomDescChange={setBuildingCustomDesc}
            isPrimary={primary === item.id}
            onMakePrimary={() => withViewTransition(() => setPrimary(item.id))}
          />
        ))}
      </MethodList>
      <EntityGallery
        propertyId={propertyId}
        entityType="access_method"
        entityId={propertyId}
        usageKey={ACCESS_USAGE_KEYS.building}
        label="Fotos del edificio"
        defaultCollapsed
      />
    </div>
  );
}

interface UnitPanelProps {
  allUnit: ReturnType<typeof getItems>;
  unitMethods: string[];
  setUnitMethods: (next: string[]) => void;
  unitCustomLabel: string;
  setUnitCustomLabel: (s: string) => void;
  unitCustomDesc: string;
  setUnitCustomDesc: (s: string) => void;
  toggleMember: <T>(arr: T[], setArr: (next: T[]) => void, item: T) => void;
  propertyId: string;
  legacyCount: number;
  primary: string | null;
  setPrimary: (id: string | null) => void;
}

function UnitPanel({
  allUnit,
  unitMethods,
  setUnitMethods,
  unitCustomLabel,
  setUnitCustomLabel,
  unitCustomDesc,
  setUnitCustomDesc,
  toggleMember,
  propertyId,
  legacyCount,
  primary,
  setPrimary,
}: UnitPanelProps) {
  const sortedUnit = sortSelectedFirst(allUnit, unitMethods, primary);
  return (
    <div className="space-y-4">
      <MethodList>
        {sortedUnit.map((item) => (
          <MethodRow
            key={item.id}
            id={item.id}
            icon={unitIconFor(item.id)}
            name={item.label}
            description={item.description}
            selected={unitMethods.includes(item.id)}
            recommended={item.recommended}
            onClick={() => toggleMember(unitMethods, setUnitMethods, item.id)}
            isOther={item.id === "am.other"}
            customLabel={unitCustomLabel}
            customDesc={unitCustomDesc}
            onCustomLabelChange={setUnitCustomLabel}
            onCustomDescChange={setUnitCustomDesc}
            isPrimary={primary === item.id}
            onMakePrimary={() => withViewTransition(() => setPrimary(item.id))}
          />
        ))}
      </MethodList>
      <EntityGallery
        propertyId={propertyId}
        entityType="access_method"
        entityId={propertyId}
        usageKey={ACCESS_USAGE_KEYS.unit}
        label="Fotos de la vivienda"
        defaultCollapsed
      />
      {legacyCount > 0 && (
        <details className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] p-3">
          <summary className="cursor-pointer text-[12px] font-medium text-[var(--color-text-secondary)]">
            Fotos sin clasificar ({legacyCount})
          </summary>
          <div className="mt-3">
            <EntityGallery
              propertyId={propertyId}
              entityType="access_method"
              entityId={propertyId}
              usageKey={null}
              uploadDisabled
              compact
            />
          </div>
        </details>
      )}
    </div>
  );
}

interface ParkingPanelProps {
  allParking: ReturnType<typeof getItems>;
  parkingTypes: string[];
  setParkingTypes: (next: string[]) => void;
  parkingCustomLabel: string;
  setParkingCustomLabel: (s: string) => void;
  parkingCustomDesc: string;
  setParkingCustomDesc: (s: string) => void;
  toggleMember: <T>(arr: T[], setArr: (next: T[]) => void, item: T) => void;
  propertyId: string;
  primary: string | null;
  setPrimary: (id: string | null) => void;
}

function ParkingPanel({
  allParking,
  parkingTypes,
  setParkingTypes,
  parkingCustomLabel,
  setParkingCustomLabel,
  parkingCustomDesc,
  setParkingCustomDesc,
  toggleMember,
  propertyId,
  primary,
  setPrimary,
}: ParkingPanelProps) {
  const sortedParking = sortSelectedFirst(allParking, parkingTypes, primary);
  return (
    <div className="space-y-4">
      <MethodList>
        {sortedParking.map((item) => (
          <MethodRow
            key={item.id}
            id={item.id}
            icon={parkingIconFor(item.id)}
            name={item.label}
            description={item.description}
            selected={parkingTypes.includes(item.id)}
            recommended={item.recommended}
            onClick={() => toggleMember(parkingTypes, setParkingTypes, item.id)}
            isOther={item.id === "pk.other"}
            customLabel={parkingCustomLabel}
            customDesc={parkingCustomDesc}
            onCustomLabelChange={setParkingCustomLabel}
            onCustomDescChange={setParkingCustomDesc}
            isPrimary={primary === item.id}
            onMakePrimary={() => withViewTransition(() => setPrimary(item.id))}
          />
        ))}
      </MethodList>
      <EntityGallery
        propertyId={propertyId}
        entityType="access_method"
        entityId={propertyId}
        usageKey={ACCESS_USAGE_KEYS.parking}
        label="Fotos del aparcamiento"
        defaultCollapsed
      />
    </div>
  );
}

interface AccessibilityPanelProps {
  axFeatures: string[];
  setAxFeatures: (next: string[]) => void;
  axCustomLabel: string;
  setAxCustomLabel: (s: string) => void;
  axCustomDesc: string;
  setAxCustomDesc: (s: string) => void;
  toggleMember: <T>(arr: T[], setArr: (next: T[]) => void, item: T) => void;
  propertyId: string;
}

function AccessibilityPanel({
  axFeatures,
  setAxFeatures,
  axCustomLabel,
  setAxCustomLabel,
  axCustomDesc,
  setAxCustomDesc,
  toggleMember,
  propertyId,
}: AccessibilityPanelProps) {
  return (
    <div className="space-y-5">
      {ACCESSIBILITY_GROUPS.map((group) => {
        const sortedIds = [
          ...group.ids.filter((id) => axFeatures.includes(id)),
          ...group.ids.filter((id) => !axFeatures.includes(id)),
        ];
        return (
          <div key={group.key}>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {group.label}
            </h4>
            <MethodList>
              {sortedIds.map((id) => {
                const item = findItem(accessibilityFeatures, id);
                if (!item) return null;
                return (
                  <MethodRow
                    key={id}
                    id={id}
                    icon={accessibilityIconFor(id)}
                    name={item.label}
                    description={item.description}
                    selected={axFeatures.includes(id)}
                    onClick={() => toggleMember(axFeatures, setAxFeatures, id)}
                    isOther={id === "ax.other"}
                    customLabel={axCustomLabel}
                    customDesc={axCustomDesc}
                    onCustomLabelChange={setAxCustomLabel}
                    onCustomDescChange={setAxCustomDesc}
                  />
                );
              })}
            </MethodList>
          </div>
        );
      })}
      <EntityGallery
        propertyId={propertyId}
        entityType="access_method"
        entityId={propertyId}
        usageKey={ACCESS_USAGE_KEYS.accessibility}
        label="Fotos de accesibilidad"
        defaultCollapsed
      />
    </div>
  );
}

