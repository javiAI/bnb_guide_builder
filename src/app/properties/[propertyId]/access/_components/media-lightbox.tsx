"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import Lightbox, {
  useController,
  useNavigationState,
  type Slide,
} from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Banner } from "@/components/ui/banner";
import { Tooltip } from "@/components/ui/tooltip";
import type { SubsystemSlide } from "./subsystem-card.types";
import { MultiPinMap, feeTypeToPinKind, type MultiPinSpec } from "./multi-pin-map";
import { ConfirmedRow, SuggestionRow, cycleFee } from "./parking-row";
import {
  CockpitEmptyState,
  CockpitListColumn,
} from "./cockpit-list-column";
import { ParkingMapOverlay } from "./parking-map-overlay";
import { RefreshIconButton } from "./refresh-icon-button";
import { pinIdForPlace, pinIdForSuggestion } from "./pin-ids";
import {
  useParkingStateContext,
  type BinaryFee,
  type UseParkingManagementReturn,
} from "./use-parking-management";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { useLightboxMapHeight } from "@/hooks/use-lightbox-map-height";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import type { MediaEntityType } from "@/lib/schemas/editor.schema";
import { cn } from "@/lib/cn";

const ACCEPTED_PHOTO_TYPES = ".jpg,.jpeg,.png,.webp,.avif,.gif";

/** Default desktop panel width — wide enough for ConfirmedRow / SuggestionRow
 * (icon · name · distance · trash) without clipping. Operators can drag the
 * left edge to resize; the value persists per-device via localStorage. */
const DEFAULT_PANEL_W = 360;
const MIN_PANEL_W = 280;
const MAX_PANEL_W = 480;
const PANEL_W_STORAGE_KEY = "liora.access.lightbox.panelW";

function clampPanelWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PANEL_W;
  return Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, Math.round(value)));
}

function readStoredPanelWidth(): number {
  if (typeof window === "undefined") return DEFAULT_PANEL_W;
  try {
    const raw = window.localStorage.getItem(PANEL_W_STORAGE_KEY);
    if (raw === null) return DEFAULT_PANEL_W;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? clampPanelWidth(parsed) : DEFAULT_PANEL_W;
  } catch {
    return DEFAULT_PANEL_W;
  }
}

type LiveMapSlide = {
  type: "live-map";
  id: string;
  title: string;
  alt: string;
  anchor: { latitude: number; longitude: number };
  pins: MultiPinSpec[];
};

type VideoUrlSlide = {
  type: "video-url";
  id: string;
  title: string;
  alt: string;
  src: string;
};

type LightboxSlide = Slide | LiveMapSlide | VideoUrlSlide;

interface Props {
  slides: readonly SubsystemSlide[];
  index: number | null;
  /** Omit for single-slide read-only mounts (e.g. arrival-step paso 01 live-map
   * lightbox). When omitted, slide navigation handlers are no-ops. */
  onIndexChange?: (idx: number) => void;
  onClose: () => void;
  onSlideDelete?: (assetId: string) => Promise<void>;
  uploadConfig?: { propertyId: string; entityType: MediaEntityType; entityId?: string; usageKey: string };
  /** Optional slot for the live-map slide area. When provided alongside a
   * `live-map` slide, the slide renders this node (typically the unified
   * arrival-cockpit map) instead of the inline parking-only map. The side
   * panel switches to a thumbnail-only strip, optionally followed by
   * `lightboxSidePanel` below. */
  lightboxMap?: ReactNode;
  /** Optional slot for the right-side panel, rendered BELOW the thumbnail
   * strip in the same scroll container. Used today by the arrival cockpit
   * to host the Vehículo/Tren/Autobús/Avión tabs + lists alongside the
   * thumbnails. */
  lightboxSidePanel?: ReactNode;
}

const noop = () => {};

/** Live-map slide area wrapper. stopPropagation handlers prevent YARL from
 * swiping the carousel when the user drags the map or interacts with controls
 * inside. CSS sizing mirrors `useLightboxMapHeight` (`min(82vh, 900px)`). */
