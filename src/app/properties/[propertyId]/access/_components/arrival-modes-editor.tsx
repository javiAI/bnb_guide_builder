"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  BusFront,
  Eye,
  EyeOff,
  ParkingSquare,
  Plane,
  TrainFrontTunnel,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  addManualArrivalOptionAction,
  setArrivalModeEnabledAction,
} from "@/lib/actions/arrival.actions";
import {
  addManualParkingPlaceAction,
  reverseGeocodeForPinAction,
} from "@/lib/actions/parking.actions";
import type { RateTier } from "./arrival-steps-helpers";
import {
  ARRIVAL_MODES,
  type ArrivalMode,
  type ArrivalSuggestion,
} from "@/lib/services/arrival-discovery.service";
import { haversineMeters } from "@/lib/services/places";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { SectionShell } from "./section-shell";
import { TransitSection } from "./transit-section";
import {
  MultiPinMap,
  feeTypeToPinKind,
  type ArrivalPinMode,
  type ManualAddMode,
  type MultiPinSpec,
} from "./multi-pin-map";
import { ParkingMapOverlay } from "./parking-map-overlay";
import {
  pinIdForArrival,
  pinIdForArrivalSuggestion,
  pinIdForPlace,
  pinIdForSuggestion,
} from "./pin-ids";
import { useSubsystemLightbox } from "./subsystem-card";
import { useLightboxMapHeight } from "@/hooks/use-lightbox-map-height";
import { LIVE_MAP_USAGE_KEY } from "./subsystem-card.types";
import { useParkingStateContext } from "./use-parking-management";
import type { ParkingPlace } from "../access-form";

// "Cómo llegar" cockpit — composed of three slots that share a single source
// of truth via `ArrivalCockpitProvider`:
//
//   • ArrivalCockpitMap   — the unified MultiPinMap + manual-add mini-form.
//   • ArrivalCockpitTabs  — Vehículo / Tren / Autobús / Avión tabs with the
//                           per-mode Añadidos/Sugeridos lists.
//   • parkingOptionsPanel — caller-provided `pk.*` chips slot (rendered ONLY
//                           in the inline cockpit; the lightbox skips it).
//
// In the inline cockpit the three slots stack vertically inside one card. In
// the lightbox they split across regions: Map → slide area, Tabs → side panel
// (below the thumbnail strip), options panel → suppressed. Both layouts read
// from the same provider so clicking a tab in the side panel updates the map
// in the slide area, and vice versa.

export interface ArrivalOption {
  id: string;
  mode: ArrivalMode;
  name: string;
  shortNote: string | null;
  distanceMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  provider: string | null;
  providerPlaceId: string | null;
  isRecommended: boolean;
  rateTiers: RateTier[];
}

/** S02 intercity selectors. `parking` is the UI alias for `car` — the data
 * model lives in `parkingPlaces` / `lp.parking*`, but the cockpit treats it
 * as just one more "how the guest reached the city" chip. */
type IntercityKey = "parking" | "airport" | "train" | "bus";
type IntercityTransitKey = Exclude<IntercityKey, "parking">;
type CockpitMode = "parking" | ArrivalMode;

interface ModeMeta {
  key: ArrivalMode;
  /** Tab label — mode of travel ("Tren", "Avión"). */
  label: string;
  /** Section + pin label — what we place on the map ("Estación de tren",
   * "Aeropuerto"). Distinct from `label` because the operator picks a *mode*
   * in tabs but manages *places* in sections. */
  sectionLabel: string;
  icon: LucideIcon;
}

interface IntercityMeta {
  key: IntercityKey;
  label: string;
  sectionLabel: string;
  icon: LucideIcon;
}

// S02 intercity tab order (operator-facing). Mirrors the picker order so the
// map "+" affordance and the tabs stay coherent. Tab labels describe the mode
// of travel; section labels (used inside each tab + by the manual-add picker)
// describe the pin type.
const INTERCITY_MODES: readonly IntercityMeta[] = [
  { key: "parking", label: "Vehículo", sectionLabel: "Aparcamiento", icon: ParkingSquare },
  { key: "train", label: "Tren", sectionLabel: "Estación de tren", icon: TrainFrontTunnel },
  { key: "bus", label: "Autobús", sectionLabel: "Estación de autobús", icon: BusFront },
  { key: "airport", label: "Avión", sectionLabel: "Aeropuerto", icon: Plane },
];

