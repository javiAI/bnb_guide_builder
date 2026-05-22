"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Building2,
  BusFront,
  ChevronDown,
  CircleHelp,
  CircleParking,
  Clock,
  KeyRound,
  Loader2,
  MapPin,
  Navigation,
  ParkingMeter,
  ParkingSquare,
  Pencil,
  Plane,
  Plus,
  Star,
  TrainFrontTunnel,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDistance } from "@/lib/services/places";
import { updateArrivalOptionAction } from "@/lib/actions/arrival.actions";
import { updateParkingPlaceAction } from "@/lib/actions/parking.actions";
import {
  MultiPinMap,
  feeTypeToPinKind,
  type MultiPinSpec,
} from "./multi-pin-map";
import { pinIdForArrival, pinIdForPlace } from "./pin-ids";
import { formatDisplayAddress } from "./place-list-row";
import { ArrivalModeBadge } from "./arrival-row";
import { LIVE_MAP_USAGE_KEY, type SubsystemSlide } from "./subsystem-card.types";
import { MediaCarousel, type MediaCarouselSlide } from "@/components/ui/media-carousel";
import { MediaLightbox } from "./media-lightbox";
import { useLightboxMapHeight } from "@/hooks/use-lightbox-map-height";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  appleMapsDirHref,
  appleMapsViaHref,
  computeVisibleTabs as computeVisibleTabKeys,
  gMapsDirHref,
  gMapsViaHref,
  isIntercityMode,
  methodIdFromUsageKey,
  type ArrivalTabKey,
  type IntercityMode,
  type RateTier,
  type RateTierPer,
} from "./arrival-steps-helpers";
import type { ArrivalMode } from "@/lib/services/arrival-discovery.service";

export type { RateTier, RateTierPer } from "./arrival-steps-helpers";

export type { ArrivalTabKey } from "./arrival-steps-helpers";
export type ArrivalStepKey = "arrival" | "building" | "unit";

export interface ArrivalPropertyCoords {
  latitude: number;
  longitude: number;
}

export interface ArrivalParkingPlace {
  id: string;
  name: string;
  shortNote: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  distanceMeters: number | null;
  feeType: "free" | "paid" | null;
  isRecommended: boolean;
  /** Multi-tier tariff. Empty array == no tariff configured (same surface as
   * `null` from a UX perspective; the read path normalises both shapes). */
  rateTiers: RateTier[];
}

export interface ArrivalTransitOption {
  id: string;
  /** Editor surface is intercity-only — last-mile modes (metro/urban_bus/taxi)
   * are filtered out at the boundary (access-form) and never reach the rows. */
  mode: IntercityMode;
  name: string;
  shortNote: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  distanceMeters: number | null;
  isRecommended: boolean;
}

export interface ArrivalMethodSummary {
  id: string;
  label: string;
  icon: LucideIcon;
  isPrimary: boolean;
  hasDynamicCode: boolean;
}

interface BaseStep {
  key: ArrivalStepKey;
  icon: LucideIcon;
  title: string;
}

export interface ArrivalHowToStep extends BaseStep {
  key: "arrival";
  hasData: boolean;
  streetAddress: string | null;
  city: string | null;
  propertyCoords: ArrivalPropertyCoords | null;
  parkingPlaces: ArrivalParkingPlace[];
  arrivalOptions: ArrivalTransitOption[];
  /** Section-2 enable state — paso 01 mirrors only the tabs the operator has
   * turned on. Last-mile sub-blocks were removed (the directional deep link
   * already surfaces transit + walking automatically). */
  arrivalModesEnabled: Partial<Record<"parking" | ArrivalMode, boolean>>;
}

interface MethodStepData extends BaseStep {
  key: "building" | "unit";
  hasData: boolean;
  methods: ArrivalMethodSummary[];
  /** Full subsystem slide set (cover + method-scoped photos). Cover slides
   * have `usageKey === access.<cockpitTarget>` (depth 2); per-method photos
   * have depth ≥ 3 (`access.<cockpitTarget>.<methodId>`). The step renders
   * both — cover as hero carousel, method photos as the bottom strip — and
   * pipes them through a shared `MediaLightbox`. */
  slides: readonly SubsystemSlide[];
  /** Required by `MediaCarousel`/`MediaLightbox` for upload routing. */
  propertyId: string;
  cockpitTarget: "building" | "unit";
}

export type ArrivalStep = ArrivalHowToStep | MethodStepData;

interface ArrivalStepsEditorProps {
  steps: ArrivalStep[];
  expanded: Record<string, boolean>;
  onToggleStep: (key: ArrivalStepKey) => void;
}

const NOTE_MAX = 600;

export function ArrivalStepsEditor({
  steps,
  expanded,
  onToggleStep,
}: ArrivalStepsEditorProps) {
  return (
    <ol
      className={cn(
        "relative m-0 list-none p-0",
        "before:absolute before:left-[19px] before:top-[14px] before:bottom-[50px]",
        "before:w-[2px] before:rounded-[1px] before:bg-[var(--color-border-subtle)]",
      )}
    >
      {steps.map((step, idx) => {
        const isOpen = !!expanded[step.key];
        return (
          <li key={step.key} className="relative pl-[56px] pb-3.5 last:pb-0">
            <StepNumberDot number={idx + 1} hasData={step.hasData} />
            <StepCard
              step={step}
              isOpen={isOpen}
              onToggle={() => onToggleStep(step.key)}
            />
          </li>
        );
      })}
    </ol>
  );
}

function StepNumberDot({
  number,
  hasData,
}: {
  number: number;
  hasData: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute left-2 top-2 z-[2] grid h-6 w-6 place-items-center rounded-full",
        "text-[11px] font-bold tabular-nums border-2",
        hasData
          ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)]",
      )}
    >
      {number}
    </span>
  );
}

