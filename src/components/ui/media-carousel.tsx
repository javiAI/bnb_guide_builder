"use client";

import { Loader2, Plus, Video } from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  assignMediaAction,
  confirmUploadAction,
  deleteMediaAction,
  requestUploadAction,
} from "@/lib/actions/media.actions";
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
  /** `aria-controls` target for the cover-expand button (collapsed only). */
  bodyId?: string;
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
  bodyId,
}: MediaCarouselProps) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // ── Upload flow (request → PUT to R2 → confirm → assign) ──────────────
  const handleAddCoverClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (uploading) return;
      setUploadError(null);
      fileInputRef.current?.click();
    },
    [uploading],
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setUploading(true);
      setUploadError(null);
      let assetId: string | null = null;
      try {
        const req = await requestUploadAction(propertyId, file.name, file.type);
        if (!req.success || !req.data) {
          setUploadError(req.error ?? "Error al preparar la subida");
          return;
        }
        assetId = req.data.assetId;
        const put = await fetch(req.data.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!put.ok) {
          setUploadError(`Subida falló (${put.status})`);
          deleteMediaAction(assetId).catch(() => {});
          return;
        }
        const confirm = await confirmUploadAction(assetId);
        if (!confirm.success) {
          setUploadError(confirm.error ?? "Error al verificar");
          return;
        }
        const assign = await assignMediaAction(
          assetId,
          uploadEntityType,
          propertyId,
          uploadUsageKey,
        );
        if (!assign.success) {
          setUploadError(assign.error ?? "Error al asignar");
          return;
        }
        router.refresh();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Error desconocido");
        if (assetId) deleteMediaAction(assetId).catch(() => {});
      } finally {
        setUploading(false);
      }
    },
    [propertyId, uploadEntityType, uploadUsageKey, router],
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
          loading={index === 0 ? "eager" : "lazy"}
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
        <button
          type="button"
          aria-label={`Añade portada de ${title}`}
          onClick={handleAddCoverClick}
          disabled={uploading}
          className={cn(
            "absolute bottom-3 left-1/2 inline-flex min-h-[36px] -translate-x-1/2 items-center gap-1.5",
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
            className="absolute bottom-12 left-1/2 inline-flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--color-status-error-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-status-error-text)]"
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
      className={cn("relative w-full flex-none overflow-hidden", heightClass)}
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
         like the parking live-map. Omitted only for `active` variant where
         the parent handles collapse via the title button. */}
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
        />
      )}

      {slides.length > 1 && (
        <div
          aria-label={`Medios de ${title}`}
          className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center"
        >
          <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full bg-[var(--color-background-overlay)] px-1 py-1 backdrop-blur-[2px]">
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
                  onClick={() => setCurrentIdx(i)}
                  onKeyDown={(e) => handleDotKeyDown(e, i)}
                  className={cn(
                    "recipe-dot-pagination grid flex-none place-items-center rounded-full p-0.5",
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
