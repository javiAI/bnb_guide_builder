"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Camera,
  Clock,
  Clock4,
  FileText,
  Key,
  MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TextLink } from "@/components/ui/text-link";
import { PageHeader } from "@/components/ui/page-header";
import { NumberedSection } from "@/components/ui/numbered-section";
import { PageHeaderChip } from "@/components/ui/page-header-chip";
import { saveAccessAction } from "@/lib/actions/editor.actions";
import {
  NO_ACCESSIBILITY_ID,
  OTHER_ACCESSIBILITY_ID,
} from "@/lib/services/access-tri-state";
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
import type { SubsystemSlides } from "./_components/subsystem-card.types";
import { MethodList } from "./_components/method-list";
import { MethodRow } from "./_components/method-row";
import {
  ArrivalStepsEditor,
  ARRIVAL_STEP_ICONS,
  type ArrivalStep,
  type ArrivalStepKey,
} from "./_components/arrival-steps-editor";
import {
  isIntercityMode,
  type IntercityMode,
  type RateTier,
} from "./_components/arrival-steps-helpers";
import { ParkingPlacesEditor } from "./_components/parking-places-editor";
import { HorariosEditor } from "./_components/horarios-editor";
import {
  ArrivalCockpitMap,
  ArrivalCockpitProvider,
  ArrivalCockpitTabs,
  type ArrivalOption,
  type ArrivalSuggestionsCache,
} from "./_components/arrival-modes-editor";
import type { ParkingSuggestion } from "@/lib/services/parking-discovery.service";
import {
  type ArrivalMode,
} from "@/lib/services/arrival-discovery.service";

// Cockpit-only default radius for parking + intercity arrival suggestions.
// Decoupled from the service-level DEFAULT_DISCOVERY_RADIUS_M (used by server
// actions as their request-arg fallback) — the UI starts narrow (1 km) because
// 30 km is rarely useful as a starting point and walks operators into a wall
// of irrelevant results.
const COCKPIT_DEFAULT_RADIUS_M = 1_000;

const AUTONOMOUS_UNIT_IDS = ["am.smart_lock", "am.keypad", "am.lockbox"];

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
    ids: [OTHER_ACCESSIBILITY_ID],
  },
];