function StepCard({
  step,
  isOpen,
  onToggle,
}: {
  step: ArrivalStep;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = step.icon;
  const summaryLine = useMemo(() => stepSummaryLine(step), [step]);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[16px] border bg-[var(--color-background-elevated)]",
        "transition-[border-color,box-shadow] duration-150",
        isOpen
          ? "border-[var(--color-border-strong)] [box-shadow:var(--elevation-surface-sm)]"
          : "border-[var(--color-border-subtle)]",
      )}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 px-4 py-3.5">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-9 w-9 flex-none place-items-center rounded-[10px]",
            "border border-[var(--color-border-subtle)] bg-[var(--color-background-subtle)]",
            "text-[var(--color-text-secondary)]",
          )}
        >
          <Icon size={16} strokeWidth={1.75} />
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className={cn(
            "w-full cursor-pointer border-0 bg-transparent p-0 text-left",
            "focus-visible:outline-none focus-visible:rounded-md",
            "focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
          )}
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold leading-tight tracking-[-0.005em] text-[var(--color-text-primary)]">
              {step.title}
            </span>
            {!step.hasData && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-[3px]",
                  "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]",
                  "text-[10.5px] font-semibold tracking-[0.04em]",
                )}
              >
                <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-current" />
                Sin configurar
              </span>
            )}
          </span>
          <span className="mt-1 line-clamp-1 block text-[12.5px] leading-[1.55] text-[var(--color-text-secondary)]">
            {summaryLine}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "Colapsar paso" : "Expandir paso"}
          className={cn(
            "grid h-7 w-7 flex-none place-items-center self-center rounded-lg",
            "border-0 bg-transparent text-[var(--color-text-muted)]",
            "hover:bg-[var(--color-background-subtle)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
            "[@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px]",
          )}
        >
          <ChevronDown
            size={14}
            aria-hidden="true"
            strokeWidth={2}
            className={cn("transition-transform duration-[160ms]", isOpen && "rotate-180")}
          />
        </button>
      </div>

      {isOpen && (
        <div className="grid gap-3.5 border-t border-[var(--color-border-subtle)] p-4">
          <StepBody step={step} />
        </div>
      )}
    </article>
  );
}

function stepSummaryLine(step: ArrivalStep): string {
  if (step.key === "arrival") {
    const counts: string[] = [];
    if (step.parkingPlaces.length > 0) {
      counts.push(
        `${step.parkingPlaces.length} ${step.parkingPlaces.length === 1 ? "plaza de aparcamiento" : "plazas de aparcamiento"}`,
      );
    }
    const transitCount = step.arrivalOptions.length;
    if (transitCount > 0) {
      counts.push(`${transitCount} ${transitCount === 1 ? "opción de transporte" : "opciones de transporte"}`);
    }
    if (counts.length > 0) return counts.join(" · ");
    return "Sin opciones configuradas. Añade aparcamiento o transporte en la sección 02.";
  }

  if (step.methods.length === 0) {
    return step.key === "building"
      ? "Sin métodos configurados para el edificio."
      : "Sin métodos configurados para la vivienda.";
  }
  const primary = step.methods.find((m) => m.isPrimary) ?? step.methods[0];
  const backups = step.methods.filter((m) => m !== primary);
  if (backups.length === 0) return `${primary.label} (principal)`;
  return `${primary.label} (principal) · ${backups.map((m) => m.label).join(" · ")}`;
}

function StepBody({ step }: { step: ArrivalStep }) {
  if (step.key === "arrival") return <ArrivalStepBody step={step} />;
  return <MethodPreview step={step} />;
}

// ── Paso 01 — Cómo llegar (header + mapa + tabs + listado) ─────────────
// Tabs visibles solo si la sección 2 los tiene activados Y hay ≥1 item.
// Deep links por item son direccionales: origen=item, destino=propiedad.

const TAB_META: Record<ArrivalTabKey, { label: string; icon: LucideIcon }> = {
  coche: { label: "Vehículo", icon: ParkingSquare },
  train: { label: "Tren", icon: TrainFrontTunnel },
  bus: { label: "Autobús", icon: BusFront },
  airport: { label: "Avión", icon: Plane },
};

