"use client";

import { CircleCheck, CircleDashed, Loader2, Plus, Star, Upload, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { deleteMediaAction } from "@/lib/actions/media.actions";
import {
  EntityMediaCard,
  EntityCardStatusPill,
  type EntityCardRole,
} from "@/components/ui/entity-media-card";
import { HoverCard } from "@/components/ui/hover-card";
import {
  MediaCarousel,
  type MediaCarouselSlide,
} from "@/components/ui/media-carousel";
import type { SubsystemSlide } from "./subsystem-card.types";
import { methodIdFromUsageKey } from "./arrival-steps-helpers";
import type { ParkingPlace, PropertyCoords } from "../access-form";
import type { ParkingSuggestion } from "@/lib/services/parking-discovery.service";
import { DEFAULT_DISCOVERY_RADIUS_M } from "@/lib/services/arrival-discovery.service";
import type { AccessCockpitId } from "@/lib/icons/access-icons";

const PARKING_COCKPIT_ID: AccessCockpitId = "parking";
// `building` is the first card in the cockpit 1×4 row and owns the LCP image
// in the access surface — its collapsed carousel is the only one allowed to
// opt into `eagerFirstSlide`. All other cards stay lazy so the row doesn't
// fire N eager fetches on mount (see <MediaCarousel> prop docstring).
const BUILDING_COCKPIT_ID: AccessCockpitId = "building";
import { MultiPinMap, feeTypeToPinKind, type MultiPinSpec } from "./multi-pin-map";
import { MediaLightbox } from "./media-lightbox";
import { ParkingStateProvider } from "./use-parking-management";
import { useMediaUpload } from "@/hooks/use-media-upload";

// Provides `openLightboxForUsageKey` to any descendant (MethodRow,
// CoverUploadIconButton) so they can open the lightbox at the first slide
// matching their usageKey. null = not inside a SubsystemCard (context absent).
const SubsystemLightboxContext = createContext<((usageKey: string) => void) | null>(null);
export function useSubsystemLightbox() {
  return useContext(SubsystemLightboxContext);
}

// Explicit opt-outs (`ba.no_building` / `pk.no_parking` chips) make every
// card deterministically configured-or-pending.
export type SubsystemStatus = "configured" | "pending";

// Stable empty-array refs — `slides ?? []` would synthesize a fresh array
// every render and invalidate downstream memos in MediaLightbox.
const EMPTY_SLIDES: readonly SubsystemSlide[] = [];
const EMPTY_PARKING_PLACES: ParkingPlace[] = [];
const EMPTY_PARKING_SUGGESTIONS: ParkingSuggestion[] = [];

// Conditional ParkingStateProvider wrapper — only the parking cockpit mounts
// the provider, so non-parking cards never run `useParkingManagement`. Inside
// the provider the hook runs ONCE for the whole card subtree, so the inline
// `ParkingPlacesEditor` (rendered in `children`) and the `MediaLightbox`
// (mounted next to the carousel) share the same state instance — operator
// edits in either surface show up immediately in the other.
function MaybeParkingProvider({
  enabled,
  propertyId,
  places,
  propertyCoords,
  initialSuggestions,
  radiusMeters,
  children,
}: {
  enabled: boolean;
  propertyId: string;
  places: ParkingPlace[];
  propertyCoords: PropertyCoords | null;
  initialSuggestions: ParkingSuggestion[];
  radiusMeters: number;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <ParkingStateProvider
      propertyId={propertyId}
      places={places}
      propertyCoords={propertyCoords}
      initialSuggestions={initialSuggestions}
      radiusMeters={radiusMeters}
    >
      {children}
    </ParkingStateProvider>
  );
}

export interface SubsystemSelectedItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface SubsystemCardProps {
  role: EntityCardRole;
  cockpitId: AccessCockpitId;
  propertyId: string;
  icon: LucideIcon;
  title: string;
  selectedItems: readonly SubsystemSelectedItem[];
  primaryId: string | null;
  photoCount: number;
  videoCount?: number;
  status: SubsystemStatus;
  slides?: readonly SubsystemSlide[];
  parkingSuggestions?: ParkingSuggestion[];
  parkingPlaces?: ParkingPlace[];
  propertyCoords?: PropertyCoords | null;
  /** Discovery radius (meters) for parking suggestion fetching. Defaults
   * applied at the leaf hook; only the parking cockpit consumes this. */
  parkingRadiusMeters?: number;
  onExpand: () => void;
  onCollapse: () => void;
  expandedSubtitle?: string;
  /** Optional slot for the lightbox live-map slide area. When passed, the
   * MediaLightbox renders this node inside the slide region (replacing the
   * inline parking-only map). Used today by the parking subsystem to show
   * the unified arrival map at lightbox scale. */
  lightboxMap?: ReactNode;
  /** Optional slot for the lightbox right-side panel, rendered BELOW the
   * thumbnail strip (in the same scroll container). Used today by the
   * parking subsystem to host the Vehículo/Tren/Autobús/Avión tabs + the
   * per-mode Añadidos/Sugeridos lists alongside the thumbnails. */
  lightboxSidePanel?: ReactNode;
  children: ReactNode;
}

// Visible-cap policy: at most 5 chips total (tiles + the optional +N chip).
//  N <= 5 → render all N tiles, no +N chip ("+1" never appears, and the rare
//           5-tile case shows the full set instead of "4 tiles + +1").
//  N >= 6 → render 4 tiles + a "+N-4" chip = 5 chips total.
// This is purely a function of `ordered.length`, NOT of measured width — that
// avoids the inconsistency we used to see when the collapsed `<button>`
// remounted after expand/collapse: useMeasure restarted at width=0 and the
// fallback would change the visible count between renders. With the new
// policy the count is stable across mounts.
const STRIP_VISIBLE_MAX = 5;
function resolveVisibleCap(totalCount: number): number {
  return totalCount <= STRIP_VISIBLE_MAX ? totalCount : 4;
}

// Per-subsystem identity gradient — terra (building) / olive (unit) /
// info (parking) / warning (accessibility). Tokens live in semantic.css
// and resolve per theme. Listed statically so the token-coverage gate
// sees each token literal — template-literal interpolation hid the
// suffix from its regex.
const SUBSYSTEM_GRADIENTS: Record<string, string> = {
  building:
    "linear-gradient(135deg, var(--color-subsystem-building-from), var(--color-subsystem-building-to))",
  unit:
    "linear-gradient(135deg, var(--color-subsystem-unit-from), var(--color-subsystem-unit-to))",
  parking:
    "linear-gradient(135deg, var(--color-subsystem-parking-from), var(--color-subsystem-parking-to))",
  accessibility:
    "linear-gradient(135deg, var(--color-subsystem-accessibility-from), var(--color-subsystem-accessibility-to))",
};

// Map domain `SubsystemSlide` (which carries access-feature kinds incl.
// `live-map`) to the feature-agnostic `MediaCarouselSlide` consumed by the
// shared primitive. live-map slides become `kind: "custom"` and inject the
// MultiPinMap via the render fn — keeps the carousel decoupled from
// access-specific UI so it can be reused (next adopter: spaces).
function toCarouselSlides(
  slides: readonly SubsystemSlide[],
): MediaCarouselSlide[] {
  return slides
    .map((s): MediaCarouselSlide | null => {
      if (s.kind === "live-map") {
        if (!s.liveAnchor) return null;
        const pins: MultiPinSpec[] = (s.livePins ?? []).map((p) => ({
          id: p.id,
          latitude: p.latitude,
          longitude: p.longitude,
          kind: feeTypeToPinKind(p.feeType),
          label: p.label,
        }));
        const anchor = s.liveAnchor;
        return {
          id: s.id,
          title: s.title,
          kind: "custom",
          render: (height: number) => (
            // pointer-events-none: display-only; swipe + tap-to-expand reach
            // the carousel's own handlers. Expanded editor uses
            // ParkingPlacesEditor with its own interactive map.
            <div className="pointer-events-none absolute inset-0">
              <MultiPinMap anchor={anchor} pins={pins} height={height} interactive={false} />
            </div>
          ),
        };
      }
      if (s.kind === "image" || s.kind === "map") {
        return {
          id: s.id,
          title: s.title,
          kind: s.kind,
          url: s.url,
          alt: s.alt || s.title,
        };
      }
      if (s.kind === "video") {
        return {
          id: s.id,
          title: s.title,
          kind: "video",
          alt: s.alt || s.title,
        };
      }
      return null;
    })
    .filter((s): s is MediaCarouselSlide => s !== null);
}

// ── Cover upload icon button ─────────────────────────────────────────────
// Compact camera-icon trigger for the subsystem cover slot (usageKey =
// "access.<cockpitId>"). Same upload pipeline as MediaCarousel — request →
// PUT to R2 → confirm → assign → refresh. Used in both the active card
// header and the collapsed card hover overlay.
function CoverUploadIconButton({
  propertyId,
  uploadUsageKey,
  coverCount = 0,
  firstUrl,
  secondUrl,
  className,
  style,
}: {
  propertyId: string;
  uploadUsageKey: string;
  coverCount?: number;
  firstUrl?: string;
  secondUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const openLightbox = useSubsystemLightbox();
  const uploadConfig = useMemo(
    () => ({
      propertyId,
      entityType: "access_method" as const,
      usageKey: uploadUsageKey,
    }),
    [propertyId, uploadUsageKey],
  );
  const {
    fileInputRef,
    uploading,
    error: uploadError,
    triggerFilePicker,
    onFileChange: handleFileChange,
  } = useMediaUpload(uploadConfig);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (uploading) return;
      if (coverCount > 0 && openLightbox) {
        openLightbox(uploadUsageKey);
        return;
      }
      triggerFilePicker();
    },
    [uploading, coverCount, openLightbox, uploadUsageKey, triggerFilePicker],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.avif,.gif"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        aria-label={
          uploading
            ? "Subiendo foto de portada…"
            : uploadError
              ? "Error al subir portada"
              : "Añadir foto de portada"
        }
        onClick={handleClick}
        disabled={uploading}
        style={style}
        className={cn(
          "relative grid h-9 w-9 flex-none place-items-center rounded-full",
          "bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]",
          "hover:bg-[var(--color-background-subtle)] hover:text-[var(--color-action-primary)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-elevated)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "before:absolute before:-inset-[4px] before:content-['']",
          "[@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px]",
          className,
        )}
      >
        {uploading ? (
          <Loader2 size={16} aria-hidden="true" className="animate-spin" />
        ) : coverCount > 0 && firstUrl ? (
          /* Stacked thumbnail — same pattern as MethodRow */
          <span className="relative h-8 w-8">
            {coverCount > 1 && (
              <span
                aria-hidden="true"
                className="absolute inset-0 z-0 origin-bottom-left overflow-hidden rounded-[7px] ring-1 ring-[var(--color-action-primary)] [transform:rotate(-15deg)]"
              >
                {secondUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={secondUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />
                ) : (
                  <span className="absolute inset-0 bg-[var(--color-action-primary-subtle)]" />
                )}
              </span>
            )}
            <span
              className={cn(
                "absolute inset-0 z-10 overflow-hidden rounded-[8px] ring-2 ring-[var(--color-action-primary)] ring-offset-1 ring-offset-[var(--color-action-primary-subtle)]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={firstUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />
              <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-[var(--color-background-overlay)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <Upload size={14} aria-hidden="true" />
              </span>
            </span>
            {coverCount > 1 && (
              <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 z-20 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-[var(--color-action-primary)] px-1 text-[10px] font-bold leading-none text-[var(--color-action-primary-fg)] ring-2 ring-[var(--color-background-elevated)]">
                {coverCount > 9 ? "9+" : coverCount}
              </span>
            )}
          </span>
        ) : (
          <Upload size={16} aria-hidden="true" />
        )}
      </button>
    </>
  );
}

export function SubsystemCard({
  role,
  cockpitId,
  propertyId,
  icon: Icon,
  title,
  selectedItems,
  primaryId,
  photoCount,
  videoCount = 0,
  status,
  slides,
  parkingSuggestions,
  parkingPlaces,
  propertyCoords,
  parkingRadiusMeters,
  onExpand,
  onCollapse,
  expandedSubtitle,
  lightboxMap,
  lightboxSidePanel,
  children,
}: SubsystemCardProps) {
  const titleId = useId();
  const bodyId = useId();

  // Order: primary first, then the rest in given order. Visible cap then
  // overflow into the "+N" reveal.
  const { ordered, visible, hidden } = useMemo(() => {
    let ord: readonly SubsystemSelectedItem[];
    if (!primaryId) {
      ord = selectedItems;
    } else {
      const p = selectedItems.find((it) => it.id === primaryId);
      ord = p ? [p, ...selectedItems.filter((it) => it.id !== primaryId)] : selectedItems;
    }
    const cap = resolveVisibleCap(ord.length);
    return { ordered: ord, visible: ord.slice(0, cap), hidden: ord.slice(cap) };
  }, [selectedItems, primaryId]);

  const uploadUsageKey = `access.${cockpitId}`;
  // Method-scoped slides (usageKey `access.<cockpit>.<methodId>`) only surface
  // when the method is still selected — operators who deselect a method
  // shouldn't see its lingering photos. Cover slides (exact `uploadUsageKey`)
  // and the synthetic live-map slide are always kept.
  const validMethodIds = useMemo(
    () => new Set(selectedItems.map((s) => s.id)),
    [selectedItems],
  );
  const stableSlides = useMemo(() => {
    const all = slides ?? EMPTY_SLIDES;
    return all.filter((s) => {
      if (s.kind === "live-map") return true;
      if (s.usageKey === uploadUsageKey) return true;
      if (!s.usageKey.startsWith(`${uploadUsageKey}.`)) return true;
      const methodId = methodIdFromUsageKey(s.usageKey);
      return methodId !== null && validMethodIds.has(methodId);
    });
  }, [slides, uploadUsageKey, validMethodIds]);
  // Collapsed cover carousel includes the live-map slide so parking's hero
  // shows the embedded map by default (same expand affordance as other
  // cards). The expanded variant hides the whole carousel for parking — its
  // body renders `<ArrivalCockpitMap />` directly — so live-map presence is
  // irrelevant there. `live-map` is appended last in KIND_ORDER (page.tsx),
  // so the controlled `carouselIdx` stays valid across the collapsed/active
  // flip without translation.
  const carouselSlides = useMemo(
    () => toCarouselSlides(stableSlides),
    [stableSlides],
  );
  const placeholderGradient =
    SUBSYSTEM_GRADIENTS[cockpitId] ?? SUBSYSTEM_GRADIENTS.building;

  // Cover slides — exact usageKey match (not nested method slides).
  const coverSlides = useMemo(
    () => stableSlides.filter(
      (s) => s.usageKey === uploadUsageKey && (s.kind === "image" || s.kind === "map"),
    ),
    [stableSlides, uploadUsageKey],
  );
  const coverCount = coverSlides.length;
  const coverFirstUrl = coverSlides[0]?.url;
  const coverSecondUrl = coverSlides[1]?.url;

  // Active slide index — owned here so it survives the `role` flip (the
  // collapsed and active branches render two MediaCarousel instances; the
  // user expects the slide they were viewing to stay put). Clamp when the
  // slides set shrinks so we never point past the last slide.
  const [carouselIdx, setCarouselIdx] = useState(0);
  const visibleSlideCount = carouselSlides.length;
  useEffect(() => {
    const max = Math.max(0, visibleSlideCount - 1);
    setCarouselIdx((prev) => Math.min(prev, max));
  }, [visibleSlideCount]);

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const handleLightboxOpen = (idx: number) => setLightboxIdx(idx);
  const handleLightboxClose = () => setLightboxIdx(null);
  const handleLightboxIndexChange = (idx: number) => {
    setLightboxIdx(idx);
    setCarouselIdx(idx);
  };
  const router = useRouter();
  const handleSlideDelete = useCallback(
    async (assetId: string) => {
      await deleteMediaAction(assetId);
      router.refresh();
    },
    [router],
  );

  const openLightboxForUsageKey = useCallback(
    (usageKey: string) => {
      const idx = stableSlides.findIndex((s) => s.usageKey === usageKey);
      if (idx >= 0) setLightboxIdx(idx);
    },
    [stableSlides],
  );

  // Memoize so MediaLightbox's useMediaUpload hook (deps on config identity)
  // doesn't rebuild its callbacks every render — that would defeat any
  // downstream React.memo and re-arm child effects.
  const lightboxUploadConfig = useMemo(
    () => ({
      propertyId,
      entityType: "access_method" as const,
      usageKey: uploadUsageKey,
    }),
    [propertyId, uploadUsageKey],
  );

  // Tile renderer — invoked from the HoverCard trigger for every selected
  // item. The primary tile carries a 14×14 corner star with a 2px outline
  // against the elevated bg so the marker stays legible over the tile's
  // olive border.
  const renderTile = (item: SubsystemSelectedItem, isPrimary: boolean) => {
    const ItemIcon = item.icon;
    return (
      <span
        role="img"
        aria-label={item.label}
        className={cn(
          "relative grid h-8 w-8 flex-none place-items-center rounded-[8px] border",
          isPrimary
            ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary)]"
            : "border-[var(--color-border-default)] bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]",
        )}
      >
        <ItemIcon size={14} aria-hidden="true" />
        {isPrimary && (
          <span
            aria-hidden="true"
            className="absolute -right-[4px] -top-[4px] grid h-[14px] w-[14px] place-items-center rounded-full bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] outline outline-2 outline-[var(--color-background-elevated)]"
          >
            {/* Even-on-even pixel grid: badge 14 × star 10 = 2px margin each
               side, integer positioning. place-items-center centers cleanly
               without sub-pixel rounding inconsistencies. No CSS transform on
               the star — children stay solidary with the badge during any
               parent state change. */}
            <Star
              size={10}
              fill="currentColor"
              strokeWidth={0}
              aria-hidden="true"
            />
          </span>
        )}
      </span>
    );
  };

  const isParkingCockpit = cockpitId === PARKING_COCKPIT_ID;

  // ── Cover carousel (media slot) ──
  // Shown on every collapsed card; on expand the parking cockpit hides it
  // (its hero is the embedded map rendered in the body via `children`).
  const showCarousel = role === "active" ? !isParkingCockpit : true;
  const media = showCarousel ? (
    <MediaCarousel
      slides={carouselSlides}
      propertyId={propertyId}
      title={title}
      variant={role === "active" ? "active" : "collapsed"}
      uploadEntityType="access_method"
      uploadUsageKey={uploadUsageKey}
      placeholderGradient={placeholderGradient}
      currentIdx={carouselIdx}
      onCurrentIdxChange={setCarouselIdx}
      onLightboxOpen={handleLightboxOpen}
      {...(role === "active"
        ? {}
        : { bodyId, onExpand, eagerFirstSlide: cockpitId === BUILDING_COCKPIT_ID })}
    />
  ) : null;

  // ── Lightbox (overlay slot) — same in both roles ──
  const overlay =
    lightboxIdx !== null ? (
      <MediaLightbox
        slides={stableSlides}
        index={lightboxIdx}
        onIndexChange={handleLightboxIndexChange}
        onClose={handleLightboxClose}
        onSlideDelete={handleSlideDelete}
        uploadConfig={lightboxUploadConfig}
        lightboxMap={lightboxMap}
        lightboxSidePanel={lightboxSidePanel}
      />
    ) : null;

  // ── Cover-upload affordance ──
  // Active header sibling (`mr-4`) / collapsed hover overlay (absolute).
  // Parking opts out (no cover photos — the embedded map is the hero).
  const coverUpload = !isParkingCockpit ? (
    <CoverUploadIconButton
      propertyId={propertyId}
      uploadUsageKey={uploadUsageKey}
      coverCount={coverCount}
      firstUrl={coverFirstUrl}
      secondUrl={coverSecondUrl}
      className={
        role === "active"
          ? "mr-4 flex-none"
          : "absolute bottom-3 right-3 z-[20] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      }
    />
  ) : null;

  // ── Collapsed body content (collapsedContent slot) ──
  // The selected-feature tile strip (HoverCard overflow) or the empty hint.
  // EntityMediaCard provides the bottom-aligned wrapper; we pass only the
  // inner content.
  const collapsedContent =
    ordered.length === 0 ? (
      <span className="inline-flex max-w-full items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
        <Plus size={14} aria-hidden="true" className="flex-none" />
        <span className="truncate">Añade características</span>
      </span>
    ) : (
      <HoverCard
        contentClassName="max-w-[360px]"
        trigger={
          <span className="flex flex-nowrap items-center gap-2 overflow-visible">
            {visible.map((item) => (
              <span key={item.id}>{renderTile(item, item.id === primaryId)}</span>
            ))}
            {hidden.length > 0 && (
              <span
                role="img"
                aria-label={`${hidden.length} más`}
                className="grid h-8 min-w-[32px] flex-none place-items-center rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] px-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)]"
              >
                +{hidden.length}
              </span>
            )}
          </span>
        }
        content={
          <ul className="flex flex-col">
            {ordered.map((it) => {
              const isP = it.id === primaryId;
              const ItemIcon = it.icon;
              return (
                <li
                  key={it.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px]",
                    isP && "bg-[var(--color-action-primary-subtle)]",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-[22px] w-[22px] flex-none place-items-center rounded-[6px]",
                      isP
                        ? "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)]"
                        : "bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]",
                    )}
                  >
                    <ItemIcon size={12} aria-hidden="true" />
                  </span>
                  <span
                    title={it.label}
                    className={cn(
                      "min-w-0 flex-1 line-clamp-2",
                      isP
                        ? "font-semibold text-[var(--color-action-primary)]"
                        : "text-[var(--color-text-primary)]",
                    )}
                  >
                    {it.label}
                  </span>
                  {isP && (
                    <Star
                      size={11}
                      fill="currentColor"
                      strokeWidth={0}
                      aria-hidden="true"
                      className="flex-none text-[var(--color-action-primary)]"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        }
      />
    );

  return (
    <SubsystemLightboxContext.Provider value={openLightboxForUsageKey}>
      <MaybeParkingProvider
        enabled={isParkingCockpit}
        propertyId={propertyId}
        places={parkingPlaces ?? EMPTY_PARKING_PLACES}
        propertyCoords={propertyCoords ?? null}
        initialSuggestions={parkingSuggestions ?? EMPTY_PARKING_SUGGESTIONS}
        radiusMeters={parkingRadiusMeters ?? DEFAULT_DISCOVERY_RADIUS_M}
      >
        <EntityMediaCard
          role={role}
          viewTransitionName={`cockpit-card-${cockpitId}`}
          domId={`access-cockpit-${cockpitId}`}
          titleId={titleId}
          bodyId={bodyId}
          icon={Icon}
          title={title}
          subtitle={expandedSubtitle}
          status={
            <EntityCardStatusPill
              tone={status === "configured" ? "success" : "warning"}
              icon={status === "configured" ? CircleCheck : CircleDashed}
              label={status === "configured" ? "Configurado" : "Pendiente"}
            />
          }
          media={media}
          overlay={overlay}
          collapsedContent={collapsedContent}
          srOnly={
            <>
              <Upload size={12} aria-hidden="true" />
              {photoCount} {photoCount === 1 ? "foto" : "fotos"},{" "}
              <Video size={12} aria-hidden="true" />
              {videoCount} {videoCount === 1 ? "vídeo" : "vídeos"}
            </>
          }
          hoverOverlay={role === "active" ? undefined : coverUpload}
          headerAction={role === "active" ? coverUpload : undefined}
          onExpand={onExpand}
          onCollapse={onCollapse}
        >
          {children}
        </EntityMediaCard>
      </MaybeParkingProvider>
    </SubsystemLightboxContext.Provider>
  );
}
