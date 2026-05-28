"use client";

import { Expand, Loader2, Plus, Video, ZoomIn } from "lucide-react";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useMediaUpload } from "@/hooks/use-media-upload";
import type { MediaEntityType } from "@/lib/schemas/editor.schema";

// ── Slide types ──────────────────────────────────────────────────────────
//
// The carousel renders four kinds:
//   - "image" / "map":  presigned <img> from R2.
//   - "video":          icon placeholder (no inline player in collapsed view).
//   - "custom":         consumer-provided ReactNode — e.g. a display-only
//                       MapLibre instance. Custom slides MUST NOT capture
//                       pointer events: the carousel owns swipe + tap-to-
//                       expand across all slide kinds. If a consumer needs
//                       a fully interactive surface, it belongs in the
//                       expanded variant, not the collapsed cover.

interface BaseSlide {
  id: string;
  title: string;
}

export type MediaCarouselSlide =
  | (BaseSlide & {
      kind: "image" | "map";
      url: string;
      alt: string;
    })
  | (BaseSlide & {
      kind: "video";
      alt: string;
    })
  | (BaseSlide & {
      kind: "custom";
      render: (height: number) => ReactNode;
    });

// ── Props ────────────────────────────────────────────────────────────────

export interface MediaCarouselProps {
  slides: readonly MediaCarouselSlide[];
  /** Property scoping the upload (passed to media actions). */
  propertyId: string;
  /** Card title — used for a11y labels (`Abrir ${title}`, `Mostrar …`). */
  title: string;
  variant: "collapsed" | "active";
  /** Entity type forwarded to `assignMediaAction` after upload (e.g. `"access_method"`, `"space"`). */
  uploadEntityType: MediaEntityType;
  /** Usage key forwarded to `assignMediaAction` (e.g. `"access.parking"`, `"space.<spaceId>"`). */
  uploadUsageKey: string;
  /** CSS background string used when `slides.length === 0`. Defaults to a neutral gradient. */
  placeholderGradient?: string;
  /** Click on the cover (collapsed variant) — typically expands the card. */
  onExpand?: () => void;
  /** When set, a hover-revealed Expand icon appears top-right on the media
   *  area; clicking it requests the lightbox to open at the current slide
   *  index. In the active variant, clicking the cover overlay also opens
   *  the lightbox (collapse lives on the title chip in the parent shell). */
  onLightboxOpen?: (idx: number) => void;
  /** Promote the lightbox button to always-visible (no hover gate) — mirrors
   *  the always-on ZoomIn affordance on `MultiPinMap`. Use for hero surfaces
   *  where the operator should never have to discover the expand action.
   *  Defaults to false (hover-revealed on fine pointers, always-on coarse). */
  lightboxButtonAlwaysVisible?: boolean;
  /** `aria-controls` target for the cover-expand button (collapsed only). */
  bodyId?: string;
  /** Controlled active-slide index. When provided together with
   *  `onCurrentIdxChange`, the carousel becomes controlled — useful when the
   *  parent needs the active slide to persist across mounts (e.g. when the
   *  collapsed and active branches render two `<MediaCarousel>` instances
   *  and the user expects the slide they were viewing to stay put). */
  currentIdx?: number;
  onCurrentIdxChange?: (next: number | ((prev: number) => number)) => void;
  /** Opt-in eager-load for the first slide. Off by default so a grid of N
   *  carousels (e.g. the 1×4 cockpit row) does not fire N eager image fetches
   *  on mount. Set true only on the single carousel that owns the initial LCP
   *  in the viewport. */
  eagerFirstSlide?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────

const SWIPE_PIXEL_THRESHOLD = 50;
const SWIPE_FRACTION_THRESHOLD = 0.2;
const SWIPE_FLICK_DURATION_MS = 300;
const SWIPE_AXIS_LOCK_PX = 6;
const SWIPE_EDGE_RESISTANCE = 0.3;
const TRACK_TRANSITION_MS = 280;
const PLACEHOLDER_DEFAULT_GRADIENT =
  "linear-gradient(135deg, var(--color-background-muted), var(--color-background-subtle))";

// ── Component ────────────────────────────────────────────────────────────

export function MediaCarousel({
  slides,
  propertyId,
  title,
  variant,
  uploadEntityType,
  uploadUsageKey,
  placeholderGradient,
  onExpand,
  onLightboxOpen,
  lightboxButtonAlwaysVisible = false,
  bodyId,
  currentIdx: controlledIdx,
  onCurrentIdxChange,
  eagerFirstSlide = false,
}: MediaCarouselProps) {
  const [uncontrolledIdx, setUncontrolledIdx] = useState(0);
  const isControlled = controlledIdx !== undefined && onCurrentIdxChange !== undefined;
  const currentIdx = isControlled ? controlledIdx : uncontrolledIdx;
  const setCurrentIdx = useCallback(
    (next: number | ((prev: number) => number)) => {
      if (isControlled) {
        onCurrentIdxChange(next);
      } else {
        setUncontrolledIdx(next);
      }
    },
    [isControlled, onCurrentIdxChange],
  );
  const uploadConfig = useMemo(
    () => ({
      propertyId,
      entityType: uploadEntityType,
      usageKey: uploadUsageKey,
    }),
    [propertyId, uploadEntityType, uploadUsageKey],
  );
  const {
    fileInputRef,
    uploading,
    error: uploadError,
    triggerFilePicker,
    onFileChange: handleFileChange,
  } = useMediaUpload(uploadConfig);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number>(0);
  const pointerStartTimeRef = useRef<number>(0);
  const swipeAxisLockRef = useRef<"horizontal" | "vertical" | null>(null);
  const swipedRef = useRef(false);

  const safeIdx = slides.length === 0 ? 0 : Math.min(currentIdx, slides.length - 1);
  const canSwipe = slides.length > 1;

  const heightClass = variant === "active" ? "h-[240px]" : "h-[140px]";
  const heightPx = variant === "active" ? 240 : 140;
  const placeholderBg = placeholderGradient ?? PLACEHOLDER_DEFAULT_GRADIENT;

  const handleAddCoverClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      triggerFilePicker();
    },
    [triggerFilePicker],
  );

  // ── Dot keyboard navigation ───────────────────────────────────────────
  const focusDot = useCallback((i: number) => {
    dotRefs.current[i]?.focus();
  }, []);

  const handleDotKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
      if (slides.length <= 1) return;
      const last = slides.length - 1;
      let next = i;
      if (e.key === "ArrowRight") next = i === last ? 0 : i + 1;
      else if (e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = last;
      else return;
      e.preventDefault();
      setCurrentIdx(next);
      focusDot(next);
    },
    [slides.length, focusDot],
  );

  // ── Pointer-driven swipe (touch + mouse + pen) ────────────────────────
  // Track-based: all slides render side-by-side, the track translates by
  // `-currentIdx * 100% + dragOffset`. During drag we update dragOffset on
  // every pointer move; on release we either snap forward / backward or
  // settle back to the active slide.
  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!canSwipe) return;
      // Only primary mouse button; touch / pen always pass.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerStartXRef.current = e.clientX;
      pointerStartYRef.current = e.clientY;
      pointerStartTimeRef.current = Date.now();
      swipeAxisLockRef.current = null;
      swipedRef.current = false;
    },
    [canSwipe],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const startX = pointerStartXRef.current;
      if (startX === null) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - pointerStartYRef.current;

      // Lock axis on first significant movement so vertical scrolls bail out
      // (prevents accidental slide change when the user is scrolling the page).
      if (swipeAxisLockRef.current === null) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < SWIPE_AXIS_LOCK_PX && absY < SWIPE_AXIS_LOCK_PX) return;
        swipeAxisLockRef.current = absX > absY ? "horizontal" : "vertical";
      }
      if (swipeAxisLockRef.current === "vertical") return;

      // Edge resistance — drag past first/last is dampened so the user feels
      // they're at the boundary instead of the track sliding off into space.
      const atStart = currentIdx === 0 && dx > 0;
      const atEnd = currentIdx === slides.length - 1 && dx < 0;
      const adjusted = atStart || atEnd ? dx * SWIPE_EDGE_RESISTANCE : dx;
      setDragOffset(adjusted);
      if (!isDragging) setIsDragging(true);
    },
    [currentIdx, slides.length, isDragging],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const startX = pointerStartXRef.current;
      pointerStartXRef.current = null;
      const wasHorizontal = swipeAxisLockRef.current === "horizontal";
      swipeAxisLockRef.current = null;

      setIsDragging(false);
      setDragOffset(0);

      if (startX === null || !wasHorizontal) return;

      const dx = e.clientX - startX;
      const dt = Date.now() - pointerStartTimeRef.current;
      const width = trackContainerRef.current?.offsetWidth ?? 0;
      const fraction = width > 0 ? dx / width : 0;
      const isFlick = Math.abs(dx) > SWIPE_PIXEL_THRESHOLD && dt < SWIPE_FLICK_DURATION_MS;
      const isPull = Math.abs(fraction) > SWIPE_FRACTION_THRESHOLD;

      if (!isFlick && !isPull) return;

      swipedRef.current = true;
      const last = slides.length - 1;
      setCurrentIdx((i) => {
        if (dx < 0) return i === last ? i : i + 1; // no wrap on swipe
        return i === 0 ? i : i - 1;
      });
    },
    [slides.length],
  );

  const handlePointerCancel = useCallback(() => {
    pointerStartXRef.current = null;
    swipeAxisLockRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  // Suppress the synthetic click that fires after a swipe gesture so the
  // expand button doesn't fire when the user just swiped.
  const handleExpandClick = useCallback(() => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    onExpand?.();
  }, [onExpand]);

  const handleLightboxClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (swipedRef.current) {
        swipedRef.current = false;
        return;
      }
      onLightboxOpen?.(safeIdx);
    },
    [onLightboxOpen, safeIdx],
  );

  // Active variant: clicking anywhere on the cover opens the lightbox (the
  // title chip in the parent shell collapses the card). Same swipe-suppression
  // dance as the collapsed-variant expand handler.
  const handleActiveCoverClick = useCallback(() => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    onLightboxOpen?.(safeIdx);
  }, [onLightboxOpen, safeIdx]);

  // ── Slide content renderer ────────────────────────────────────────────
  const renderSlideContent = (slide: MediaCarouselSlide, index: number) => {
    if (slide.kind === "custom") return slide.render(heightPx);
    if (slide.kind === "image" || slide.kind === "map") {
      return (
        // R2 returns presigned URLs that rotate every ~10 min — incompatible
        // with next/image's static remotePatterns. Plain <img> matches the
        // pattern in MediaThumbnail and avoids a host allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.url}
          alt={slide.alt || slide.title}
          loading={index === 0 && eagerFirstSlide ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
      );
    }
    return (
      <span
        role="img"
        aria-label={slide.alt || slide.title}
        className="grid h-full w-full place-items-center bg-[var(--color-background-muted)] text-[var(--color-text-subtle)]"
      >
        <Video size={28} aria-hidden="true" />
      </span>
    );
  };

  // ── Empty state — placeholder + Añade portada ─────────────────────────
  if (slides.length === 0) {
    return (
      <div className={cn("relative w-full flex-none overflow-hidden", heightClass)}>
        <span
          aria-hidden="true"
          className="block h-full w-full"
          style={{ background: placeholderBg }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.avif,.gif"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
        {/* Cover overlay (collapsed only) — clicking the empty gradient expands
           the card. Sits below the upload button via z-index, so a click on
           "Añade portada" still uploads (e.stopPropagation on it). The active
           variant has no overlay here: with 0 slides there's nothing to open
           in the lightbox, and the title chip in the parent shell handles
           collapse. */}
        {variant === "collapsed" && onExpand && (
          <button
            type="button"
            aria-label={`Abrir ${title}`}
            aria-controls={bodyId}
            aria-expanded={false}
            onClick={handleExpandClick}
            className={cn(
              "absolute inset-0 z-[1] block h-full w-full text-left",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]",
            )}
          ></button>
        )}
        <button
          type="button"
          aria-label={`Añade portada de ${title}`}
          onClick={handleAddCoverClick}
          disabled={uploading}
          className={cn(
            "absolute bottom-3 left-1/2 z-[2] inline-flex min-h-[36px] -translate-x-1/2 items-center gap-1.5",
            "rounded-full bg-[var(--color-background-overlay)] px-3 text-[12px] font-medium text-[var(--color-text-on-overlay)]",
            "backdrop-blur-[2px] transition-colors duration-150",
            "hover:bg-[color-mix(in_oklch,var(--color-background-overlay)_70%,black)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-elevated)]",
            "disabled:cursor-not-allowed disabled:opacity-80",
            // 44 hit area via slop pseudo (visual stays at 36).
            "before:absolute before:inset-[-4px] before:content-['']",
            "[@media(pointer:coarse)]:min-h-[44px]",
          )}
        >
          {uploading ? (
            <>
              <Loader2 size={13} aria-hidden="true" className="animate-spin" />
              Subiendo…
            </>
          ) : (
            <>
              <Plus size={13} aria-hidden="true" />
              Añade portada
            </>
          )}
        </button>
        {uploadError && (
          <span
            role="alert"
            className="absolute bottom-12 left-1/2 z-[2] inline-flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--color-status-error-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-status-error-text)]"
          >
            <span className="truncate">{uploadError}</span>
          </span>
        )}
      </div>
    );
  }

  // ── Carousel branch — track + dots + expand overlay ───────────────────
  return (
    <div
      ref={trackContainerRef}
      className={cn("group/cover relative w-full flex-none overflow-hidden", heightClass)}
      onPointerDown={canSwipe ? handlePointerDown : undefined}
      onPointerMove={canSwipe ? handlePointerMove : undefined}
      onPointerUp={canSwipe ? handlePointerUp : undefined}
      onPointerCancel={canSwipe ? handlePointerCancel : undefined}
      // pan-y lets vertical page scroll keep working; horizontal is ours.
      style={{ touchAction: canSwipe ? "pan-y" : undefined }}
    >
      <div
        aria-roledescription="carousel"
        className="flex h-full w-full will-change-transform"
        style={{
          transform: `translate3d(calc(${-safeIdx * 100}% + ${dragOffset}px), 0, 0)`,
          transition: isDragging
            ? "transform 0ms"
            : `transform ${TRACK_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            aria-hidden={i === safeIdx ? undefined : "true"}
            className="relative h-full w-full flex-none overflow-hidden"
          >
            {renderSlideContent(slide, i)}
            <span
              aria-hidden="true"
              className="absolute left-2 top-2 z-[1] inline-flex max-w-[calc(100%-1rem)] items-center rounded-full bg-[var(--color-background-overlay)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-on-overlay)] backdrop-blur-[2px]"
            >
              <span className="truncate">{slide.title}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Cover expand button — full overlay so the user can click anywhere on
         the cover to expand, including over custom (display-only) slides
         like the parking live-map. */}
      {variant === "collapsed" && onExpand && (
        <button
          type="button"
          aria-label={`Abrir ${title}`}
          aria-controls={bodyId}
          aria-expanded={false}
          onClick={handleExpandClick}
          className={cn(
            "absolute inset-0 z-[2] block h-full w-full text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]",
          )}
        ></button>
      )}

      {/* Active-variant cover overlay — clicking anywhere on the cover opens
         the lightbox at the current slide. Collapse lives on the title chip
         in the parent shell, so the cover is dedicated to "expand this media
         to manage it". Mirrors the collapsed expand-overlay topology. */}
      {variant === "active" && onLightboxOpen && (
        <button
          type="button"
          aria-label={`Ampliar media de ${title}`}
          onClick={handleActiveCoverClick}
          className={cn(
            "absolute inset-0 z-[2] block h-full w-full text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]",
          )}
        ></button>
      )}

      {/* Lightbox button — sits above both expand/collapse overlays (z-[3])
         and stops click propagation so it doesn't trigger the cover button
         beneath. Hover-revealed on fine pointer, always visible on coarse
         pointer where hover is unreliable. The glyph swaps to ZoomIn when
         the current slide is a custom one (e.g. live map) so the affordance
         reads as "ampliar mapa" rather than a generic expand. */}
      {onLightboxOpen && (() => {
        const Icon = slides[safeIdx]?.kind === "custom" ? ZoomIn : Expand;
        return (
          <button
            type="button"
            aria-label={`Ampliar media de ${title}`}
            onClick={handleLightboxClick}
            className={cn(
              "absolute right-2 top-2 z-[3] grid h-11 w-11 place-items-center rounded-full",
              "bg-[var(--color-background-overlay)] text-[var(--color-text-on-overlay)] backdrop-blur-[2px]",
              "transition-opacity duration-150 focus-visible:opacity-100",
              "[@media(pointer:coarse)]:opacity-100",
              lightboxButtonAlwaysVisible
                ? "opacity-100"
                : "opacity-0 group-hover/cover:opacity-100",
              "hover:bg-[color-mix(in_oklch,var(--color-background-overlay)_70%,black)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-elevated)]",
            )}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        );
      })()}

      {slides.length > 1 && (
        <div
          aria-label={`Medios de ${title}`}
          className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center"
        >
          <div className="pointer-events-auto inline-flex items-center rounded-full bg-[var(--color-background-overlay)] px-1 backdrop-blur-[2px]">
            {slides.map((slide, i) => {
              const isActive = i === safeIdx;
              return (
                <button
                  key={slide.id}
                  ref={(el) => {
                    dotRefs.current[i] = el;
                  }}
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`Mostrar ${slide.title}`}
                  onClick={() => {
                    if (swipedRef.current) { swipedRef.current = false; return; }
                    setCurrentIdx(i);
                  }}
                  onKeyDown={(e) => handleDotKeyDown(e, i)}
                  className={cn(
                    "grid h-11 w-11 flex-none place-items-center rounded-full",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-on-overlay)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-background-overlay)]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    data-active={isActive ? "true" : undefined}
                    className={cn(
                      "h-1 rounded-full transition-[width,background-color] duration-200",
                      isActive
                        ? "w-2.5 bg-[var(--color-text-on-overlay)]"
                        : "w-1 bg-[color-mix(in_oklch,var(--color-text-on-overlay)_45%,transparent)]",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