function ArrivalStepBody({ step }: { step: ArrivalHowToStep }) {
  const visibleTabs = useMemo(() => {
    return computeVisibleTabKeys(
      step.parkingPlaces,
      step.arrivalOptions,
      step.arrivalModesEnabled,
    ).map((key) => ({ key, ...TAB_META[key] }));
  }, [step.parkingPlaces, step.arrivalOptions, step.arrivalModesEnabled]);

  const [activeTab, setActiveTab] = useState<ArrivalTabKey | null>(
    visibleTabs[0]?.key ?? null,
  );

  // Keep activeTab valid when the visibleTabs set shrinks (e.g. operator deletes
  // the last option of the currently-selected mode upstream, or disables the
  // mode in section-2).
  useEffect(() => {
    if (visibleTabs.length === 0) {
      setActiveTab(null);
      return;
    }
    if (!activeTab || !visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0]!.key);
    }
  }, [visibleTabs, activeTab]);

  // Shared hover/click state between map pins and list rows. Row IDs use the
  // canonical `pinIdForPlace`/`pinIdForArrival` helpers so highlight sync stays
  // consistent with the unified cockpit map + lightbox.
  const [activeId, setActiveId] = useState<string | null>(null);

  const pins = useMemo<MultiPinSpec[]>(() => {
    const list: MultiPinSpec[] = [];
    if (step.arrivalModesEnabled.parking === true) {
      for (const p of step.parkingPlaces) {
        if (p.latitude === null || p.longitude === null) continue;
        list.push({
          id: pinIdForPlace(p.id),
          latitude: p.latitude,
          longitude: p.longitude,
          kind: feeTypeToPinKind(p.feeType),
          isRecommended: p.isRecommended,
          label: p.name,
        });
      }
    }
    for (const o of step.arrivalOptions) {
      if (o.latitude === null || o.longitude === null) continue;
      if (!isIntercityMode(o.mode)) continue;
      if (step.arrivalModesEnabled[o.mode] !== true) continue;
      list.push({
        id: pinIdForArrival(o.id),
        latitude: o.latitude,
        longitude: o.longitude,
        kind: "confirmed-arrival",
        arrivalMode: o.mode,
        isRecommended: o.isRecommended,
        label: o.name,
      });
    }
    return list;
  }, [step.parkingPlaces, step.arrivalOptions, step.arrivalModesEnabled]);

  /** Pre-group transit options by mode once; the tab renderer indexes into
   * this map instead of re-filtering the full options list per tab. */
  const optionsByMode = useMemo<Record<IntercityMode, ArrivalTransitOption[]>>(() => {
    const m: Record<IntercityMode, ArrivalTransitOption[]> = {
      train: [],
      bus: [],
      airport: [],
    };
    for (const o of step.arrivalOptions) {
      if (isIntercityMode(o.mode)) m[o.mode].push(o);
    }
    return m;
  }, [step.arrivalOptions]);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const handleLightboxOpen = useCallback(() => setLightboxOpen(true), []);
  const handleLightboxClose = useCallback(() => setLightboxOpen(false), []);

  // Synthetic live-map slide so the lightbox has something to anchor on. The
  // actual map is rendered through `lightboxMap` (custom node) using the same
  // pins as the inline map — `livePins` here is only used by the fallback
  // branch of MediaLightbox (which we don't hit because we pass lightboxMap).
  const lightboxSlide = useMemo<SubsystemSlide | null>(() => {
    if (!step.propertyCoords) return null;
    return {
      id: "arrival-step-live-map",
      assetId: "",
      kind: "live-map",
      url: "",
      alt: "Mapa interactivo de llegada",
      blurhash: null,
      title: "Cómo llegar",
      usageKey: LIVE_MAP_USAGE_KEY,
      livePins: [],
      liveAnchor: step.propertyCoords,
    };
  }, [step.propertyCoords]);

  // Memo deps are narrowed to the fields ArrivalStepTabs actually consumes
  // from `step` (rather than `step` itself). The parent recreates the `step`
  // object on every render, so depending on it would defeat the memo and
  // force the lightbox side-panel subtree to remount on each parent render.
  const tabsPanel = useMemo(
    () => (
      <ArrivalStepTabs
        step={step}
        visibleTabs={visibleTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeId={activeId}
        setActiveId={setActiveId}
        optionsByMode={optionsByMode}
      />
    ),
    [
      step.parkingPlaces,
      step.propertyCoords,
      visibleTabs,
      activeTab,
      activeId,
      optionsByMode,
    ],
  );

  return (
    <div className="space-y-4">
      <ArrivalHeader
        streetAddress={step.streetAddress}
        city={step.city}
        propertyCoords={step.propertyCoords}
      />

      {step.propertyCoords && pins.length > 0 && (
        <div
          className={cn(
            "overflow-hidden rounded-[12px] border",
            "border-[var(--color-border-subtle)] bg-[var(--color-background-subtle)]",
          )}
        >
          <MultiPinMap
            anchor={step.propertyCoords}
            pins={pins}
            activeId={activeId}
            onPinHover={setActiveId}
            onPinClick={setActiveId}
            height={200}
            interactive
            onExpand={lightboxSlide ? handleLightboxOpen : undefined}
          />
        </div>
      )}

      {tabsPanel}

      {lightboxOpen && lightboxSlide && step.propertyCoords && (
        <MediaLightbox
          slides={[lightboxSlide]}
          index={0}
          onClose={handleLightboxClose}
          lightboxMap={
            <ArrivalStepLightboxMap
              anchor={step.propertyCoords}
              pins={pins}
              activeId={activeId}
              setActiveId={setActiveId}
            />
          }
          lightboxSidePanel={tabsPanel}
        />
      )}
    </div>
  );
}