// Stable empty array — used as a fallback when ParkingStateProvider is absent
// (defensive; in practice ArrivalCockpit always renders inside the parking
// cockpit). Pulled out to a module constant so it doesn't churn the unifiedPins
// useMemo dep on every render.
const EMPTY_PARKING_SUGGESTIONS: readonly never[] = [];

// Per-tab "+" copy. Spanish gender + article varies by noun so we keep the
// strings literal rather than composing from a single noun template.
const MANUAL_ADD_COPY: Record<
  IntercityKey,
  { addTooltip: string; armedHint: string }
> = {
  parking: {
    addTooltip: "Añade un aparcamiento manualmente",
    armedHint: "Toca para colocar el aparcamiento",
  },
  train: {
    addTooltip: "Añade una estación de tren manualmente",
    armedHint: "Toca para colocar la estación de tren",
  },
  bus: {
    addTooltip: "Añade una estación de autobús manualmente",
    armedHint: "Toca para colocar la estación de autobús",
  },
  airport: {
    addTooltip: "Añade un aeropuerto manualmente",
    armedHint: "Toca para colocar el aeropuerto",
  },
};

// Pin-bearing intercity transit modes (parking has its own panel). Derived
// from INTERCITY_MODES so adding a new intercity mode requires only one edit.
// The `key` widens from IntercityKey to ArrivalMode after filtering out parking.
const INTERCITY_TRANSIT_MODES: readonly ModeMeta[] = INTERCITY_MODES
  .filter((m): m is IntercityMeta & { key: IntercityTransitKey } => m.key !== "parking")
  .map((m) => ({
    key: m.key,
    label: m.label,
    sectionLabel: m.sectionLabel,
    icon: m.icon,
  }));

/** Hydrated cache keyed by arrival mode — page.tsx serves this so the
 * "Sugeridos" column populates on first paint instead of waiting for the
 * operator to press the icon-only refresh. Modes with no entry simply render
 * an empty column with the standard CTA copy. */
export type ArrivalSuggestionsCache = Partial<
  Record<ArrivalMode, ArrivalSuggestion[]>
>;

// ── Provider context ───────────────────────────────────────────────────

/** Click-to-place ephemeral draft on the cockpit map. Lives client-side only
 * until the operator confirms — that's when it converts to a real DB row via
 * the appropriate manual-add server action. Re-clicking the map while a draft
 * is active overwrites lat/lng + re-resolves name/address/distance; fee
 * resets to `null` so the operator re-picks deliberately for the new spot. */
export type DraftFee = "free" | "paid";
export interface DraftPin {
  mode: ManualAddMode;
  latitude: number;
  longitude: number;
  /** Auto-resolved POI name, or empty when the provider had no match (or is
   * still resolving). The cockpit row renders an italic "Añadir nombre"
   * placeholder while empty. */
  name: string;
  address: string | null;
  distanceMeters: number | null;
  /** Parking-only; ignored for transit modes. `null` = unclassified. */
  feeType: DraftFee | null;
  /** True while the reverse-geocode request is in flight. The row swaps the
   * placeholder to "Detectando…" so the operator knows the auto-fill is
   * pending. */
  resolving: boolean;
}