function LiveMapSlideShell({
  children,
  elevatedBg = false,
}: {
  children: ReactNode;
  elevatedBg?: boolean;
}) {
  const stop = (e: SyntheticEvent) => e.stopPropagation();
  return (
    <div
      style={{ width: "min(95vw, 1400px)", height: "min(82vh, 900px)" }}
      className={cn(
        "relative overflow-hidden rounded-[12px]",
        elevatedBg && "bg-[var(--color-background-elevated)]",
      )}
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
      onMouseDown={stop}
      onMouseMove={stop}
      onMouseUp={stop}
    >
      {children}
    </div>
  );
}

export function MediaLightbox({
  slides,
  index,
  onIndexChange = noop,
  onClose,
  onSlideDelete,
  uploadConfig,
  lightboxMap,
  lightboxSidePanel,
}: Props) {
  const isDesktop = useIsDesktop();

  // Pixel height for the fallback live-map slide (when no custom `lightboxMap`
  // node is supplied). Mirrors the CSS `min(82vh, 900px)` slide-area sizing.
  const fallbackMapHeight = useLightboxMapHeight();

  const [confirmingSlideId, setConfirmingSlideId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const handleDeleteRequest = useCallback((slideId: string) => {
    setConfirmingSlideId(slideId);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setConfirmingSlideId(null);
  }, []);

  const handleDeleteConfirm = useCallback(
    async (assetId: string) => {
      if (!onSlideDelete) return;
      setDeletingAssetId(assetId);
      setConfirmingSlideId(null);
      try {
        await onSlideDelete(assetId);
      } finally {
        setDeletingAssetId(null);
      }
    },
    [onSlideDelete],
  );

  const {
    fileInputRef: uploadFileInputRef,
    uploading,
    error: uploadError,
    triggerFilePicker: handleUploadClick,
    onFileChange: handleFileChange,
  } = useMediaUpload(uploadConfig);

  // Parking state — supplied by ParkingStateProvider in SubsystemCard for
  // the parking cockpit only. Non-parking cards never wrap in the provider,
  // so `parkingState` is null and the live-map branches below stay dormant.
  const parkingState = useParkingStateContext();

  const lightboxSlides = useMemo<LightboxSlide[]>(() => {
    return slides
      .map((s): LightboxSlide | null => {
        if (s.kind === "image" || s.kind === "map") {
          return { type: "image", src: s.url, alt: s.alt || s.title };
        }
        if (s.kind === "video") {
          return { type: "video-url", id: s.id, title: s.title, alt: s.alt || s.title, src: s.url };
        }
        if (s.kind === "live-map") {
          if (!s.liveAnchor) return null;
          const pins: MultiPinSpec[] = (s.livePins ?? []).map((p) => ({
            id: p.id,
            latitude: p.latitude,
            longitude: p.longitude,
            kind: feeTypeToPinKind(p.feeType),
            label: p.label,
          }));
          return { type: "live-map", id: s.id, title: s.title, alt: s.alt || s.title, anchor: s.liveAnchor, pins };
        }
        return null;
      })
      .filter((s): s is LightboxSlide => s !== null);
  }, [slides]);

  const activeSlideIdx = index !== null ? Math.min(index, lightboxSlides.length - 1) : 0;
  const activeSubsystemSlide = index !== null ? slides[activeSlideIdx] : null;
  const isLiveMap = activeSubsystemSlide?.kind === "live-map";

  const mediaCount = useMemo(
    () => slides.filter((s) => s.kind !== "live-map").length,
    [slides],
  );

  // Resizable panel width — desktop only. SSR-safe initial = DEFAULT_PANEL_W;
  // the effect rehydrates from localStorage on mount to keep server/client HTML
  // identical and avoid a hydration mismatch.
  const [panelW, setPanelW] = useState<number>(DEFAULT_PANEL_W);
  useEffect(() => {
    setPanelW(readStoredPanelWidth());
  }, []);

  const [resizing, setResizing] = useState(false);
  const resizingRef = useRef(false);
  resizingRef.current = resizing;

  // Owns mid-drag listeners + RAF so unmount mid-drag doesn't leak window
  // listeners or leave a pending frame pointing at a stale setState. Each
  // drag swaps the previous AbortController for a fresh one; component
  // unmount aborts whichever is current.
  const dragControllerRef = useRef<AbortController | null>(null);
  const dragRafRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      dragControllerRef.current?.abort();
      if (dragRafRef.current !== null) cancelAnimationFrame(dragRafRef.current);
    },
    [],
  );

  const handleResizeStart = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setResizing(true);

    dragControllerRef.current?.abort();
    const controller = new AbortController();
    dragControllerRef.current = controller;
    const { signal } = controller;

    // RAF-throttle pointermove → at most one setState per frame, even when
    // pointer events fire at 120Hz. Without this, every move re-renders the
    // lightbox + MapLibre's parent layout.
    let pendingX = 0;
    const flush = () => {
      dragRafRef.current = null;
      setPanelW(clampPanelWidth(window.innerWidth - pendingX));
    };
    const onMove = (ev: PointerEvent) => {
      pendingX = ev.clientX;
      if (dragRafRef.current === null) {
        dragRafRef.current = requestAnimationFrame(flush);
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      target.releasePointerCapture?.(ev.pointerId);
      setResizing(false);
      const finalW = clampPanelWidth(window.innerWidth - ev.clientX);
      setPanelW(finalW);
      try {
        window.localStorage.setItem(PANEL_W_STORAGE_KEY, String(finalW));
      } catch {
        // localStorage may be disabled — ignore, in-memory width still works.
      }
      controller.abort();
      if (dragControllerRef.current === controller) {
        dragControllerRef.current = null;
      }
    };
    window.addEventListener("pointermove", onMove, { signal });
    window.addEventListener("pointerup", onUp, { signal });
    window.addEventListener("pointercancel", onUp, { signal });
  }, []);

  // Suppress text selection + body cursor while dragging so the resize feels
  // direct and the operator doesn't accidentally select map labels or panel
  // copy mid-drag.
  useEffect(() => {
    if (!resizing) return;
    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [resizing]);

  if (index === null || lightboxSlides.length === 0) return null;

  return (
    <>
      {uploadConfig && (
        <input
          ref={uploadFileInputRef}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES}
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
      <Lightbox
        open
        close={onClose}
        index={Math.min(index, lightboxSlides.length - 1)}
        slides={lightboxSlides as Slide[]}
        on={{ view: ({ index: i }) => onIndexChange(i) }}
        controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
        animation={{ fade: 200, swipe: 280 }}
        carousel={{ finite: false, padding: 16, spacing: "24px" }}
        labels={{
          Previous: "Anterior",
          Next: "Siguiente",
          Close: "Cerrar",
        }}
        styles={{
          container: {
            backgroundColor: "var(--color-background-scrim)",
            paddingRight: isDesktop ? `${panelW}px` : undefined,
          },
          toolbar: isDesktop ? { right: `${panelW}px` } : undefined,
        }}
        render={{
          // YARL places render-slot returns directly into its toolbar/nav
          // children arrays without injecting keys, so React warns about
          // missing keys unless we provide them ourselves on the root node.
          buttonPrev: () => <NavButton key="prev" variant="prev" />,
          buttonNext: () => (
            <NavButton
              key="next"
              variant="next"
              rightOffsetPx={isDesktop ? panelW : 0}
            />
          ),
          buttonClose: () => <CloseButton key="close" onClose={onClose} />,
          slide: ({ slide }) => {
            const s = slide as LightboxSlide;
            if ("type" in s && s.type === "live-map") {
              // When a custom map slot is supplied, render it inside the
              // slide area (typically the unified arrival-cockpit map). The
              // side panel hosts the tabs + lists below the thumbnail strip
              // — see the `lightboxSidePanel` branch in the controls slot.
              if (lightboxMap !== undefined) {
                return (
                  <LiveMapSlideShell elevatedBg>{lightboxMap}</LiveMapSlideShell>
                );
              }
              return (
                <LiveMapSlideShell>
                  <MultiPinMap
                    anchor={s.anchor}
                    pins={parkingState?.mapPins ?? []}
                    activeId={parkingState?.effectiveActiveId ?? null}
                    onPinClick={parkingState?.setActiveId}
                    onMapClick={parkingState?.handleMapClick}
                    armed={
                      !!parkingState && parkingState.relocatingId !== null
                    }
                    height={fallbackMapHeight}
                    interactive={true}
                  />

                  {parkingState && <ParkingMapOverlay />}
                </LiveMapSlideShell>
              );
            }
            if ("type" in s && s.type === "video-url") {
              return (
                <video
                  src={s.src}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={s.alt}
                  style={{ maxWidth: "min(95vw, 1400px)", maxHeight: "min(82vh, 900px)" }}
                  className="rounded-[12px] bg-black"
                />
              );
            }
            return undefined;
          },
          controls: () => (
            <>
              <aside
                aria-label={isLiveMap && parkingState ? "Gestión de parkings" : "Gestión de media"}
                style={isDesktop ? { width: `${panelW}px` } : undefined}
                className={cn(
                  "absolute right-0 top-0 hidden h-full flex-col overflow-y-auto",
                  "border-l border-[var(--color-border-default)] bg-[var(--color-background-elevated)]",
                  isDesktop && "flex",
                )}
              >
                {isDesktop && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Redimensionar panel"
                    aria-valuemin={MIN_PANEL_W}
                    aria-valuemax={MAX_PANEL_W}
                    aria-valuenow={panelW}
                    onPointerDown={handleResizeStart}
                    className={cn(
                      "absolute left-0 top-0 z-[3] h-full w-1.5 -translate-x-1/2 cursor-col-resize",
                      "transition-colors duration-100",
                      resizing
                        ? "bg-[var(--color-action-primary)]"
                        : "bg-transparent hover:bg-[var(--color-action-primary-subtle)]",
                    )}
                  />
                )}
                {isLiveMap && parkingState && lightboxMap === undefined ? (
                  <ParkingManagementPanel
                    slides={slides}
                    activeSubsystemSlide={activeSubsystemSlide}
                    mediaCount={mediaCount}
                    onSelect={onIndexChange}
                    parkingState={parkingState}
                  />
                ) : isLiveMap && lightboxMap !== undefined ? (
                  <>
                    <ThumbnailListShell
                      title={`Media (${mediaCount})`}
                      slides={slides}
                      activeSubsystemSlide={activeSubsystemSlide}
                      onSelect={onIndexChange}
                    />
                    {lightboxSidePanel && (
                      <div className="border-t border-[var(--color-border-default)] p-3">
                        {lightboxSidePanel}
                      </div>
                    )}
                  </>
                ) : (
                  <MediaManagementPanel
                    slides={slides}
                    activeSubsystemSlide={activeSubsystemSlide}
                    mediaCount={mediaCount}
                    confirmingSlideId={confirmingSlideId}
                    deletingAssetId={deletingAssetId}
                    canDelete={!!onSlideDelete}
                    onSelect={onIndexChange}
                    onDeleteRequest={handleDeleteRequest}
                    onDeleteConfirm={handleDeleteConfirm}
                    onDeleteCancel={handleDeleteCancel}
                    uploadConfig={uploadConfig}
                    uploading={uploading}
                    uploadError={uploadError}
                    onUploadClick={handleUploadClick}
                  />
                )}
              </aside>

              {!isDesktop && slides.length > 0 && (
                <div
                  aria-label="Miniaturas"
                  className="absolute bottom-0 left-0 right-0 flex h-[88px] items-center gap-2 overflow-x-auto border-t border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2"
                >
                  {slides.map((slide, slideIdx) => {
                    const isActive = slide === activeSubsystemSlide;
                    return (
                      <MobileThumbnail
                        key={slide.id}
                        slide={slide}
                        isActive={isActive}
                        onSelect={() => onIndexChange(slideIdx)}
                      />
                    );
                  })}
                  {uploadConfig && (
                    <button
                      type="button"
                      onClick={handleUploadClick}
                      disabled={uploading}
                      aria-label="Añadir foto de portada"
                      className={cn(
                        "relative flex h-16 w-16 flex-none items-center justify-center rounded-[8px]",
                        "border-2 border-dashed border-[var(--color-border-default)]",
                        "text-[var(--color-text-muted)] transition-colors duration-150",
                        "hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)]",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    >
                      {uploading ? (
                        <Loader2 size={18} aria-hidden="true" className="animate-spin" />
                      ) : (
                        <Upload size={18} aria-hidden="true" />
                      )}
                    </button>
                  )}
                </div>
              )}

              {!isDesktop && activeSubsystemSlide && activeSubsystemSlide.kind !== "live-map" && onSlideDelete && (
                <div className="absolute right-14 top-3">
                  {confirmingSlideId === activeSubsystemSlide.id ? (
                    <div className="flex items-center gap-1 rounded-[8px] bg-[var(--color-background-elevated)] px-2 py-1 shadow-[var(--elevation-surface-md)]">
                      <span className="text-[11px] text-[var(--color-text-primary)]">¿Eliminar?</span>
                      <button
                        type="button"
                        onClick={handleDeleteCancel}
                        className="min-h-[44px] rounded px-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteConfirm(activeSubsystemSlide.assetId)}
                        disabled={!!deletingAssetId}
                        className="min-h-[44px] rounded bg-[var(--color-status-error-bg)] px-1.5 text-[11px] font-medium text-[var(--color-status-error-text)] disabled:opacity-50"
                      >
                        {deletingAssetId === activeSubsystemSlide.assetId ? (
                          <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                        ) : (
                          "Sí"
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label="Eliminar foto"
                      onClick={() => handleDeleteRequest(activeSubsystemSlide.id)}
                      disabled={!!deletingAssetId}
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full",
                        "bg-black/40 text-white backdrop-blur-sm",
                        "hover:bg-black/60 disabled:opacity-50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                      )}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </>
          ),
        }}
      />
    </>
  );
}

// ── ThumbnailListShell — shared header + thumbnail list ──────────────────────
// Used by both MediaManagementPanel and ParkingManagementPanel. The parking
// variant disables delete and adds a divider below the list (the parking
// columns sit underneath in the same scroll).

function ThumbnailListShell({
  title,
  slides,
  activeSubsystemSlide,
  onSelect,
  canDelete = false,
  confirmingSlideId = null,
  deletingAssetId = null,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  error,
  borderBelow = false,
}: {
  title: string;
  slides: readonly SubsystemSlide[];
  activeSubsystemSlide: SubsystemSlide | null;
  onSelect: (idx: number) => void;
  canDelete?: boolean;
  confirmingSlideId?: string | null;
  deletingAssetId?: string | null;
  onDeleteRequest?: (slideId: string) => void;
  onDeleteConfirm?: (assetId: string) => void;
  onDeleteCancel?: () => void;
  error?: string | null;
  borderBelow?: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-3 py-2.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
          {title}
        </span>
      </div>
      {error && (
        <div className="border-b border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2">
          <p className="text-[11px] text-[var(--color-status-error-text)]">{error}</p>
        </div>
      )}
      <div
        className={cn(
          "flex flex-col gap-1 p-2",
          borderBelow && "border-b border-[var(--color-border-default)]",
        )}
      >
        {slides.map((slide, slideIdx) => {
          const isActive = slide === activeSubsystemSlide;
          const isConfirming = confirmingSlideId === slide.id;
          const isDeleting = deletingAssetId === slide.assetId;
          const rowCanDelete =
            canDelete && slide.kind !== "live-map" && !deletingAssetId;
          return (
            <ThumbnailRow
              key={slide.id}
              slide={slide}
              isActive={isActive}
              isConfirming={isConfirming}
              isDeleting={isDeleting}
              onSelect={() => onSelect(slideIdx)}
              onDelete={() => onDeleteRequest?.(slide.id)}
              onConfirmDelete={() => onDeleteConfirm?.(slide.assetId)}
              onCancelDelete={onDeleteCancel ?? noop}
              canDelete={rowCanDelete}
            />
          );
        })}
      </div>
    </>
  );
}

// ── MediaManagementPanel (desktop, non-live-map slide) ───────────────────────

function MediaManagementPanel({
  slides,
  activeSubsystemSlide,
  mediaCount,
  confirmingSlideId,
  deletingAssetId,
  canDelete,
  onSelect,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  uploadConfig,
  uploading,
  uploadError,
  onUploadClick,
}: {
  slides: readonly SubsystemSlide[];
  activeSubsystemSlide: SubsystemSlide | null;
  mediaCount: number;
  confirmingSlideId: string | null;
  deletingAssetId: string | null;
  canDelete: boolean;
  onSelect: (idx: number) => void;
  onDeleteRequest: (slideId: string) => void;
  onDeleteConfirm: (assetId: string) => void;
  onDeleteCancel: () => void;
  uploadConfig?: { propertyId: string; entityType: MediaEntityType; entityId?: string; usageKey: string };
  uploading: boolean;
  uploadError: string | null;
  onUploadClick: () => void;
}) {
  return (
    <>
      <ThumbnailListShell
        title={`Media (${mediaCount})`}
        slides={slides}
        activeSubsystemSlide={activeSubsystemSlide}
        onSelect={onSelect}
        canDelete={canDelete}
        confirmingSlideId={confirmingSlideId}
        deletingAssetId={deletingAssetId}
        onDeleteRequest={onDeleteRequest}
        onDeleteConfirm={onDeleteConfirm}
        onDeleteCancel={onDeleteCancel}
        error={uploadError}
      />
      {uploadConfig && (
        <div className="border-t border-[var(--color-border-default)] p-2">
          <button
            type="button"
            onClick={onUploadClick}
            disabled={uploading}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-[8px] px-3 py-2 text-[12px] font-medium",
              "border border-dashed border-[var(--color-border-default)]",
              "text-[var(--color-text-secondary)] transition-colors duration-150",
              "hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {uploading ? (
              <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            ) : (
              <Upload size={14} aria-hidden="true" />
            )}
            Añadir foto de portada
          </button>
        </div>
      )}
    </>
  );
}

// ── ThumbnailRow (desktop panel) ─────────────────────────────────────────────

function ThumbnailRow({
  slide,
  isActive,
  isConfirming,
  isDeleting,
  onSelect,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  canDelete,
}: {
  slide: SubsystemSlide;
  isActive: boolean;
  isConfirming: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  canDelete: boolean;
}) {
  const hasImage = slide.kind === "image" || slide.kind === "map";
  const isMap = slide.kind === "live-map";
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "group flex items-center gap-2 rounded-[8px] p-1.5 transition-colors duration-100",
          isActive
            ? "bg-[var(--color-action-primary-subtle)]"
            : "hover:bg-[var(--color-background-muted)]",
        )}
      >
        {/* Thumbnail */}
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Ver ${slide.title}`}
          className={cn(
            "relative h-12 w-12 flex-none overflow-hidden rounded-[6px]",
            "bg-[var(--color-background-muted)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
            isActive && "ring-2 ring-[var(--color-action-primary)]",
          )}
        >
          {hasImage && slide.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.url}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-cover"
            />
          ) : isMap ? (
            <span className="grid h-full w-full place-items-center text-[var(--color-text-secondary)]">
              <MapPin size={20} aria-hidden="true" />
            </span>
          ) : null}
        </button>

        {/* Title */}
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-[12px] leading-tight",
            isActive
              ? "font-semibold text-[var(--color-action-primary)]"
              : "text-[var(--color-text-primary)]",
            "focus-visible:outline-none",
          )}
        >
          {slide.title}
        </button>

        {/* Delete button — only for real media slides */}
        {canDelete && (
          <button
            type="button"
            aria-label={`Eliminar ${slide.title}`}
            onClick={onDelete}
            disabled={isDeleting}
            className={cn(
              "flex-none rounded-[6px] p-1",
              "text-[var(--color-text-muted)] opacity-0 transition-opacity duration-100",
              "group-hover:opacity-100",
              "hover:bg-[var(--color-status-error-bg)] hover:text-[var(--color-status-error-text)]",
              "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
              "disabled:cursor-not-allowed disabled:opacity-30",
            )}
          >
            {isDeleting ? (
              <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            ) : (
              <Trash2 size={14} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {isConfirming && (
        <div className="mx-1.5 flex items-center justify-between gap-2 rounded-[6px] border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-2 py-1.5">
          <span className="text-[11px] font-medium text-[var(--color-status-error-text)]">
            ¿Eliminar foto?
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onCancelDelete}
              className="min-h-[44px] rounded px-2 text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              No
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              className="min-h-[44px] rounded bg-[var(--color-status-error-text)]/10 px-2 text-[11px] font-semibold text-[var(--color-status-error-text)] hover:bg-[var(--color-status-error-text)]/20"
            >
              Sí, borrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MobileThumbnail (bottom strip) ──────────────────────────────────────────

function MobileThumbnail({
  slide,
  isActive,
  onSelect,
}: {
  slide: SubsystemSlide;
  isActive: boolean;
  onSelect: () => void;
}) {
  const hasImage = slide.kind === "image" || slide.kind === "map";
  const isLiveMap = slide.kind === "live-map";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Ver ${slide.title}`}
      className={cn(
        "relative h-16 w-16 flex-none overflow-hidden rounded-[8px]",
        "bg-[var(--color-background-muted)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
        isActive
          ? "ring-2 ring-[var(--color-action-primary)] ring-offset-2 ring-offset-[var(--color-background-elevated)]"
          : "opacity-60 hover:opacity-100",
      )}
    >
      {hasImage && slide.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : isLiveMap ? (
        <span className="grid h-full w-full place-items-center text-[var(--color-text-secondary)]">
          <MapPin size={22} aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
}

// ── ParkingManagementPanel (desktop, live-map slide) ─────────────────────────

/** Side-panel parity with the in-section editor — same ConfirmedRow +
 * SuggestionRow primitives, same hook (`useParkingManagement`). Map clicks +
 * manual-pin overlay + relocate chip are rendered next to the map (in the
 * live-map slide render); the panel owns the lists, the refresh button, the
 * error banner and the few-results / hidden-count callouts. Stacking is
 * vertical with a single scroll so operators see both groups without
 * tabbing. */
function ParkingManagementPanel({
  slides,
  activeSubsystemSlide,
  mediaCount,
  onSelect,
  parkingState,
}: {
  slides: readonly SubsystemSlide[];
  activeSubsystemSlide: SubsystemSlide | null;
  mediaCount: number;
  onSelect: (idx: number) => void;
  parkingState: UseParkingManagementReturn;
}) {
  const {
    places,
    suggestions,
    searchMeta,
    nameOverrides,
    feeOverrides,
    refreshing,
    refresh,
    setNameOverride,
    setFeeOverride,
    confirmOne,
    hiddenCount,
    actionError,
    setActionError,
    activeId,
    setActiveId,
    relocatingId,
    anyMutating,
    handleDelete,
    handleUpdate,
    handleRelocateRequest,
  } = parkingState;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <ThumbnailListShell
        title={`Media (${mediaCount})`}
        slides={slides}
        activeSubsystemSlide={activeSubsystemSlide}
        onSelect={onSelect}
        borderBelow
      />
      <div className="flex flex-col gap-3 p-3">
      {actionError && (
        <Banner
          type="danger"
          message={actionError}
          onDismiss={() => setActionError(null)}
        />
      )}

      {searchMeta?.warningKey === "few_results" && (
        <div className="flex items-start gap-2 rounded-[8px] bg-[var(--color-background-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
          <AlertTriangle
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--color-status-warning-icon)]"
          />
          <span>
            Pocos resultados — usa el botón + del mapa si conoces uno que falte.
          </span>
        </div>
      )}

      <CockpitListColumn label="Añadidos" count={places.length}>
        {places.length > 0 ? (
          <ul className="space-y-1">
            {places.map((p) => (
              <ConfirmedRow
                key={p.id}
                place={p}
                onRename={(name) => handleUpdate(p.id, { name })}
                onSetFee={(feeType) => handleUpdate(p.id, { feeType })}
                onDelete={() => handleDelete(p.id)}
                onRelocateRequest={() => handleRelocateRequest(p.id)}
                relocating={relocatingId === p.id}
                onActivate={() => setActiveId(pinIdForPlace(p.id))}
                onDeactivate={() =>
                  setActiveId((id) =>
                    id === pinIdForPlace(p.id) ? null : id,
                  )
                }
                isActive={activeId === pinIdForPlace(p.id)}
                disabled={anyMutating}
              />
            ))}
          </ul>
        ) : (
          <CockpitEmptyState>
            Sin pines confirmados. Usa el botón + del mapa para añadir uno manualmente.
          </CockpitEmptyState>
        )}
      </CockpitListColumn>

      <CockpitListColumn
        label="Sugeridos"
        count={suggestions.length}
        action={
          <RefreshIconButton
            onClick={refresh}
            disabled={refreshing || anyMutating}
            loading={refreshing}
            tooltip="Refrescar sugerencias"
          />
        }
      >
        {suggestions.length > 0 ? (
          <ul className="space-y-1">
            {suggestions.map((s) => {
              const displayName = nameOverrides.get(s.providerPlaceId) ?? s.name;
              const resolvedFee: BinaryFee | null =
                feeOverrides.get(s.providerPlaceId) ?? s.parkingFee;
              return (
                <SuggestionRow
                  key={s.providerPlaceId}
                  name={displayName}
                  address={s.address}
                  website={s.website}
                  distanceMeters={s.distanceMeters}
                  fee={resolvedFee}
                  onRename={(name) => setNameOverride(s.providerPlaceId, name)}
                  onToggleFee={() =>
                    setFeeOverride(s.providerPlaceId, cycleFee(resolvedFee))
                  }
                  onAdd={() => confirmOne(s.providerPlaceId)}
                  onActivate={() =>
                    setActiveId(pinIdForSuggestion(s.providerPlaceId))
                  }
                  onDeactivate={() =>
                    setActiveId((id) =>
                      id === pinIdForSuggestion(s.providerPlaceId)
                        ? null
                        : id,
                    )
                  }
                  isActive={
                    activeId === pinIdForSuggestion(s.providerPlaceId)
                  }
                  disabled={anyMutating}
                />
              );
            })}
          </ul>
        ) : (
          <CockpitEmptyState>
            Sin resultados cercanos. Refresca o usa el botón + del mapa.
          </CockpitEmptyState>
        )}
      </CockpitListColumn>

      {hiddenCount > 0 && (
        <p className="text-[12px] text-[var(--color-text-subtle)]">
          +{hiddenCount} sugerencias adicionales ocultas tras el cap.
        </p>
      )}
      </div>
    </div>
  );
}

// ── NavButton / CloseButton ─────────────────────────────────────────────────
// Custom Lightbox nav/close buttons so all hover affordances in the app render
// through the shared <Tooltip> primitive (consistent format + Spanish copy).
// YARL's defaults rely on the native `title` attribute which can't be styled.
// Hooks live inside the Lightbox provider tree — these components are only
// rendered via `render.buttonPrev/Next/Close`, never mounted standalone.

const NAV_BUTTON_CLASS = cn(
  "grid h-11 w-11 place-items-center rounded-full",
  "bg-black/35 text-white backdrop-blur-sm",
  "transition-colors duration-150 hover:bg-black/55",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
  "disabled:cursor-not-allowed disabled:opacity-30",
);

function NavButton({
  variant,
  rightOffsetPx = 0,
}: {
  variant: "prev" | "next";
  /** Extra right padding on desktop so the next button stays clear of the
   * side panel. Ignored for prev. */
  rightOffsetPx?: number;
}) {
  const { prev, next } = useController();
  const { prevDisabled, nextDisabled } = useNavigationState();
  const isPrev = variant === "prev";
  const label = isPrev ? "Anterior" : "Siguiente";
  const onClick = isPrev ? prev : next;
  const disabled = isPrev ? prevDisabled : nextDisabled;
  const Icon = isPrev ? ChevronLeft : ChevronRight;
  return (
    <div
      style={
        isPrev
          ? { position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", zIndex: 1 }
          : { position: "absolute", right: rightOffsetPx + 16, top: "50%", transform: "translateY(-50%)", zIndex: 1 }
      }
    >
      <Tooltip text={label}>
        <button
          type="button"
          aria-label={label}
          onClick={() => onClick()}
          disabled={disabled}
          className={NAV_BUTTON_CLASS}
        >
          <Icon size={20} aria-hidden="true" strokeWidth={2} />
        </button>
      </Tooltip>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Tooltip text="Cerrar">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className={NAV_BUTTON_CLASS}
      >
        <X size={20} aria-hidden="true" strokeWidth={2} />
      </button>
    </Tooltip>
  );
}