function ArrivalStepTabs({
  step,
  visibleTabs,
  activeTab,
  setActiveTab,
  activeId,
  setActiveId,
  optionsByMode,
}: {
  step: ArrivalHowToStep;
  visibleTabs: { key: ArrivalTabKey; icon: LucideIcon; label: string }[];
  activeTab: ArrivalTabKey | null;
  setActiveTab: (next: ArrivalTabKey) => void;
  activeId: string | null;
  setActiveId: (id: string | null | ((prev: string | null) => string | null)) => void;
  optionsByMode: Record<IntercityMode, ArrivalTransitOption[]>;
}) {
  if (visibleTabs.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[12px] border border-dashed px-4 py-5 text-center",
          "border-[var(--color-border-default)] bg-[var(--color-background-subtle)]",
        )}
      >
        <p className="m-0 text-[13.5px] font-semibold text-[var(--color-text-primary)]">
          Sin opciones configuradas
        </p>
        <p className="mx-auto mt-1.5 max-w-[44ch] text-[12.5px] leading-[1.55] text-[var(--color-text-secondary)]">
          Activa modos de llegada y añade plazas u opciones de transporte en la sección 02
          para mostrarlas aquí al huésped.
        </p>
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab ?? undefined}
      onValueChange={(v) => setActiveTab(v as ArrivalTabKey)}
    >
      <TabsList>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.key} value={tab.key} aria-label={tab.label}>
              <span className="inline-flex items-center gap-1.5">
                <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                <span>{tab.label}</span>
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {visibleTabs.map((tab) => {
        if (tab.key === "coche") {
          return (
            <TabsContent key={tab.key} value={tab.key} className="pt-3">
              <ParkingList
                places={step.parkingPlaces}
                propertyCoords={step.propertyCoords}
                activeId={activeId}
                setActiveId={setActiveId}
              />
            </TabsContent>
          );
        }
        const intercityMode: IntercityMode = tab.key;
        return (
          <TabsContent key={tab.key} value={tab.key} className="pt-3">
            <TransitList
              mode={intercityMode}
              options={optionsByMode[intercityMode]}
              propertyCoords={step.propertyCoords}
              activeId={activeId}
              setActiveId={setActiveId}
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function ArrivalStepLightboxMap({
  anchor,
  pins,
  activeId,
  setActiveId,
}: {
  anchor: ArrivalPropertyCoords;
  pins: readonly MultiPinSpec[];
  activeId: string | null;
  setActiveId: (id: string | null | ((prev: string | null) => string | null)) => void;
}) {
  const mapHeight = useLightboxMapHeight();

  return (
    <MultiPinMap
      anchor={anchor}
      pins={pins}
      activeId={activeId}
      onPinHover={setActiveId}
      onPinClick={setActiveId}
      height={mapHeight}
      interactive
    />
  );
}

function ArrivalHeader({
  streetAddress,
  city,
  propertyCoords,
}: {
  streetAddress: string | null;
  city: string | null;
  propertyCoords: ArrivalPropertyCoords | null;
}) {
  const addressLine = [streetAddress, city].filter(Boolean).join(", ");

  if (!propertyCoords) {
    return (
      <div
        className={cn(
          "rounded-[12px] border border-dashed px-4 py-4",
          "border-[var(--color-border-default)] bg-[var(--color-background-subtle)]",
          "text-[12.5px] text-[var(--color-text-secondary)]",
        )}
      >
        Añade dirección y coordenadas en la pestaña Propiedad para mostrar el mapa.
      </div>
    );
  }

  if (!addressLine) return null;

  return (
    <p className="m-0 text-[13.5px] font-semibold text-[var(--color-text-primary)]">
      {addressLine}
    </p>
  );
}

// ── Parking list (Coche tab) ─────────────────────────────────────────────

function ParkingList({
  places,
  propertyCoords,
  activeId,
  setActiveId,
}: {
  places: ArrivalParkingPlace[];
  propertyCoords: ArrivalPropertyCoords | null;
  activeId: string | null;
  setActiveId: (id: string | null | ((prev: string | null) => string | null)) => void;
}) {
  const sorted = useMemo(() => {
    const free = places.filter((p) => p.feeType === "free");
    const paid = places.filter((p) => p.feeType === "paid");
    const other = places.filter((p) => p.feeType === null);
    return [...free, ...paid, ...other];
  }, [places]);

  if (sorted.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--color-text-secondary)]">
        Sin plazas de aparcamiento.
      </p>
    );
  }

  return (
    <ul className="m-0 grid gap-1.5 p-0">
      {sorted.map((p) => {
        const rowId = pinIdForPlace(p.id);
        return (
          <ParkingItemRow
            key={p.id}
            place={p}
            propertyCoords={propertyCoords}
            isActive={activeId === rowId}
            onActivate={() => setActiveId(rowId)}
            onDeactivate={() =>
              setActiveId((id) => (id === rowId ? null : id))
            }
          />
        );
      })}
    </ul>
  );
}

function ParkingItemRow({
  place,
  propertyCoords,
  isActive,
  onActivate,
  onDeactivate,
}: {
  place: ArrivalParkingPlace;
  propertyCoords: ArrivalPropertyCoords | null;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggleRecommended = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await updateParkingPlaceAction({
        placeId: place.id,
        isRecommended: !place.isRecommended,
      });
      if (!res.success) setError(res.error ?? "Error al guardar");
    });
  }, [place.id, place.isRecommended]);

  const handleSaveNote = useCallback(
    (note: string) => {
      setError(null);
      startTransition(async () => {
        const res = await updateParkingPlaceAction({
          placeId: place.id,
          shortNote: note === "" ? null : note,
        });
        if (!res.success) setError(res.error ?? "Error al guardar");
      });
    },
    [place.id],
  );

  const handleSaveTiers = useCallback(
    (tiers: RateTier[]) => {
      setError(null);
      startTransition(async () => {
        const res = await updateParkingPlaceAction({
          placeId: place.id,
          // Action accepts `null` to clear (legacy single-object path). Empty
          // array maps to clear semantically — keep the API surface narrow.
          rateJson: tiers.length === 0 ? null : tiers,
        });
        if (!res.success) setError(res.error ?? "Error al guardar");
      });
    },
    [place.id],
  );

  return (
    <ArrivalCompactRow
      kind="parking"
      leadingSlot={<ParkingFeeBadgeReadOnly feeType={place.feeType} />}
      name={place.name}
      address={place.address}
      distanceMeters={place.distanceMeters}
      latitude={place.latitude}
      longitude={place.longitude}
      isRecommended={place.isRecommended}
      onToggleRecommended={handleToggleRecommended}
      propertyCoords={propertyCoords}
      shortNote={place.shortNote}
      onSaveNote={handleSaveNote}
      disabled={isPending}
      error={error}
      isActive={isActive}
      onActivate={onActivate}
      onDeactivate={onDeactivate}
    >
      {place.feeType === "paid" && (
        <RateChipList
          tiers={place.rateTiers}
          onChange={handleSaveTiers}
          disabled={isPending}
        />
      )}
    </ArrivalCompactRow>
  );
}

// ── Transit list (Tren / Autobús / Avión) ────────────────────────────────

const TRANSIT_ICONS: Record<IntercityMode, LucideIcon> = {
  train: TrainFrontTunnel,
  bus: BusFront,
  airport: Plane,
};

function TransitList({
  mode,
  options,
  propertyCoords,
  activeId,
  setActiveId,
}: {
  mode: IntercityMode;
  options: ArrivalTransitOption[];
  propertyCoords: ArrivalPropertyCoords | null;
  activeId: string | null;
  setActiveId: (id: string | null | ((prev: string | null) => string | null)) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--color-text-secondary)]">
        Sin opciones configuradas para este modo.
      </p>
    );
  }
  return (
    <ul className="m-0 grid gap-1.5 p-0">
      {options.map((o) => {
        const rowId = pinIdForArrival(o.id);
        return (
          <TransitItemRow
            key={o.id}
            option={o}
            mode={mode}
            icon={TRANSIT_ICONS[mode]}
            propertyCoords={propertyCoords}
            isActive={activeId === rowId}
            onActivate={() => setActiveId(rowId)}
            onDeactivate={() =>
              setActiveId((id) => (id === rowId ? null : id))
            }
          />
        );
      })}
    </ul>
  );
}

function TransitItemRow({
  option,
  mode,
  icon,
  propertyCoords,
  isActive,
  onActivate,
  onDeactivate,
}: {
  option: ArrivalTransitOption;
  mode: IntercityMode;
  icon: LucideIcon;
  propertyCoords: ArrivalPropertyCoords | null;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggleRecommended = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await updateArrivalOptionAction({
        placeId: option.id,
        isRecommended: !option.isRecommended,
      });
      if (!res.success) setError(res.error ?? "Error al guardar");
    });
  }, [option.id, option.isRecommended]);

  const handleSaveNote = useCallback(
    (note: string) => {
      setError(null);
      startTransition(async () => {
        const res = await updateArrivalOptionAction({
          placeId: option.id,
          shortNote: note === "" ? null : note,
        });
        if (!res.success) setError(res.error ?? "Error al guardar");
      });
    },
    [option.id],
  );

  return (
    <ArrivalCompactRow
      kind="transit"
      leadingSlot={<ArrivalModeBadge icon={icon} mode={mode} />}
      name={option.name}
      address={option.address}
      distanceMeters={option.distanceMeters}
      latitude={option.latitude}
      longitude={option.longitude}
      isRecommended={option.isRecommended}
      onToggleRecommended={handleToggleRecommended}
      propertyCoords={propertyCoords}
      shortNote={option.shortNote}
      onSaveNote={handleSaveNote}
      disabled={isPending}
      error={error}
      isActive={isActive}
      onActivate={onActivate}
      onDeactivate={onDeactivate}
    />
  );
}