interface ArrivalCockpitContextValue {
  propertyId: string;
  propertyCoords: { latitude: number; longitude: number } | null;
  arrivalOptions: ArrivalOption[];
  parkingPlaces: ParkingPlace[];
  arrivalSuggestionsCache: ArrivalSuggestionsCache;
  searchRadiusMeters: number;
  onChangeSearchRadiusMeters: (meters: number) => void;
  optionsByMode: Record<ArrivalMode, ArrivalOption[]>;
  activeTab: IntercityKey;
  setActiveTab: (k: IntercityKey) => void;
  visibleModes: Record<IntercityKey, boolean>;
  toggleVisibleMode: (k: IntercityKey) => void;
  suggestionsByMode: Partial<Record<ArrivalMode, ArrivalSuggestion[]>>;
  handleSuggestionsChange: (
    mode: ArrivalMode,
    suggestions: ArrivalSuggestion[],
  ) => void;
  isParkingEnabled: boolean;
  isIntercityEnabled: (key: IntercityKey) => boolean;
  handleToggleIntercity: (key: IntercityKey) => void;
  togglePending: boolean;
  draftPin: DraftPin | null;
  handlePlace: (mode: ManualAddMode, latitude: number, longitude: number) => void;
  clearDraft: () => void;
  setDraftName: (name: string) => void;
  setDraftFeeType: (fee: DraftFee | null) => void;
  confirmDraft: () => void;
  confirmingDraft: boolean;
  /** Server/network error returned from `confirmDraft` (e.g. action error or
   * scope rejection). Blank-name validation is handled inline by disabling
   * the confirm button — this is reserved for true failures. */
  draftError: string | null;
  /** Clears `draftError` (used by the operator-visible banner dismiss). */
  clearDraftError: () => void;
  currentManualAddMode: ManualAddMode;
  manualAddDisabled: boolean;
  manualAddDisabledReason: string | undefined;
  manualAddCopy: { addTooltip: string; armedHint: string };
  enabledIntercityModes: readonly IntercityMeta[];
}

const ArrivalCockpitContext = createContext<ArrivalCockpitContextValue | null>(
  null,
);

function useArrivalCockpit(): ArrivalCockpitContextValue {
  const ctx = useContext(ArrivalCockpitContext);
  if (!ctx) {
    throw new Error(
      "useArrivalCockpit must be used inside <ArrivalCockpitProvider>",
    );
  }
  return ctx;
}

/** Slice consumed by `TransitSection` and `ParkingPlacesEditor` for the
 * click-to-place draft-pin flow. Narrowing keeps surfaces from leaning on
 * unrelated cockpit state by accident. */
export type ArrivalCockpitDraftSlice = Pick<
  ArrivalCockpitContextValue,
  | "draftPin"
  | "draftError"
  | "clearDraftError"
  | "setDraftName"
  | "setDraftFeeType"
  | "confirmDraft"
  | "clearDraft"
  | "confirmingDraft"
>;

/** Optional accessor for surfaces that may render with or without the
 * cockpit provider (e.g. `TransitSection` is also used by the last-mile
 * block, which has no cockpit). Returns `null` when not inside a provider. */
export function useArrivalCockpitOptional(): ArrivalCockpitDraftSlice | null {
  return useContext(ArrivalCockpitContext);
}

interface ArrivalCockpitProviderProps {
  propertyId: string;
  propertyCoords: { latitude: number; longitude: number } | null;
  arrivalOptions: ArrivalOption[];
  parkingPlaces: ParkingPlace[];
  arrivalModesEnabled: Partial<Record<CockpitMode, boolean>>;
  arrivalSuggestionsCache: ArrivalSuggestionsCache;
  searchRadiusMeters: number;
  onChangeSearchRadiusMeters: (meters: number) => void;
  children: ReactNode;
}