function sameStringList(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Items-level "do we have a complete selection" check, independent of the
// subsystem-scope opt-out. Splits the old `statusFor` into two layers so the
// opt-out (`ba.no_building` / `pk.no_parking` chips) can opt the entire
// subsystem out without inspecting items.
function itemsConfigured(
  arr: string[],
  customLabel: string | null | undefined,
  customSentinel: string | null,
  primary?: string | null,
): boolean {
  if (arr.length === 0) return false;
  // *.other selected without a custom label = layer is incomplete.
  if (customSentinel && arr.includes(customSentinel) && !customLabel?.trim())
    return false;
  // Primary deselected without re-promotion = inconsistent state.
  if (primary !== undefined && primary !== null && !arr.includes(primary))
    return false;
  return true;
}

// Per-subsystem completeness. Every subsystem resolves deterministically to
// "configured" or "pending" — no "empty" state. The contract:
//   building: `ba.no_building` selected → configured (explicit opt-out);
//             empty → pending; positive methods → configured iff items complete.
//   unit:     always required (every property has a unit door); configured
//             iff items are complete.
//   parking:  `pk.no_parking` selected → configured (explicit opt-out);
//             empty → pending; positive types → configured iff items complete.
//   accessibility: `ax.no_accessibility` selected → configured (explicit opt-out);
//             empty → pending (unanswered, persisted as null);
//             positive features → configured iff items are complete.
function deriveBuildingStatus(
  methods: string[],
  customLabel: string | null,
  primary: string | null,
): SubsystemStatus {
  // Explicit opt-out via the `ba.no_building` chip — mutually exclusive with
  // any positive method, counts as configured.
  if (methods.includes("ba.no_building")) return "configured";
  if (methods.length === 0) return "pending";
  return itemsConfigured(methods, customLabel, "ba.other", primary)
    ? "configured"
    : "pending";
}
function deriveUnitStatus(
  methods: string[],
  customLabel: string | null,
  primary: string | null,
): SubsystemStatus {
  return itemsConfigured(methods, customLabel, "am.other", primary)
    ? "configured"
    : "pending";
}
function deriveParkingStatus(
  types: string[],
  customLabel: string | null,
  primary: string | null,
): SubsystemStatus {
  // Explicit opt-out via the `pk.no_parking` chip — mutually exclusive with
  // any positive type, counts as configured.
  if (types.includes("pk.no_parking")) return "configured";
  if (types.length === 0) return "pending";
  return itemsConfigured(types, customLabel, "pk.other", primary)
    ? "configured"
    : "pending";
}
function deriveAccessibilityStatus(
  features: string[],
  customLabel: string | null,
): SubsystemStatus {
  // Tri-state: `ax.no_accessibility` is the explicit opt-out chip (configured),
  // empty is unanswered (pending), positive features configured iff complete.
  if (features.includes(NO_ACCESSIBILITY_ID)) return "configured";
  if (features.length === 0) return "pending";
  return itemsConfigured(features, customLabel, OTHER_ACCESSIBILITY_ID)
    ? "configured"
    : "pending";
}

// Wrap state updates in a View Transition. flushSync forces React to commit
// synchronously inside the transition callback so the "after" snapshot is
// captured against the new DOM. When `expandClass` is true the `vt-expand`
// class is added to <html> for the duration of the transition — see comment
// on `setExpandedCardAnimated` for why that discriminator exists.
//
// All three ViewTransition promises (`ready`, `updateCallbackDone`,
// `finished`) reject with AbortError when a newer transition interrupts
// this one. We catch each defensively so the unhandled rejection doesn't
// surface in Next.js' error overlay; cleanup of `vt-expand` still runs.
type DocVT = Document & {
  startViewTransition?: (cb: () => void) => {
    ready?: Promise<unknown>;
    updateCallbackDone?: Promise<unknown>;
    finished?: Promise<unknown>;
  };
};

function withViewTransition(update: () => void, expandClass = false): void {
  const docVT = (typeof document !== "undefined" ? document : null) as DocVT | null;
  if (!docVT || typeof docVT.startViewTransition !== "function") {
    update();
    return;
  }
  if (expandClass) document.documentElement.classList.add("vt-expand");
  const transition = docVT.startViewTransition(() => flushSync(update));
  transition.ready?.catch(() => {});
  transition.updateCallbackDone?.catch(() => {});
  transition.finished
    ?.catch(() => {})
    .finally(() => {
      if (expandClass) document.documentElement.classList.remove("vt-expand");
    });
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

/** Minimal `LocalPlace` projection consumed by the parking panel. */
export interface ParkingPlace {
  id: string;
  name: string;
  shortNote: string | null;
  distanceMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  provider: string | null;
  feeType: "free" | "paid" | null;
  isRecommended: boolean;
  rateTiers: RateTier[];
}

export interface PropertyCoords {
  latitude: number;
  longitude: number;
}

interface AccessFormProps {
  propertyId: string;
  publicSlug: string | null;
  streetAddress: string | null;
  city: string | null;
  propertyMediaCount: number;
  buildingPhotoCount: number;
  unitPhotoCount: number;
  parkingPhotoCount: number;
  accessibilityPhotoCount: number;
  legacyAccessPhotoCount: number;
  subsystemSlides: SubsystemSlides;
  parkingPlaces: ParkingPlace[];
  parkingSuggestions: ParkingSuggestion[];
  arrivalOptions: ArrivalOption[];
  arrivalModesEnabled: Partial<Record<"parking" | ArrivalMode, boolean>>;
  arrivalSuggestionsCache: ArrivalSuggestionsCache;
  propertyCoords: PropertyCoords | null;
  property: {
    checkInStart: string | null;
    checkInEnd: string | null;
    checkOutTime: string | null;
    isAutonomousCheckin: boolean;
    hasBuildingAccess: boolean;
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

// Access methods that surface a "dynamic code" affordance in the arrival
// step (slot the host can populate via Magic Link).
const DYNAMIC_CODE_IDS = new Set([
  "am.smart_lock",
  "am.keypad",
  "am.lockbox",
  "ba.smart_lock",
  "ba.keypad",
  "ba.lockbox",
  "ba.smart_intercom",
]);

export function AccessForm({
  propertyId,
  publicSlug,
  streetAddress,
  city,
  propertyMediaCount,
  buildingPhotoCount,
  unitPhotoCount,
  parkingPhotoCount,
  accessibilityPhotoCount,
  legacyAccessPhotoCount,
  subsystemSlides,
  parkingPlaces,
  parkingSuggestions,
  arrivalOptions,
  arrivalModesEnabled,
  arrivalSuggestionsCache,
  propertyCoords,
  property: p,
}: AccessFormProps) {
  // Flat dict { usageKey -> { count, firstUrl? } } derived from already-fetched
  // slides. Drives the thumbnail preview + count badge on each MethodRow so
  // attached-media state is unmistakable at a glance. `firstUrl` is the first
  // image/map slide for the key (iteration order mirrors page.tsx ordering:
  // image → map → video, so the preview is naturally a photo when one exists).
  const methodMediaPreview = useMemo(() => {
    const out: Record<string, { count: number; firstUrl?: string; secondUrl?: string }> = {};
    for (const sub of Object.values(subsystemSlides)) {
      for (const slide of sub) {
        const entry = out[slide.usageKey] ?? { count: 0 };
        entry.count += 1;
        if (slide.kind === "image" || slide.kind === "map") {
          if (!entry.firstUrl) {
            entry.firstUrl = slide.url;
          } else if (!entry.secondUrl) {
            entry.secondUrl = slide.url;
          }
        }
        out[slide.usageKey] = entry;
      }
    }
    return out;
  }, [subsystemSlides]);

  const [checkInStart, setCheckInStart] = useState(p.checkInStart ?? "16:00");
  const [checkInEnd, setCheckInEnd] = useState(p.checkInEnd ?? "22:00");
  const [checkOutTime, setCheckOutTime] = useState(p.checkOutTime ?? "11:00");
  // Cockpit discovery radius — shared across parking + intercity arrival
  // suggestions. Session-only (no DB persistence); operator-tuneable via the
  // selector in the ArrivalCockpitTabs tab row.
  const [searchRadiusMeters, setSearchRadiusMeters] = useState<number>(
    COCKPIT_DEFAULT_RADIUS_M,
  );
  // Migration: legacy `hasBuildingAccess=false` (toggle-driven opt-out) maps to
  // the new `ba.no_building` chip. Operators who opted out via the old toggle
  // see the chip pre-selected so the dirty check stays clean and a no-op save
  // persists the new shape.
  const initialBuildingMethods =
    p.hasBuildingAccess === false &&
    (!p.buildingAccess?.methods || p.buildingAccess.methods.length === 0)
      ? ["ba.no_building"]
      : (p.buildingAccess?.methods ?? []);
  const [buildingMethods, setBuildingMethods] = useState<string[]>(initialBuildingMethods);
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

  // Subsystem-scope opt-outs. Building uses the `ba.no_building` taxonomy chip
  // (mutually exclusive); parking uses `pk.no_parking` (same pattern).
  // Accessibility has no opt-out chip: empty selection = "no considerations".
  // Derived: there IS a building when at least one positive method is selected
  // (and the opt-out chip is NOT selected). Drives the header chip + tooltip.
  const hasBuildingAccess =
    !buildingMethods.includes("ba.no_building") && buildingMethods.length > 0;

  const [expandedCard, setExpandedCard] = useState<AccessCockpitId | null>(null);
  // Section-3 step expansion state, lifted up so a click on either section can
  // collapse the other in a single gesture (cross-section accordion).
  const [expandedSteps, setExpandedSteps] = useState<Record<ArrivalStepKey, boolean>>(
    () => ({ arrival: true, building: false, unit: false }),
  );
  // Wraps the cockpit grid so the click-outside effect knows the bounds of
  // the expanded surface. A click landing outside this wrapper collapses
  // the card; clicks landing inside Radix portals (popovers, dialogs,
  // dropdowns rendered to document.body) are excluded so opening a select
  // doesn't auto-collapse the card behind it.
  const expandedCardWrapperRef = useRef<HTMLDivElement | null>(null);
  // Section-3 (arrival steps) wrapper. Cross-section toggling is owned by
  // `handleStepToggle`, which atomically closes the section-2 card AND opens
  // the section-3 step in a single view transition. The click-outside guard
  // must ignore mousedowns landing inside section-3 — otherwise it fires
  // FIRST, closing the card via a separate transition that races and
  // clobbers the step-open commit.
  const arrivalStepsWrapperRef = useRef<HTMLDivElement | null>(null);

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
    withViewTransition(() => {
      setExpandedCard(next);
      // Opening any section-2 card collapses every section-3 step in the same
      // commit so the two sections behave as one accordion.
      if (next !== null) {
        setExpandedSteps({ arrival: false, building: false, unit: false });
      }
    }, true);
  }, []);

  const handleStepToggle = useCallback((key: ArrivalStepKey) => {
    // Single-open accordion across sections 2 + 3. Clicking a closed step
    // opens it and closes the other two; clicking the open step closes it
    // (none open). Section-2 is unconditionally closed because the accordion
    // invariant disallows a section-2 card and any section-3 step being open
    // simultaneously — `setExpandedCard(null)` is a no-op when already null.
    withViewTransition(() => {
      setExpandedSteps((prev) => {
        const isCurrentlyOpen = !!prev[key];
        return {
          arrival: !isCurrentlyOpen && key === "arrival",
          building: !isCurrentlyOpen && key === "building",
          unit: !isCurrentlyOpen && key === "unit",
        };
      });
      setExpandedCard(null);
    }, true);
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

  // Click outside the expanded card collapses it. We bind on `mousedown` so
  // the collapse fires before any focus shift in the click target — keeps
  // the gesture snappy. Radix renders popovers / dialogs / menus into a
  // body-level portal, so a `contains` check on the wrapper alone would
  // collapse the card whenever the operator interacts with one of those
  // surfaces; the closest-selector escape hatch covers the three Radix
  // wrappers we use today (HoverCard, Dialog, DropdownMenu).
  useEffect(() => {
    if (!expandedCard) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      const wrapper = expandedCardWrapperRef.current;
      if (wrapper && wrapper.contains(target)) return;
      const stepsWrapper = arrivalStepsWrapperRef.current;
      if (stepsWrapper && stepsWrapper.contains(target)) return;
      if (target instanceof Element) {
        const portalEscape = target.closest(
          '[data-radix-popper-content-wrapper],[role="dialog"],[role="menu"]',
        );
        if (portalEscape) return;
      }
      setExpandedCardAnimated(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [expandedCard, setExpandedCardAnimated]);

  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    saveAccessAction,
    null,
  );

  const isAutonomousDerived =
    unitMethods.length > 0 && unitMethods.every((m) => AUTONOMOUS_UNIT_IDS.includes(m));

  // Effective primary = user's explicit choice if still selected, else first
  // selected method. The hidden form input emits this value, not raw state.
  const effectivePrimaryBuilding = pickPrimary(buildingMethods, primaryBuilding);
  const effectivePrimaryUnit = pickPrimary(unitMethods, primaryUnit);
  const effectivePrimaryParking = pickPrimary(parkingTypes, primaryParking);

  const isDirty =
    checkInStart !== (p.checkInStart ?? "16:00") ||
    checkInEnd !== (p.checkInEnd ?? "22:00") ||
    checkOutTime !== (p.checkOutTime ?? "11:00") ||
    !sameStringList(buildingMethods, initialBuildingMethods) ||
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

  const buildingStatus = deriveBuildingStatus(
    buildingMethods,
    buildingCustomLabel,
    effectivePrimaryBuilding,
  );
  const unitStatus = deriveUnitStatus(unitMethods, unitCustomLabel, effectivePrimaryUnit);
  const parkingStatus = deriveParkingStatus(
    parkingTypes,
    parkingCustomLabel,
    effectivePrimaryParking,
  );
  const axStatus = deriveAccessibilityStatus(axFeatures, axCustomLabel);

  // Selected items per layer — drives the collapsed-card icon strip.
  // Memoized so downstream Sets keyed off `selectedItems` (e.g. `validMethodIds`
  // in SubsystemCard) keep stable identity when other unrelated state changes.
  const buildingItems = useMemo(
    () => toSubsystemItems(buildingMethods, buildingAccessMethods, buildingIconFor),
    [buildingMethods],
  );
  const unitItems = useMemo(
    () => toSubsystemItems(unitMethods, accessMethods, unitIconFor),
    [unitMethods],
  );
  const parkingItems = useMemo(
    () => toSubsystemItems(parkingTypes, parkingOptions, parkingIconFor),
    [parkingTypes],
  );
  const axItems = useMemo(
    () => toSubsystemItems(axFeatures, accessibilityFeatures, accessibilityIconFor),
    [axFeatures],
  );

  // legacyAccessPhotoCount + propertyMediaCount intentionally unread now —
  // sec 03 derives its photo strip per-step from `subsystemSlides`. Reads kept
  // in props so the data layer stays stable while we iterate on the editor.
  void legacyAccessPhotoCount;
  void propertyMediaCount;

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

  // ── Sección 03 — pasos de llegada (derivados del cockpit) ────────────
  // Cada paso surfacea datos del cockpit + permite al operador anotar y subir
  // fotos de esta escena. Códigos de entrada NO se muestran aquí: son
  // dinámicos por estancia y se envían al huésped automáticamente.

  // Detectar si un método requiere código dinámico (smart-lock / keypad /
  // lockbox / smart-intercom — todo lo que genera código por estancia).
  const buildingMethodSummaries = useMemo(
    () =>
      buildingMethods
        .filter((id) => id !== "ba.no_building")
        .map((id) => {
          const item = findItem(buildingAccessMethods, id);
          if (!item) return null;
          return {
            id,
            label: item.label,
            icon: buildingIconFor(id),
            isPrimary:
              id === (primaryBuilding && buildingMethods.includes(primaryBuilding)
                ? primaryBuilding
                : buildingMethods.filter((m) => m !== "ba.no_building")[0] ?? null),
            hasDynamicCode: DYNAMIC_CODE_IDS.has(id),
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null),
    [buildingMethods, primaryBuilding],
  );

  const unitMethodSummaries = useMemo(
    () =>
      unitMethods
        .map((id) => {
          const item = findItem(accessMethods, id);
          if (!item) return null;
          return {
            id,
            label: item.label,
            icon: unitIconFor(id),
            isPrimary:
              id === (primaryUnit && unitMethods.includes(primaryUnit)
                ? primaryUnit
                : unitMethods[0] ?? null),
            hasDynamicCode: DYNAMIC_CODE_IDS.has(id),
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null),
    [unitMethods, primaryUnit],
  );

  const arrivalTransitOptions = useMemo(
    () =>
      arrivalOptions
        .filter(
          (o): o is ArrivalOption & { mode: IntercityMode } =>
            isIntercityMode(o.mode),
        )
        .map((o) => ({
          id: o.id,
          mode: o.mode,
          name: o.name,
          shortNote: o.shortNote,
          latitude: o.latitude,
          longitude: o.longitude,
          isRecommended: o.isRecommended,
          distanceMeters: o.distanceMeters,
          address: o.address,
          provider: o.provider,
          providerPlaceId: o.providerPlaceId,
        })),
    [arrivalOptions],
  );

  const arrivalSteps: ArrivalStep[] = useMemo(
    () => [
      {
        key: "arrival",
        icon: ARRIVAL_STEP_ICONS.arrival,
        title: "Cómo llegar",
        hasData:
          parkingPlaces.length > 0 ||
          arrivalOptions.length > 0 ||
          (Boolean(streetAddress?.trim()) && propertyCoords !== null),
        streetAddress,
        city,
        propertyCoords,
        parkingPlaces: parkingPlaces.map((p) => ({
          id: p.id,
          name: p.name,
          shortNote: p.shortNote,
          latitude: p.latitude,
          longitude: p.longitude,
          address: p.address,
          distanceMeters: p.distanceMeters,
          feeType: p.feeType,
          isRecommended: p.isRecommended,
          rateTiers: p.rateTiers,
        })),
        arrivalOptions: arrivalTransitOptions,
        arrivalModesEnabled,
      },
      {
        key: "building",
        icon: ARRIVAL_STEP_ICONS.building,
        title: "Entrar al edificio",
        hasData: buildingMethodSummaries.length > 0,
        methods: buildingMethodSummaries,
        slides: subsystemSlides.building,
        propertyId,
        cockpitTarget: "building",
      },
      {
        key: "unit",
        icon: ARRIVAL_STEP_ICONS.unit,
        title: "Entrar a la vivienda",
        hasData: unitMethodSummaries.length > 0,
        methods: unitMethodSummaries,
        slides: subsystemSlides.unit,
        propertyId,
        cockpitTarget: "unit",
      },
    ],
    [
      parkingPlaces,
      arrivalOptions,
      arrivalTransitOptions,
      streetAddress,
      city,
      propertyCoords,
      arrivalModesEnabled,
      buildingMethodSummaries,
      unitMethodSummaries,
      subsystemSlides.building,
      subsystemSlides.unit,
      propertyId,
    ],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Propiedad · Llegada"
        title="Llegada y acceso"
        description="La hora más frágil de toda la estancia. Documenta aquí cómo llegan, cómo entran y qué hacer en los primeros minutos."
        chips={
          <>
            <PageHeaderChip icon={Clock4} label="Check-in" value={checkInStart} />
            <PageHeaderChip icon={Clock} label="Check-out" value={checkOutTime} />
            {isAutonomousDerived && (
              <PageHeaderChip icon={Key} label="Entrada autónoma" />
            )}
            {hasBuildingAccess && (
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
        {axFeatures.includes(OTHER_ACCESSIBILITY_ID) && (
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
          <HorariosEditor
            checkInStart={checkInStart}
            checkInEnd={checkInEnd}
            checkOutTime={checkOutTime}
            onCheckInStartChange={setCheckInStart}
            onCheckInEndChange={setCheckInEnd}
            onCheckOutTimeChange={setCheckOutTime}
            isAutonomousDerived={isAutonomousDerived}
            hasBuildingAccess={hasBuildingAccess}
          />
        </NumberedSection>

        <NumberedSection number="02" title="Acceso">
          <p className="mb-3 text-[12px] text-[var(--color-text-secondary)]">
            Pulsa una tarjeta para revisar o modificar.
          </p>
          <div ref={expandedCardWrapperRef}>
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
                    slides={subsystemSlides.building}
                    status={buildingStatus}
                    cockpitId="building"
                    propertyId={propertyId}
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
                      propertyId={propertyId}
                      primary={effectivePrimaryBuilding}
                      setPrimary={setPrimaryBuilding}
                      methodMediaPreview={methodMediaPreview}
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
                    slides={subsystemSlides.unit}
                    status={unitStatus}
                    cockpitId="unit"
                    propertyId={propertyId}
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
                      methodMediaPreview={methodMediaPreview}
                    />
                  </SubsystemCard>
                );
              }
              if (cardId === "parking") {
                const parkingEditorPanel = (
                  <ParkingEditorPanel
                    isNoParking={parkingTypes.includes(NO_PARKING_ID)}
                    searchRadiusMeters={searchRadiusMeters}
                    onChangeSearchRadiusMeters={setSearchRadiusMeters}
                  />
                );
                const parkingOptionsPanelNode = (
                  <ParkingOptionsPanel
                    allParking={allParking}
                    parkingTypes={parkingTypes}
                    setParkingTypes={setParkingTypes}
                    parkingCustomLabel={parkingCustomLabel}
                    setParkingCustomLabel={setParkingCustomLabel}
                    parkingCustomDesc={parkingCustomDesc}
                    setParkingCustomDesc={setParkingCustomDesc}
                    primary={effectivePrimaryParking}
                    setPrimary={setPrimaryParking}
                  />
                );
                return (
                  <ArrivalCockpitProvider
                    propertyId={propertyId}
                    propertyCoords={propertyCoords}
                    arrivalOptions={arrivalOptions}
                    parkingPlaces={parkingPlaces}
                    arrivalModesEnabled={arrivalModesEnabled}
                    arrivalSuggestionsCache={arrivalSuggestionsCache}
                    searchRadiusMeters={searchRadiusMeters}
                    onChangeSearchRadiusMeters={setSearchRadiusMeters}
                  >
                    <SubsystemCard
                      role={role}
                      icon={SUBSYSTEM_HEADER_ICONS.parking}
                      title="Cómo llegar"
                      selectedItems={parkingItems}
                      primaryId={effectivePrimaryParking}
                      photoCount={parkingPhotoCount}
                      slides={subsystemSlides.parking}
                      parkingPlaces={parkingPlaces}
                      parkingSuggestions={parkingSuggestions}
                      parkingRadiusMeters={searchRadiusMeters}
                      propertyCoords={propertyCoords}
                      status={parkingStatus}
                      cockpitId="parking"
                      propertyId={propertyId}
                      onExpand={() => setExpandedCardAnimated("parking")}
                      onCollapse={() => setExpandedCardAnimated(null)}
                      expandedSubtitle="Aparcamiento + estaciones de tren, bus, aeropuerto y metro cercanos. Activa cada modo que sea relevante para tu huésped."
                      lightboxMap={<ArrivalCockpitMap hideExpand fillSlideArea />}
                      lightboxSidePanel={
                        <ArrivalCockpitTabs parkingPanel={parkingEditorPanel} />
                      }
                    >
                      <div className="space-y-4">
                        <ArrivalCockpitMap />
                        <ArrivalCockpitTabs parkingPanel={parkingEditorPanel} />
                        <div className="border-t border-[var(--color-border-subtle)] pt-4">
                          {parkingOptionsPanelNode}
                        </div>
                      </div>
                    </SubsystemCard>
                  </ArrivalCockpitProvider>
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
                  slides={subsystemSlides.accessibility}
                  status={axStatus}
                  cockpitId="accessibility"
                  propertyId={propertyId}
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
                    propertyId={propertyId}
                    methodMediaPreview={methodMediaPreview}
                  />
                </SubsystemCard>
              );
            }}
          </CockpitGrid>
          </div>
        </NumberedSection>

        <NumberedSection number="03" title="Pasos de llegada">
          <div ref={arrivalStepsWrapperRef}>
            <ArrivalStepsEditor
              steps={arrivalSteps}
              expanded={expandedSteps}
              onToggleStep={handleStepToggle}
            />
          </div>
        </NumberedSection>

        {state?.error && (
          <p className="text-sm text-[var(--color-status-error-text)]">{state.error}</p>
        )}
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
  propertyId: string;
  primary: string | null;
  setPrimary: (id: string | null) => void;
  methodMediaPreview: Record<string, { count: number; firstUrl?: string }>;
}

const NO_BUILDING_ID = "ba.no_building";

// Mutex sentinel toggle: selecting `sentinelId` clears every other entry;
// selecting any positive entry clears the sentinel. Used by building methods
// (`ba.no_building`) and parking types (`pk.no_parking`).
function toggleMutexList(arr: string[], id: string, sentinelId: string): string[] {
  if (id === sentinelId) return arr.includes(sentinelId) ? [] : [sentinelId];
  if (arr.includes(sentinelId)) return [id];
  const idx = arr.indexOf(id);
  return idx === -1 ? [...arr, id] : arr.filter((_, i) => i !== idx);
}

function BuildingPanel({
  allBuilding,
  buildingMethods,
  setBuildingMethods,
  buildingCustomLabel,
  setBuildingCustomLabel,
  buildingCustomDesc,
  setBuildingCustomDesc,
  propertyId,
  primary,
  setPrimary,
  methodMediaPreview,
}: BuildingPanelProps) {
  const sortedBuilding = sortSelectedFirst(allBuilding, buildingMethods, primary);
  const isNoBuilding = buildingMethods.includes(NO_BUILDING_ID);

  const toggleBuildingMethod = useCallback(
    (id: string) => {
      withViewTransition(() =>
        setBuildingMethods(toggleMutexList(buildingMethods, id, NO_BUILDING_ID)),
      );
    },
    [buildingMethods, setBuildingMethods],
  );

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
            onClick={() => toggleBuildingMethod(item.id)}
            isOther={item.id === "ba.other"}
            customLabel={buildingCustomLabel}
            customDesc={buildingCustomDesc}
            onCustomLabelChange={setBuildingCustomLabel}
            onCustomDescChange={setBuildingCustomDesc}
            isPrimary={primary === item.id}
            onMakePrimary={() => withViewTransition(() => setPrimary(item.id))}
            mediaUpload={
              item.id === NO_BUILDING_ID
                ? undefined
                : {
                    propertyId,
                    usageKey: `${ACCESS_USAGE_KEYS.building}.${item.id}`,
                  }
            }
            mediaPreview={methodMediaPreview[`${ACCESS_USAGE_KEYS.building}.${item.id}`]}
          />
        ))}
      </MethodList>
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
  methodMediaPreview: Record<string, { count: number; firstUrl?: string }>;
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
  methodMediaPreview,
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
            mediaUpload={{
              propertyId,
              usageKey: `${ACCESS_USAGE_KEYS.unit}.${item.id}`,
            }}
            mediaPreview={methodMediaPreview[`${ACCESS_USAGE_KEYS.unit}.${item.id}`]}
          />
        ))}
      </MethodList>
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

const NO_PARKING_ID = "pk.no_parking";

// Lists-only slot for the unified S02 cockpit. Renders nothing when the
// operator opted out via `pk.no_parking` — the chip lives in
// `ParkingOptionsPanel` (rendered at the end of the cockpit) so the toggle
// itself is always visible even when the lists are hidden.
function ParkingEditorPanel({
  isNoParking,
  searchRadiusMeters,
  onChangeSearchRadiusMeters,
}: {
  isNoParking: boolean;
  searchRadiusMeters: number;
  onChangeSearchRadiusMeters: (meters: number) => void;
}) {
  if (isNoParking) return null;
  return (
    <ParkingPlacesEditor
      searchRadiusMeters={searchRadiusMeters}
      onChangeSearchRadiusMeters={onChangeSearchRadiusMeters}
    />
  );
}

interface ParkingOptionsPanelProps {
  allParking: ReturnType<typeof getItems>;
  parkingTypes: string[];
  setParkingTypes: (next: string[]) => void;
  parkingCustomLabel: string;
  setParkingCustomLabel: (s: string) => void;
  parkingCustomDesc: string;
  setParkingCustomDesc: (s: string) => void;
  primary: string | null;
  setPrimary: (id: string | null) => void;
}

function ParkingOptionsPanel({
  allParking,
  parkingTypes,
  setParkingTypes,
  parkingCustomLabel,
  setParkingCustomLabel,
  parkingCustomDesc,
  setParkingCustomDesc,
  primary,
  setPrimary,
}: ParkingOptionsPanelProps) {
  const sortedParking = sortSelectedFirst(allParking, parkingTypes, primary);

  // Pre-existing LocalPlace pins are NOT auto-deleted when `pk.no_parking` is
  // selected: they stay persisted but hidden in the editor, so toggling back
  // doesn't lose data.
  const toggleParkingType = useCallback(
    (id: string) => {
      withViewTransition(() =>
        setParkingTypes(toggleMutexList(parkingTypes, id, NO_PARKING_ID)),
      );
    },
    [parkingTypes, setParkingTypes],
  );

  return (
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
          onClick={() => toggleParkingType(item.id)}
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
  );
}

interface AccessibilityPanelProps {
  axFeatures: string[];
  setAxFeatures: (next: string[]) => void;
  axCustomLabel: string;
  setAxCustomLabel: (s: string) => void;
  axCustomDesc: string;
  setAxCustomDesc: (s: string) => void;
  propertyId: string;
  methodMediaPreview: Record<string, { count: number; firstUrl?: string }>;
}

function AccessibilityPanel({
  axFeatures,
  setAxFeatures,
  axCustomLabel,
  setAxCustomLabel,
  axCustomDesc,
  setAxCustomDesc,
  propertyId,
  methodMediaPreview,
}: AccessibilityPanelProps) {
  const isOptOut = axFeatures.includes(NO_ACCESSIBILITY_ID);
  const optOutItem = findItem(accessibilityFeatures, NO_ACCESSIBILITY_ID);

  // Tri-state mutex: selecting `ax.no_accessibility` clears every positive
  // feature; selecting any positive feature clears the sentinel. Mirrors the
  // building/parking opt-out chips so the data model collapses to a single
  // boolean (`hasAccessibilityConsiderations`) on save.
  const toggleAxFeature = useCallback(
    (id: string) => {
      withViewTransition(() =>
        setAxFeatures(toggleMutexList(axFeatures, id, NO_ACCESSIBILITY_ID)),
      );
    },
    [axFeatures, setAxFeatures],
  );

  return (
    <div className="space-y-5">
      {optOutItem && (
        <MethodList>
          <MethodRow
            id={optOutItem.id}
            icon={accessibilityIconFor(optOutItem.id)}
            name={optOutItem.label}
            description={optOutItem.description}
            selected={isOptOut}
            onClick={() => toggleAxFeature(optOutItem.id)}
          />
        </MethodList>
      )}
      {!isOptOut &&
        ACCESSIBILITY_GROUPS.map((group) => {
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
                      onClick={() => toggleAxFeature(id)}
                      isOther={id === OTHER_ACCESSIBILITY_ID}
                      customLabel={axCustomLabel}
                      customDesc={axCustomDesc}
                      onCustomLabelChange={setAxCustomLabel}
                      onCustomDescChange={setAxCustomDesc}
                      mediaUpload={{
                        propertyId,
                        usageKey: `${ACCESS_USAGE_KEYS.accessibility}.${id}`,
                      }}
                      mediaPreview={methodMediaPreview[`${ACCESS_USAGE_KEYS.accessibility}.${id}`]}
                    />
                  );
                })}
              </MethodList>
            </div>
          );
        })}
    </div>
  );
}