// ── Shared item primitives ───────────────────────────────────────────────

/** Read-only fee disc. Section-3 is the consumer surface; fee classification
 * lives in section-2. */
function ParkingFeeBadgeReadOnly({
  feeType,
}: {
  feeType: "free" | "paid" | null;
}) {
  const Icon =
    feeType === "free"
      ? CircleParking
      : feeType === "paid"
        ? ParkingMeter
        : CircleHelp;
  const stateLabel =
    feeType === "free"
      ? "Gratuito"
      : feeType === "paid"
        ? "De pago"
        : "Sin clasificar";
  return (
    <Tooltip text={stateLabel}>
      <span
        aria-label={stateLabel}
        className={cn(
          "flex h-6 w-6 flex-none items-center justify-center rounded-full border-2",
          "border-[var(--color-background-elevated)] shadow-[var(--shadow-sm)]",
          feeType !== null
            ? "bg-[var(--color-status-info-solid)] text-[var(--color-background-elevated)]"
            : "bg-[var(--color-background-muted)] text-[var(--color-text-muted)]",
        )}
      >
        <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

/** Compact per-row deep link pill — Navigation icon + provider label.
 * Operator's device picks the provider; we surface both. Used inside
 * ArrivalCompactRow on the action row below the address. */
function ProviderDeeplinkPill({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5",
        "border border-[var(--color-border-default)] bg-[var(--color-background-elevated)]",
        "text-[12px] font-medium text-[var(--color-text-primary)]",
        "transition-colors duration-100",
        "hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
        "[@media(pointer:coarse)]:min-h-[44px]",
      )}
    >
      <Navigation size={12} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </a>
  );
}

/** Star toggle button. */
function RecommendButton({
  isRecommended,
  onToggle,
  disabled,
}: {
  isRecommended: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <Tooltip text={isRecommended ? "Quitar de recomendado" : "Marcar como recomendado"}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={isRecommended ? "Quitar de recomendado" : "Marcar como recomendado"}
        aria-pressed={isRecommended}
        className={cn(
          "flex h-9 w-9 flex-none items-center justify-center rounded-[8px]",
          "transition-colors duration-100",
          isRecommended
            ? "text-[var(--color-status-warning-solid)] hover:bg-[var(--color-status-warning-bg)]"
            : "text-[var(--color-text-muted)] hover:bg-[var(--color-background-muted)] hover:text-[var(--color-text-secondary)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px]",
        )}
      >
        <Star
          size={17}
          strokeWidth={1.75}
          className={isRecommended ? "fill-[var(--color-status-warning-solid)]" : ""}
        />
      </button>
    </Tooltip>
  );
}

/** Compact row for parking + transit items: leading badge · name · address
 * subtitle (with per-provider deep links inline) · distance chip · star
 * trailing action. Below-row content (rate chips + note editor) goes in
 * `children`. `isActive` lights the row up when the matching map pin is
 * hovered/clicked; `onActivate`/`onDeactivate` push hover state back to the
 * map so the highlight stays bidirectional.
 *
 * `kind` decides the deeplink semantics:
 * - `"parking"` → current location → parking → property (3 stops, driving
 *   end-to-end via `gMapsViaHref` / `appleMapsViaHref`)
 * - `"transit"` → arrival point → property (last-mile only via
 *   `gMapsDirHref` / `appleMapsDirHref`; the guest gets there by intercity
 *   transit and the link covers the leg from the station onward, with
 *   driving + transit + walking surfaced automatically). */
function ArrivalCompactRow({
  kind,
  leadingSlot,
  name,
  address,
  distanceMeters,
  latitude,
  longitude,
  isRecommended,
  onToggleRecommended,
  propertyCoords,
  shortNote,
  onSaveNote,
  disabled,
  error,
  isActive,
  onActivate,
  onDeactivate,
  children,
}: {
  kind: "parking" | "transit";
  leadingSlot: React.ReactNode;
  name: string;
  address: string | null;
  distanceMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  isRecommended: boolean;
  onToggleRecommended: () => void;
  propertyCoords: ArrivalPropertyCoords | null;
  shortNote: string | null;
  onSaveNote: (note: string) => void;
  disabled: boolean;
  error: string | null;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  children?: React.ReactNode;
}) {
  const displayAddress = formatDisplayAddress(address);
  const distance =
    distanceMeters !== null ? formatDistance(distanceMeters) : null;
  const canDeeplink =
    latitude !== null && longitude !== null && propertyCoords !== null;
  const trimmedName = name.trim();
  const hasName = trimmedName !== "" && trimmedName !== "-";
  const rowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  return (
    <li
      ref={rowRef}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className={cn(
        "rounded-[10px] border px-2.5 py-2 transition-colors duration-100",
        isActive
          ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)]"
          : "border-[var(--color-border-subtle)] bg-[var(--color-background-elevated)]",
      )}
    >
      <div className="flex items-center gap-2.5">
        {leadingSlot}
        <div className="min-w-0 flex-1">
          <Tooltip text={hasName ? trimmedName : "Sin nombre"} className="min-w-0">
            <p
              className={cn(
                "m-0 truncate text-[13px] font-medium leading-tight",
                hasName
                  ? "text-[var(--color-text-primary)]"
                  : "italic text-[var(--color-text-subtle)]",
              )}
            >
              {hasName ? trimmedName : "Sin nombre"}
            </p>
          </Tooltip>
          {(displayAddress || distance) && (
            <div className="mt-1 flex min-w-0 items-center gap-2">
              {displayAddress && (
                <Tooltip text={displayAddress} className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[11.5px] leading-tight text-[var(--color-text-secondary)]">
                    {displayAddress}
                  </p>
                </Tooltip>
              )}
              {distance && (
                <span
                  aria-label={`Distancia ${distance}`}
                  className={cn(
                    "flex h-6 flex-none items-center gap-1 rounded-full px-2",
                    "bg-[var(--color-background-subtle)] text-[11.5px] font-medium text-[var(--color-text-primary)] tabular-nums",
                  )}
                >
                  <MapPin size={12} aria-hidden="true" />
                  {distance}
                </span>
              )}
            </div>
          )}
        </div>
        <RecommendButton
          isRecommended={isRecommended}
          onToggle={onToggleRecommended}
          disabled={disabled}
        />
      </div>
      {canDeeplink && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <ProviderDeeplinkPill
            href={
              kind === "parking"
                ? gMapsViaHref(
                    latitude!,
                    longitude!,
                    propertyCoords!.latitude,
                    propertyCoords!.longitude,
                  )
                : gMapsDirHref(
                    latitude!,
                    longitude!,
                    propertyCoords!.latitude,
                    propertyCoords!.longitude,
                  )
            }
            label="Google Maps"
          />
          <ProviderDeeplinkPill
            href={
              kind === "parking"
                ? appleMapsViaHref(
                    latitude!,
                    longitude!,
                    propertyCoords!.latitude,
                    propertyCoords!.longitude,
                  )
                : appleMapsDirHref(
                    latitude!,
                    longitude!,
                    propertyCoords!.latitude,
                    propertyCoords!.longitude,
                  )
            }
            label="Apple Maps"
          />
        </div>
      )}
      {children}
      <CollapsibleNoteEditor
        initialNote={shortNote ?? ""}
        onSave={onSaveNote}
        disabled={disabled}
      />
      {error && (
        <p className="mt-1.5 text-[11px] text-[var(--color-status-error-text)]">
          {error}
        </p>
      )}
    </li>
  );
}