export function ArrivalCockpitProvider({
  propertyId,
  propertyCoords,
  arrivalOptions,
  parkingPlaces,
  arrivalModesEnabled,
  arrivalSuggestionsCache,
  searchRadiusMeters,
  onChangeSearchRadiusMeters,
  children,
}: ArrivalCockpitProviderProps) {
  const [enabledLocal, setEnabledLocal] = useState(arrivalModesEnabled);
  // Sync from prop only when content actually changed. The parent passes a
  // fresh object reference on every render; a plain `useEffect([prop])` here
  // re-runs after every `router.refresh()` and re-commits the same value,
  // which churns the whole provider subtree. The in-render setState pattern
  // (React docs: "Adjusting state while rendering") collapses that to zero
  // work when the content is unchanged.
  const enabledKey = JSON.stringify(arrivalModesEnabled);
  const lastEnabledKeyRef = useRef(enabledKey);
  if (lastEnabledKeyRef.current !== enabledKey) {
    lastEnabledKeyRef.current = enabledKey;
    setEnabledLocal(arrivalModesEnabled);
  }

  const optionsByMode = useMemo(() => {
    const out = Object.fromEntries(
      ARRIVAL_MODES.map((m) => [m, [] as ArrivalOption[]]),
    ) as Record<ArrivalMode, ArrivalOption[]>;
    for (const opt of arrivalOptions) out[opt.mode].push(opt);
    return out;
  }, [arrivalOptions]);

  const isParkingEnabled =
    enabledLocal.parking !== false &&
    (enabledLocal.parking === true || parkingPlaces.length > 0);

  const isIntercityEnabled = useCallback(
    (key: IntercityKey): boolean =>
      key === "parking" ? isParkingEnabled : enabledLocal[key] === true,
    [enabledLocal, isParkingEnabled],
  );

  const [togglePending, startToggle] = useTransition();
  const handleToggleIntercity = useCallback(
    (mode: IntercityKey) => {
      const next = !isIntercityEnabled(mode);
      setEnabledLocal((prev) => ({ ...prev, [mode]: next }));
      startToggle(async () => {
        const res = await setArrivalModeEnabledAction({
          propertyId,
          mode,
          enabled: next,
        });
        if (!res.success) {
          setEnabledLocal((prev) => ({ ...prev, [mode]: !next }));
        }
      });
    },
    [isIntercityEnabled, propertyId],
  );

  const [activeTab, setActiveTab] = useState<IntercityKey>(
    INTERCITY_MODES[0]!.key,
  );

  const [visibleModes, setVisibleModes] = useState<
    Record<IntercityKey, boolean>
  >({
    parking: true,
    train: true,
    bus: true,
    airport: true,
  });
  const toggleVisibleMode = useCallback((key: IntercityKey) => {
    setVisibleModes((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const [suggestionsByMode, setSuggestionsByMode] = useState<
    Partial<Record<ArrivalMode, ArrivalSuggestion[]>>
  >(() => arrivalSuggestionsCache);
  // Same content-aware sync as `enabledLocal` above — the cache prop changes
  // reference on every parent render even when no new fetch landed.
  const cacheKey = JSON.stringify(arrivalSuggestionsCache);
  const lastCacheKeyRef = useRef(cacheKey);
  if (lastCacheKeyRef.current !== cacheKey) {
    lastCacheKeyRef.current = cacheKey;
    setSuggestionsByMode(arrivalSuggestionsCache);
  }

  const handleSuggestionsChange = useCallback(
    (mode: ArrivalMode, suggestions: ArrivalSuggestion[]) => {
      setSuggestionsByMode((prev) => {
        if (prev[mode] === suggestions) return prev;
        return { ...prev, [mode]: suggestions };
      });
    },
    [],
  );

  const currentManualAddMode: ManualAddMode = activeTab;
  const manualAddDisabled = !isIntercityEnabled(activeTab);
  const manualAddDisabledReason = useMemo(() => {
    if (!manualAddDisabled) return undefined;
    const meta = INTERCITY_MODES.find((m) => m.key === activeTab);
    return meta
      ? `Activa ${meta.sectionLabel.toLowerCase()} primero`
      : "Activa este modo primero";
  }, [manualAddDisabled, activeTab]);

  const manualAddCopy = MANUAL_ADD_COPY[activeTab];

  const router = useRouter();
  const [draftPin, setDraftPin] = useState<DraftPin | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [confirmingDraft, startConfirmTransition] = useTransition();
  // Drops stale reverse-geocode responses when the operator clicks again
  // before the previous resolve returned.
  const resolveSeqRef = useRef(0);
  // Coalesces rapid double-clicks (or drag-end events on adjacent pixels)
  // into a single reverse-geocode API call. The optimistic draft updates
  // immediately so the UI stays responsive; only the network call waits.
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlace = useCallback(
    (mode: ManualAddMode, latitude: number, longitude: number) => {
      setDraftError(null);
      const distanceMeters = propertyCoords
        ? haversineMeters(
            { latitude: propertyCoords.latitude, longitude: propertyCoords.longitude },
            { latitude, longitude },
          )
        : null;
      setDraftPin({
        mode,
        latitude,
        longitude,
        name: "",
        address: null,
        distanceMeters,
        feeType: null,
        resolving: true,
      });
      const reqId = ++resolveSeqRef.current;
      if (resolveTimerRef.current !== null) clearTimeout(resolveTimerRef.current);
      resolveTimerRef.current = setTimeout(() => {
        void (async () => {
          const res = await reverseGeocodeForPinAction({
            propertyId,
            mode,
            latitude,
            longitude,
            language: "es",
          });
          if (reqId !== resolveSeqRef.current) return;
          const match = res.success && res.data ? res.data.match : null;
          setDraftPin((prev) => {
            if (!prev) return null;
            if (prev.latitude !== latitude || prev.longitude !== longitude) {
              return prev;
            }
            if (match) {
              return {
                ...prev,
                name: match.name ?? "",
                address: match.address,
                resolving: false,
              };
            }
            return { ...prev, resolving: false };
          });
        })();
      }, 250);
    },
    [propertyId, propertyCoords],
  );

  const clearDraft = useCallback(() => {
    resolveSeqRef.current++;
    if (resolveTimerRef.current !== null) {
      clearTimeout(resolveTimerRef.current);
      resolveTimerRef.current = null;
    }
    setDraftPin(null);
    setDraftError(null);
  }, []);

  // Per-tab "+" arms a specific mode, so a draft from the previous tab no
  // longer applies.
  useEffect(() => {
    clearDraft();
  }, [activeTab, clearDraft]);

  // Clear pending reverse-geocode timer on unmount so the deferred resolve
  // callback can't fire against a stale component.
  useEffect(() => {
    return () => {
      if (resolveTimerRef.current !== null) clearTimeout(resolveTimerRef.current);
    };
  }, []);

  const setDraftName = useCallback((name: string) => {
    setDraftError(null);
    setDraftPin((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const setDraftFeeType = useCallback((fee: DraftFee | null) => {
    setDraftPin((prev) => (prev ? { ...prev, feeType: fee } : null));
  }, []);

  const clearDraftError = useCallback(() => setDraftError(null), []);

  const confirmDraft = useCallback(() => {
    if (!draftPin) return;
    const trimmedName = draftPin.name.trim();
    if (!trimmedName) return;
    const draft = draftPin;
    setDraftError(null);
    startConfirmTransition(async () => {
      const res =
        draft.mode === "parking"
          ? await addManualParkingPlaceAction({
              propertyId,
              name: trimmedName,
              latitude: draft.latitude,
              longitude: draft.longitude,
              address: draft.address ?? undefined,
              feeType: draft.feeType ?? undefined,
            })
          : await addManualArrivalOptionAction({
              propertyId,
              mode: draft.mode,
              name: trimmedName,
              latitude: draft.latitude,
              longitude: draft.longitude,
              address: draft.address ?? undefined,
            });
      if (!res.success) {
        setDraftError(res.error ?? "No se pudo añadir.");
        return;
      }
      resolveSeqRef.current++;
      setDraftPin(null);
      setDraftError(null);
      router.refresh();
    });
  }, [draftPin, propertyId, router]);

  const enabledIntercityModes = useMemo(
    () => INTERCITY_MODES.filter((m) => isIntercityEnabled(m.key)),
    [isIntercityEnabled],
  );

  const value = useMemo<ArrivalCockpitContextValue>(
    () => ({
      propertyId,
      propertyCoords,
      arrivalOptions,
      parkingPlaces,
      arrivalSuggestionsCache,
      searchRadiusMeters,
      onChangeSearchRadiusMeters,
      optionsByMode,
      activeTab,
      setActiveTab,
      visibleModes,
      toggleVisibleMode,
      suggestionsByMode,
      handleSuggestionsChange,
      isParkingEnabled,
      isIntercityEnabled,
      handleToggleIntercity,
      togglePending,
      draftPin,
      handlePlace,
      clearDraft,
      setDraftName,
      setDraftFeeType,
      confirmDraft,
      confirmingDraft,
      draftError,
      clearDraftError,
      currentManualAddMode,
      manualAddDisabled,
      manualAddDisabledReason,
      manualAddCopy,
      enabledIntercityModes,
    }),
    [
      propertyId,
      propertyCoords,
      arrivalOptions,
      parkingPlaces,
      arrivalSuggestionsCache,
      searchRadiusMeters,
      onChangeSearchRadiusMeters,
      optionsByMode,
      activeTab,
      visibleModes,
      toggleVisibleMode,
      suggestionsByMode,
      handleSuggestionsChange,
      isParkingEnabled,
      isIntercityEnabled,
      handleToggleIntercity,
      togglePending,
      draftPin,
      handlePlace,
      clearDraft,
      setDraftName,
      setDraftFeeType,
      confirmDraft,
      confirmingDraft,
      draftError,
      clearDraftError,
      currentManualAddMode,
      manualAddDisabled,
      manualAddDisabledReason,
      manualAddCopy,
      enabledIntercityModes,
    ],
  );

  return (
    <ArrivalCockpitContext.Provider value={value}>
      {children}
    </ArrivalCockpitContext.Provider>
  );
}

// ── Map consumer ───────────────────────────────────────────────────────

interface ArrivalCockpitMapProps {
  /** Hide the map's "expand" button. Set true when this map is already
   * rendered inside the expanded lightbox slide — otherwise the button
   * would try to re-open the lightbox that hosts it. */
  hideExpand?: boolean;
  /** Override the MultiPinMap height. Defaults to 260 (inline cockpit).
   * Ignored when `fillSlideArea` is true. */
  mapHeight?: number;
  /** When true, the map sizes itself to the lightbox slide area
   * (`min(82vh, 900px)`, re-measured on resize) and the manual-add
   * mini-form renders as a floating overlay anchored to the bottom of
   * the slide instead of in normal flow below the map. */
  fillSlideArea?: boolean;
}

export function ArrivalCockpitMap({
  hideExpand = false,
  mapHeight = 260,
  fillSlideArea = false,
}: ArrivalCockpitMapProps) {
  const {
    propertyCoords,
    arrivalOptions,
    parkingPlaces,
    searchRadiusMeters,
    activeTab,
    suggestionsByMode,
    isIntercityEnabled,
    visibleModes,
    toggleVisibleMode,
    enabledIntercityModes,
    currentManualAddMode,
    manualAddDisabled,
    manualAddDisabledReason,
    manualAddCopy,
    handlePlace,
    draftPin,
  } = useArrivalCockpit();

  // When the map fills the lightbox slide area, the height is driven by the
  // shared lightbox formula (min(82vh, 900px), re-measured on resize). Inline
  // cockpits ignore the hook value and use the static prop.
  const dynamicHeight = useLightboxMapHeight(fillSlideArea);
  const effectiveMapHeight = fillSlideArea ? dynamicHeight : mapHeight;

  const parkingState = useParkingStateContext();
  const parkingSuggestions =
    parkingState?.suggestions ?? EMPTY_PARKING_SUGGESTIONS;

  const unifiedPins: MultiPinSpec[] = useMemo(() => {
    const out: MultiPinSpec[] = [];
    if (isIntercityEnabled("parking") && visibleModes.parking) {
      for (const p of parkingPlaces) {
        if (p.latitude === null || p.longitude === null) continue;
        out.push({
          id: pinIdForPlace(p.id),
          latitude: p.latitude,
          longitude: p.longitude,
          kind: feeTypeToPinKind(p.feeType),
          label: p.name,
        });
      }
    }
    for (const a of arrivalOptions) {
      if (a.latitude === null || a.longitude === null) continue;
      const intercityKey = (
        a.mode === "train" || a.mode === "bus" || a.mode === "airport"
          ? a.mode
          : null
      ) as IntercityKey | null;
      if (intercityKey === null) continue;
      if (!isIntercityEnabled(intercityKey)) continue;
      if (!visibleModes[intercityKey]) continue;
      out.push({
        id: pinIdForArrival(a.id),
        latitude: a.latitude,
        longitude: a.longitude,
        kind: "confirmed-arrival",
        arrivalMode: a.mode,
        isRecommended: a.isRecommended,
        label: a.name,
      });
    }
    if (activeTab === "parking") {
      if (isIntercityEnabled("parking") && visibleModes.parking) {
        for (const s of parkingSuggestions) {
          out.push({
            id: pinIdForSuggestion(s.providerPlaceId),
            latitude: s.latitude,
            longitude: s.longitude,
            kind: "suggestion-parking",
            label: s.name,
          });
        }
      }
    } else {
      const mode = activeTab as ArrivalMode;
      if (isIntercityEnabled(activeTab) && visibleModes[activeTab]) {
        for (const s of suggestionsByMode[mode] ?? []) {
          out.push({
            id: pinIdForArrivalSuggestion(s.providerPlaceId),
            latitude: s.latitude,
            longitude: s.longitude,
            kind: "suggestion-arrival",
            arrivalMode: mode as ArrivalPinMode,
            label: s.name,
          });
        }
      }
    }
    return out;
  }, [parkingPlaces, arrivalOptions, activeTab, suggestionsByMode, parkingSuggestions, visibleModes, isIntercityEnabled]);

  const openLightboxForUsageKey = useSubsystemLightbox();
  const expandHandler = useMemo(
    () =>
      !hideExpand && openLightboxForUsageKey
        ? () => openLightboxForUsageKey(LIVE_MAP_USAGE_KEY)
        : undefined,
    [hideExpand, openLightboxForUsageKey],
  );

  if (!propertyCoords) return null;

  const previewPin = draftPin
    ? { latitude: draftPin.latitude, longitude: draftPin.longitude }
    : null;

  return (
    <MultiPinMap
      anchor={propertyCoords}
      pins={unifiedPins}
      activeId={parkingState?.effectiveActiveId ?? null}
      onPinClick={parkingState?.setActiveId}
      onPinHover={parkingState?.setActiveId}
      onMapClick={parkingState?.handleMapClick}
      armed={parkingState?.isArmedForRelocate ?? false}
      previewPin={previewPin}
      height={effectiveMapHeight}
      radiusMeters={searchRadiusMeters}
      manualAdd={{
        mode: currentManualAddMode,
        disabled: manualAddDisabled,
        disabledReason: manualAddDisabledReason,
        addTooltip: manualAddCopy.addTooltip,
        armedHint: manualAddCopy.armedHint,
        onPlace: handlePlace,
      }}
      onExpand={expandHandler}
      overlay={
        <>
          <ParkingMapOverlay />
          <ModeVisibilityOverlay
            enabledModes={enabledIntercityModes}
            visibleModes={visibleModes}
            onToggle={toggleVisibleMode}
          />
        </>
      }
    />
  );
}

// ── Tabs consumer ──────────────────────────────────────────────────────

interface ArrivalCockpitTabsProps {
  /** Lists for the parking section (no map — the map lives in
   * ArrivalCockpitMap). */
  parkingPanel: ReactNode;
}

export function ArrivalCockpitTabs({ parkingPanel }: ArrivalCockpitTabsProps) {
  const {
    propertyId,
    propertyCoords,
    arrivalSuggestionsCache,
    parkingPlaces,
    optionsByMode,
    activeTab,
    setActiveTab,
    isIntercityEnabled,
    handleToggleIntercity,
    togglePending,
    handleSuggestionsChange,
    searchRadiusMeters,
    onChangeSearchRadiusMeters,
  } = useArrivalCockpit();

  const parkingState = useParkingStateContext();

  return (
    <div className="recipe-cockpit-tabs-container">
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as IntercityKey)}
    >
      <TabsList>
        {INTERCITY_MODES.map((m) => {
          const Icon = m.icon;
          const on = isIntercityEnabled(m.key);
          return (
            <TabsTrigger key={m.key} value={m.key} aria-label={m.label}>
              <span className="inline-flex items-center gap-1.5">
                <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                <span className="cockpit-tab-label">{m.label}</span>
                {on && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[var(--color-action-primary)]"
                    aria-hidden="true"
                  />
                )}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {INTERCITY_MODES.map((m) => {
        const on = isIntercityEnabled(m.key);
        const toggle = (
          <EnableToggle
            enabled={on}
            disabled={togglePending}
            onToggle={() => handleToggleIntercity(m.key)}
          />
        );
        return (
          <TabsContent key={m.key} value={m.key} className="space-y-3 pt-3">
            {m.key === "parking" ? (
              <ParkingSection
                places={parkingPlaces}
                sectionLabel={m.sectionLabel}
                enabled={on}
                headerAction={toggle}
              >
                {parkingPanel}
              </ParkingSection>
            ) : (
              <TransitSection
                meta={INTERCITY_TRANSIT_MODES.find((t) => t.key === m.key)!}
                propertyId={propertyId}
                propertyCoords={propertyCoords}
                options={optionsByMode[m.key as IntercityTransitKey]}
                initialSuggestions={
                  arrivalSuggestionsCache[m.key as IntercityTransitKey] ?? []
                }
                relocatingArrivalId={parkingState?.relocatingArrivalId ?? null}
                onRequestRelocate={parkingState?.handleArrivalRelocateRequest}
                activeId={parkingState?.effectiveActiveId ?? null}
                onSetActiveId={parkingState?.setActiveId}
                onSuggestionsChange={handleSuggestionsChange}
                radiusMeters={searchRadiusMeters}
                onChangeRadiusMeters={onChangeSearchRadiusMeters}
                enabled={on}
                headerAction={toggle}
              />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
    </div>
  );
}

// ── Inline enable/disable pill toggle ──────────────────────────────────

function EnableToggle({
  enabled,
  disabled,
  onToggle,
}: {
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={enabled}
      className={
        enabled
          ? "inline-flex h-7 items-center rounded-full border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-2.5 text-[11px] font-semibold text-[var(--color-text-on-accent)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
          : "inline-flex h-7 items-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-2.5 text-[11px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-muted)] disabled:opacity-50"
      }
    >
      {enabled ? "Desactivar" : "Activar"}
    </button>
  );
}

// ── Map overlay: per-mode visibility checkboxes ─────────────────────────

function ModeVisibilityOverlay({
  enabledModes,
  visibleModes,
  onToggle,
}: {
  enabledModes: readonly IntercityMeta[];
  visibleModes: Record<IntercityKey, boolean>;
  onToggle: (key: IntercityKey) => void;
}) {
  if (enabledModes.length === 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex flex-nowrap gap-1">
      {enabledModes.map((m) => {
        const Icon = m.icon;
        const isVisible = visibleModes[m.key];
        const StateIcon = isVisible ? Eye : EyeOff;
        const tooltip = isVisible
          ? `Ocultar ${m.sectionLabel.toLowerCase()}`
          : `Mostrar ${m.sectionLabel.toLowerCase()}`;
        return (
          <Tooltip key={m.key} text={tooltip}>
            <button
              type="button"
              onClick={() => onToggle(m.key)}
              aria-pressed={isVisible}
              aria-label={tooltip}
              className={
                "pointer-events-auto inline-flex h-7 items-center gap-1 rounded-full border px-2 shadow-[var(--shadow-sm)] transition-colors " +
                (isVisible
                  ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-action-primary-hover)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-background-muted)]")
              }
            >
              <Icon size={14} strokeWidth={2} aria-hidden="true" />
              <StateIcon
                size={11}
                strokeWidth={2}
                aria-hidden="true"
                className={
                  isVisible
                    ? "opacity-90"
                    : "text-[var(--color-text-secondary)]"
                }
              />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── Parking section (header + provided panel body) ─────────────────────

function ParkingSection({
  places,
  sectionLabel,
  enabled,
  headerAction,
  children,
}: {
  places: ParkingPlace[];
  sectionLabel: string;
  enabled: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const summary = useMemo(() => {
    if (places.length === 0) return null;
    let paid = 0;
    let free = 0;
    for (const p of places) {
      if (p.feeType === "paid") paid++;
      else if (p.feeType === "free") free++;
    }
    const unknown = places.length - paid - free;
    const parts: string[] = [];
    if (paid > 0) parts.push(`${paid} de pago`);
    if (free > 0) parts.push(`${free} gratuito${free === 1 ? "" : "s"}`);
    if (unknown > 0) parts.push(`${unknown} sin clasificar`);
    return parts.join(" · ");
  }, [places]);

  return (
    <SectionShell
      icon={ParkingSquare}
      label={sectionLabel}
      summary={summary}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((v) => !v)}
      action={headerAction}
    >
      {enabled ? (
        children
      ) : (
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          Activa este modo de llegada para configurarlo.
        </p>
      )}
    </SectionShell>
  );
}