/** Note editor that stays collapsed until the operator opens it. Empty notes
 * show "+ Nota" as a subtle chip; non-empty notes show a 1-line preview chip
 * that expands to a textarea on click. Saves debounced (800 ms). */
function CollapsibleNoteEditor({
  initialNote,
  onSave,
  disabled,
}: {
  initialNote: string;
  onSave: (note: string) => void;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(initialNote);
  const lastSavedRef = useRef(initialNote);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Re-sync local draft when the server-provided note changes from outside.
  useEffect(() => {
    if (initialNote !== lastSavedRef.current && initialNote !== draft) {
      lastSavedRef.current = initialNote;
      setDraft(initialNote);
    }
  }, [initialNote, draft]);

  useEffect(() => {
    if (draft === lastSavedRef.current) return;
    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    timerRef.current = setTimeout(() => {
      onSaveRef.current(draft);
      lastSavedRef.current = draft;
      setStatus("saved");
      resetTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
    }, 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [draft]);

  const hasNote = draft.trim() !== "";
  const remaining = NOTE_MAX - draft.length;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={disabled}
        className={cn(
          "mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5",
          "text-[11px] font-medium transition-colors duration-100",
          hasNote
            ? "border-[var(--color-border-subtle)] bg-[var(--color-background-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-action-primary)]"
            : "border-dashed border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <Pencil size={10} aria-hidden="true" />
        <span className="max-w-[28ch] truncate">
          {hasNote ? draft.trim() : "Añadir nota"}
        </span>
      </button>
    );
  }

  return (
    <div className="mt-1.5">
      <textarea
        autoFocus
        rows={2}
        maxLength={NOTE_MAX}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setExpanded(false)}
        disabled={disabled}
        placeholder="Nota para el huésped (ej. cómo aparcar, dónde parar)"
        className={cn(
          "block w-full min-h-[52px] resize-y rounded-[8px] px-2.5 py-1.5",
          "border border-[var(--color-border-default)] bg-[var(--color-background-elevated)]",
          "text-[12px] leading-[1.5] text-[var(--color-text-primary)]",
          "placeholder:text-[var(--color-text-muted)]",
          "focus:border-[var(--color-border-focus)] focus:outline-none",
          "disabled:opacity-50",
        )}
      />
      <div className="mt-0.5 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
        <span>
          {remaining >= 0 ? `${remaining} restantes` : `${-remaining} de más`}
        </span>
        <span>
          {status === "saving"
            ? "Guardando…"
            : status === "saved"
              ? "Guardado"
              : ""}
        </span>
      </div>
    </div>
  );
}

// ── Tarifa multi-tier (only for parking_paid) ────────────────────────────

const PER_LABEL_ES: Record<RateTierPer, string> = {
  minute: "min",
  hour: "hora",
  day: "día",
  week: "semana",
  month: "mes",
};

const PER_ORDER: readonly RateTierPer[] = [
  "minute",
  "hour",
  "day",
  "week",
  "month",
];

function currencySymbol(currency: string): string {
  const c = currency.toUpperCase().trim();
  if (c === "EUR") return "€";
  if (c === "USD") return "$";
  if (c === "GBP") return "£";
  return c;
}

function formatTier(tier: RateTier): string {
  return `${currencySymbol(tier.currency)}${tier.amount}/${PER_LABEL_ES[tier.per]}`;
}

function RateChipList({
  tiers,
  onChange,
  disabled,
}: {
  tiers: RateTier[];
  onChange: (next: RateTier[]) => void;
  disabled: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const removeTier = (idx: number) => {
    onChange(tiers.filter((_, i) => i !== idx));
  };

  const addTier = (tier: RateTier) => {
    onChange([...tiers, tier]);
    setAddOpen(false);
  };

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {tiers.map((tier, idx) => (
          <RateChip
            key={`${tier.per}-${tier.amount}-${idx}`}
            tier={tier}
            onRemove={() => removeTier(idx)}
            disabled={disabled}
          />
        ))}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={disabled}
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-full border border-dashed px-2",
            "border-[var(--color-border-default)] text-[11px] font-medium text-[var(--color-text-muted)]",
            "transition-colors duration-100",
            "hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[@media(pointer:coarse)]:min-h-[32px]",
          )}
        >
          <Plus size={10} aria-hidden="true" />
          {tiers.length === 0 ? "Añadir tarifa" : "Tarifa"}
        </button>
      </div>
      {addOpen && (
        <AddRateForm
          defaultCurrency={tiers[tiers.length - 1]?.currency ?? "EUR"}
          onCancel={() => setAddOpen(false)}
          onAdd={addTier}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function RateChip({
  tier,
  onRemove,
  disabled,
}: {
  tier: RateTier;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <Tooltip text={tier.note ?? `${tier.amount} ${tier.currency} cada ${PER_LABEL_ES[tier.per]}`}>
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border pl-2 pr-1",
          "border-[var(--color-border-default)] bg-[var(--color-background-elevated)]",
          "text-[11px] font-medium tabular-nums text-[var(--color-text-primary)]",
        )}
      >
        {formatTier(tier)}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Quitar tarifa ${formatTier(tier)}`}
          className={cn(
            "flex h-4 w-4 flex-none items-center justify-center rounded-full",
            "text-[var(--color-text-muted)] transition-colors duration-100",
            "hover:bg-[var(--color-status-error-bg)] hover:text-[var(--color-status-error-text)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <X size={10} aria-hidden="true" />
        </button>
      </span>
    </Tooltip>
  );
}

function AddRateForm({
  defaultCurrency,
  onCancel,
  onAdd,
  disabled,
}: {
  defaultCurrency: string;
  onCancel: () => void;
  onAdd: (tier: RateTier) => void;
  disabled: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [per, setPer] = useState<RateTierPer>("hour");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setError("Importe no válido.");
      return;
    }
    if (!currency.trim()) {
      setError("Moneda requerida.");
      return;
    }
    onAdd({
      amount: amountNum,
      currency: currency.trim().toUpperCase(),
      per,
      note: note.trim() === "" ? undefined : note.trim(),
    });
  };

  return (
    <div
      className={cn(
        "mt-1.5 grid gap-2 rounded-[8px] border p-2",
        "border-[var(--color-border-default)] bg-[var(--color-background-subtle)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={disabled}
          aria-label="Importe"
          placeholder="Importe"
          autoFocus
          className={cn(
            "h-7 w-20 rounded-[6px] border px-1.5 text-[12px] tabular-nums",
            "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-primary)]",
            "focus:border-[var(--color-border-focus)] focus:outline-none",
          )}
        />
        <input
          type="text"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          maxLength={8}
          disabled={disabled}
          aria-label="Moneda"
          className={cn(
            "h-7 w-14 rounded-[6px] border px-1.5 text-[12px] uppercase",
            "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-primary)]",
            "focus:border-[var(--color-border-focus)] focus:outline-none",
          )}
        />
        <span className="text-[12px] text-[var(--color-text-muted)]">/</span>
        <div role="radiogroup" aria-label="Periodo" className="flex flex-wrap gap-1">
          {PER_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={per === p}
              onClick={() => setPer(p)}
              disabled={disabled}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-2 text-[11px] font-medium",
                "transition-colors duration-100",
                per === p
                  ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-[var(--color-text-on-accent)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {PER_LABEL_ES[p]}
            </button>
          ))}
        </div>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        disabled={disabled}
        placeholder="Nota opcional (ej. primera hora gratis)"
        aria-label="Nota"
        className={cn(
          "h-7 w-full rounded-[6px] border px-1.5 text-[12px]",
          "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-primary)]",
          "placeholder:text-[var(--color-text-muted)]",
          "focus:border-[var(--color-border-focus)] focus:outline-none",
        )}
      />
      {error && (
        <p className="m-0 text-[11px] text-[var(--color-status-error-text)]">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="inline-flex h-7 items-center rounded-[6px] px-2 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background-elevated)] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-[6px] px-2.5 text-[11px] font-semibold",
            "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)]",
            "hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50",
          )}
        >
          {disabled && <Loader2 size={10} className="animate-spin" />}
          Añadir
        </button>
      </div>
    </div>
  );
}

// ── Pasos 02 / 03 — Entrar al edificio / vivienda (unchanged shape) ──────

function MethodPreview({ step }: { step: MethodStepData }) {
  const methodLabelById = useMemo(
    () => Object.fromEntries(step.methods.map((m) => [m.id, m.label])),
    [step.methods],
  );

  const coverUsageKey = `access.${step.cockpitTarget}`;

  const coverSlides = useMemo(
    () =>
      step.slides.filter(
        (s) => s.usageKey === coverUsageKey && (s.kind === "image" || s.kind === "map"),
      ),
    [step.slides, coverUsageKey],
  );

  const selectedMethodIds = useMemo(
    () => new Set(step.methods.map((m) => m.id)),
    [step.methods],
  );
  // Method-scoped photos only show when the method is still selected — a
  // deselected method's lingering uploads stay in storage but disappear from
  // the UI. Cover photos (depth 2) are not gated and surface through
  // `coverSlides` above.
  const methodSlides = useMemo(
    () =>
      step.slides.filter((s) => {
        if (s.kind !== "image") return false;
        if (s.usageKey === LIVE_MAP_USAGE_KEY) return false;
        const methodId = methodIdFromUsageKey(s.usageKey);
        return methodId !== null && selectedMethodIds.has(methodId);
      }),
    [step.slides, selectedMethodIds],
  );

  const lightboxSlides = useMemo(
    () => [...coverSlides, ...methodSlides],
    [coverSlides, methodSlides],
  );

  const coverCarouselSlides = useMemo<MediaCarouselSlide[]>(
    () =>
      coverSlides.map((s) => ({
        id: s.id,
        title: s.title,
        kind: s.kind === "map" ? ("map" as const) : ("image" as const),
        url: s.url,
        alt: s.alt || s.title,
      })),
    [coverSlides],
  );

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const handleLightboxClose = useCallback(() => setLightboxIdx(null), []);
  const handleCoverLightboxOpen = useCallback(
    (idx: number) => setLightboxIdx(idx),
    [],
  );
  const handleMethodPhotoClick = useCallback(
    (idx: number) => setLightboxIdx(coverSlides.length + idx),
    [coverSlides.length],
  );

  if (step.methods.length === 0) {
    return (
      <EmptyState
        title={
          step.key === "building"
            ? "Sin métodos para entrar al edificio"
            : "Sin métodos para entrar a la vivienda"
        }
        description="Selecciona al menos un método en la sección 02 para que aparezca aquí."
        cockpitId={step.cockpitTarget}
        cockpitLabel={
          step.cockpitTarget === "building"
            ? "Configurar en Edificio"
            : "Configurar en Vivienda"
        }
      />
    );
  }

  const hasDynamicCode = step.methods.some((m) => m.hasDynamicCode);

  return (
    <div className="space-y-3">
      {coverSlides.length > 0 && (
        <div className="overflow-hidden rounded-[12px] border border-[var(--color-border-subtle)]">
          <MediaCarousel
            slides={coverCarouselSlides}
            propertyId={step.propertyId}
            title={step.title}
            variant="active"
            uploadEntityType="access_method"
            uploadUsageKey={coverUsageKey}
            onLightboxOpen={handleCoverLightboxOpen}
            lightboxButtonAlwaysVisible
          />
        </div>
      )}

      <ul className="m-0 flex flex-wrap gap-2 p-0">
        {step.methods.map((method) => {
          const MethodIcon = method.icon;
          return (
            <li
              key={method.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                "border text-[12.5px]",
                method.isPrimary
                  ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary-subtle-fg)]"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-background-subtle)] text-[var(--color-text-secondary)]",
              )}
            >
              <MethodIcon size={13} strokeWidth={1.75} aria-hidden="true" />
              <span className="font-medium">{method.label}</span>
              {method.isPrimary && (
                <Star
                  size={12}
                  strokeWidth={0}
                  fill="currentColor"
                  aria-hidden="true"
                  className="text-[var(--color-status-warning-solid)]"
                />
              )}
            </li>
          );
        })}
      </ul>

      {hasDynamicCode && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg px-2.5 py-2",
            "bg-[var(--color-status-info-bg)] text-[12px]",
            "text-[var(--color-status-info-text)]",
          )}
        >
          <Clock
            size={14}
            aria-hidden="true"
            strokeWidth={2}
            className="mt-px flex-none text-[var(--color-status-info-icon)]"
          />
          <span className="leading-[1.45]">
            <strong className="font-semibold">El código se genera por estancia</strong>
            {" — "}
            se envía al huésped antes del check-in vía WhatsApp/email. No escribas códigos en tus notas.
          </span>
        </div>
      )}

      {methodSlides.length > 0 && (
        <PhotoStrip
          label={
            step.key === "building" ? "Pistas visuales por método" : "Detalle de la puerta"
          }
          photos={methodSlides.map((s) => {
            const methodId = methodIdFromUsageKey(s.usageKey) ?? "";
            return {
              url: s.url,
              alt: s.alt,
              methodLabel: methodLabelById[methodId],
            };
          })}
          onPhotoClick={handleMethodPhotoClick}
        />
      )}

      {lightboxIdx !== null && (
        <MediaLightbox
          slides={lightboxSlides}
          index={lightboxIdx}
          onIndexChange={setLightboxIdx}
          onClose={handleLightboxClose}
          lightboxSidePanel={
            <MethodListSidePanel
              title={
                step.key === "building"
                  ? "Métodos para entrar al edificio"
                  : "Métodos para entrar a la vivienda"
              }
              methods={step.methods}
            />
          }
        />
      )}
    </div>
  );
}

function MethodListSidePanel({
  title,
  methods,
}: {
  title: string;
  methods: readonly ArrivalMethodSummary[];
}) {
  return (
    <div className="px-4 pt-4">
      <p className="m-0 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
        {title}
      </p>
      <ul className="m-0 flex flex-col gap-1.5 p-0">
        {methods.map((method) => {
          const MethodIcon = method.icon;
          return (
            <li
              key={method.id}
              className={cn(
                "flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px]",
                method.isPrimary
                  ? "bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary-subtle-fg)]"
                  : "bg-[var(--color-background-subtle)] text-[var(--color-text-primary)]",
              )}
            >
              <MethodIcon
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className="flex-none"
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {method.label}
              </span>
              {method.isPrimary && (
                <Star
                  size={12}
                  strokeWidth={0}
                  fill="currentColor"
                  aria-hidden="true"
                  className="flex-none text-[var(--color-status-warning-solid)]"
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PhotoStrip({
  label,
  photos,
  onPhotoClick,
}: {
  label: string;
  photos: Array<{ url: string; alt?: string; methodLabel?: string }>;
  onPhotoClick: (idx: number) => void;
}) {
  return (
    <div>
      <p className="m-0 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
        {photos.map((photo, i) => (
          <button
            key={`${photo.url}-${i}`}
            type="button"
            onClick={() => onPhotoClick(i)}
            aria-label={`Ver ${photo.methodLabel ?? photo.alt ?? "foto"} a tamaño completo`}
            className={cn(
              "group/photo relative aspect-[4/3] min-h-[44px] overflow-hidden rounded-[10px]",
              "border border-[var(--color-border-subtle)] bg-[var(--color-background-subtle)]",
              "transition-[border-color,transform] duration-150",
              "hover:border-[var(--color-action-primary)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.alt ?? ""}
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-cover transition-transform duration-200 group-hover/photo:scale-[1.03]"
            />
            {photo.methodLabel && (
              <span
                className={cn(
                  "absolute bottom-1 left-1 inline-flex max-w-[calc(100%-8px)] truncate rounded-full px-2 py-[2px]",
                  "bg-[var(--color-background-scrim)] text-[var(--color-text-on-accent)]",
                  "text-[10px] font-medium",
                )}
              >
                {photo.methodLabel}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Shared primitives (empty state, lazy map) ───────────────────────────

function EmptyState({
  title,
  description,
  cockpitId,
  cockpitLabel,
}: {
  title: string;
  description: string;
  cockpitId?: "building" | "unit" | "parking" | "accessibility";
  cockpitLabel: string;
}) {
  const scrollTo = (e: React.MouseEvent) => {
    if (!cockpitId) return;
    e.preventDefault();
    const target = document.getElementById(`access-cockpit-${cockpitId}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div
      className={cn(
        "rounded-[12px] border border-dashed px-4 py-5 text-center",
        "border-[var(--color-border-default)] bg-[var(--color-background-subtle)]",
      )}
    >
      <p className="m-0 text-[13.5px] font-semibold text-[var(--color-text-primary)]">
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-[44ch] text-[12.5px] leading-[1.55] text-[var(--color-text-secondary)]">
        {description}
      </p>
      {cockpitId && (
        <a
          href={`#access-cockpit-${cockpitId}`}
          onClick={scrollTo}
          className={cn(
            "mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] px-3 py-2",
            "border border-[var(--color-border-default)] bg-[var(--color-background-elevated)]",
            "text-[12.5px] font-medium text-[var(--color-text-link)]",
            "hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
          )}
        >
          {cockpitLabel}
        </a>
      )}
    </div>
  );
}

// ── Helpers exposed to the form ─────────────────────────────────────────

export const ARRIVAL_STEP_ICONS = {
  arrival: Navigation,
  building: Building2,
  unit: KeyRound,
} as const;

// Re-exports used by the page-level data builder.
export { feeTypeToPinKind };
