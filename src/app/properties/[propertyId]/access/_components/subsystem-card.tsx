"use client";

import {
  AlertTriangle,
  Camera,
  Check,
  Loader2,
  Plus,
  Star,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/cn";
import {
  assignMediaAction,
  confirmUploadAction,
  deleteMediaAction,
  requestUploadAction,
} from "@/lib/actions/media.actions";
import type { CardRole } from "./cockpit-grid";
import { HoverCard } from "@/components/ui/hover-card";
import type { SubsystemSlide } from "./subsystem-card.types";

// Every subsystem resolves to one of these two — "empty" was removed in 7b
// when explicit scope toggles (hasBuildingAccess / hasParking /
// hasAccessibilityConsiderations) made it possible for every card to declare
// configured-or-pending deterministically.
export type SubsystemStatus = "configured" | "pending";

export interface SubsystemSelectedItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface SubsystemCardProps {
  role: CardRole;
  cockpitId: string;
  propertyId: string;
  icon: LucideIcon;
  title: string;
  selectedItems: readonly SubsystemSelectedItem[];
  primaryId: string | null;
  photoCount: number;
  videoCount?: number;
  status: SubsystemStatus;
  slides?: readonly SubsystemSlide[];
  onExpand: () => void;
  onCollapse: () => void;
  expandedSubtitle?: string;
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
  onExpand,
  onCollapse,
  expandedSubtitle,
  children,
}: SubsystemCardProps) {
  const titleId = useId();
  const bodyId = useId();

  // Per-card view-transition-name lets the browser morph each card individually.
  const cardStyle = { viewTransitionName: `cockpit-card-${cockpitId}` } as React.CSSProperties;

  // Order: primary first, then the rest in given order. Visible cap then
  // overflow into the "+N" reveal.
  const ordered = (() => {
    if (!primaryId) return [...selectedItems];
    const p = selectedItems.find((it) => it.id === primaryId);
    if (!p) return [...selectedItems];
    return [p, ...selectedItems.filter((it) => it.id !== primaryId)];
  })();
  const visibleCap = resolveVisibleCap(ordered.length);
  const visible = ordered.slice(0, visibleCap);
  const hidden = ordered.slice(visibleCap);

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

  if (role === "active") {
    return (
      <div
        style={cardStyle}
        className="overflow-hidden rounded-[20px] border border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] shadow-[var(--elevation-surface-sm)]"
      >
        <button
          type="button"
          aria-expanded={true}
          aria-controls={bodyId}
          aria-labelledby={titleId}
          onClick={onCollapse}
          className={cn(
            "group flex w-full items-center gap-3 p-5 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
            "hover:bg-[var(--color-background-muted)]/40",
          )}
        >
          <span
            aria-hidden="true"
            className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-[var(--color-action-primary)] text-[var(--color-text-on-accent)]"
          >
            <Icon size={20} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span
              id={titleId}
              className="truncate text-[16px] font-semibold leading-tight text-[var(--color-text-primary)]"
            >
              {title}
            </span>
            {expandedSubtitle && (
              <span className="text-[13px] leading-[1.45] text-[var(--color-text-secondary)]">
                {expandedSubtitle}
              </span>
            )}
          </span>
        </button>
        <section
          id={bodyId}
          role="region"
          aria-labelledby={titleId}
          className="border-t border-[var(--color-border-default)] p-5"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </section>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Collapsed branch — Liora "spaces-card" silhouette:
  //   <article>
  //     <div media-area>      ← media expand <button> + dots (siblings)
  //     <button body-expand>  ← header + strip + foot pill
  //   </article>
  //
  // Two sibling expand buttons (media + body) → no nested interactive HTML;
  // dots are siblings of both, never inside them. Tab-stops per card =
  // 1 (media-expand) + N dots + 1 (body-expand). View-transition-name
  // sits on the <article> so the morph animates the whole shell.
  // ────────────────────────────────────────────────────────────────────

  return (
    <CollapsedCard
      cardStyle={cardStyle}
      titleId={titleId}
      bodyId={bodyId}
      cockpitId={cockpitId}
      propertyId={propertyId}
      Icon={Icon}
      title={title}
      status={status}
      slides={slides ?? []}
      ordered={ordered}
      visible={visible}
      hidden={hidden}
      primaryId={primaryId}
      photoCount={photoCount}
      videoCount={videoCount}
      renderTile={renderTile}
      onExpand={onExpand}
    />
  );
}

// ── Collapsed card body ─────────────────────────────────────────────────

interface CollapsedCardProps {
  cardStyle: React.CSSProperties;
  titleId: string;
  bodyId: string;
  cockpitId: string;
  propertyId: string;
  Icon: LucideIcon;
  title: string;
  status: SubsystemStatus;
  slides: readonly SubsystemSlide[];
  ordered: readonly SubsystemSelectedItem[];
  visible: readonly SubsystemSelectedItem[];
  hidden: readonly SubsystemSelectedItem[];
  primaryId: string | null;
  photoCount: number;
  videoCount: number;
  renderTile: (item: SubsystemSelectedItem, isPrimary: boolean) => ReactNode;
  onExpand: () => void;
}

function CollapsedCard({
  cardStyle,
  titleId,
  bodyId,
  cockpitId,
  propertyId,
  Icon,
  title,
  status,
  slides,
  ordered,
  visible,
  hidden,
  primaryId,
  photoCount,
  videoCount,
  renderTile,
  onExpand,
}: CollapsedCardProps) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const safeIdx = slides.length === 0 ? 0 : Math.min(currentIdx, slides.length - 1);
  const activeSlide = slides[safeIdx];

  const handleAddCoverClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (uploading) return;
    setUploadError(null);
    fileInputRef.current?.click();
  }, [uploading]);

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
          "access_method",
          propertyId,
          `access.${cockpitId}`,
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
    [propertyId, cockpitId, router],
  );

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

  return (
    <article
      data-component="subsystem-card-collapsed"
      aria-labelledby={titleId}
      style={cardStyle}
      className={cn(
        "group relative flex min-h-[260px] w-full flex-col overflow-hidden rounded-[20px] text-left",
        // Card-level hover (border + shadow). Same arbitrary-property
        // [box-shadow:...] dance as the previous <button> — `shadow-[var(--…)]`
        // is mis-parsed by Tailwind v3 as a shadow color. We use a literal
        // box-shadow rule via `[box-shadow:var(--elevation-surface-lg)]`.
        "transition-[border-color,box-shadow] duration-200 ease-out",
        "border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-action-primary)]",
        "hover:[box-shadow:var(--elevation-surface-lg)]",
        "focus-within:[box-shadow:var(--elevation-surface-md)]",
      )}
    >
      {/* ── Media area ─────────────────────────────────────────── */}
      <div className="relative h-[140px] w-full flex-none">
        <button
          type="button"
          aria-label={`Abrir ${title}`}
          aria-controls={bodyId}
          aria-expanded={false}
          onClick={onExpand}
          className={cn(
            "block h-full w-full text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]",
          )}
        >
          {activeSlide ? (
            <Slide slide={activeSlide} eager={safeIdx === 0} />
          ) : (
            <Placeholder subsystemId={cockpitId} />
          )}
          {activeSlide && (
            <span
              aria-hidden="true"
              className="absolute left-2 top-2 inline-flex max-w-[calc(100%-1rem)] items-center rounded-full bg-[var(--color-background-overlay)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-on-overlay)] backdrop-blur-[2px]"
            >
              <span className="truncate">{activeSlide.title}</span>
            </span>
          )}
        </button>

        {slides.length === 0 && (
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
                // 44 hit area via slop pseudo-element (visual 36 stays discreet).
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
          </>
        )}

        {slides.length > 1 && (
          <div
            aria-label={`Medios de ${title}`}
            className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5"
          >
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
                    "recipe-dot-24 pointer-events-auto grid h-6 w-6 flex-none place-items-center rounded-full",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-overlay)]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    data-active={isActive ? "true" : undefined}
                    className={cn(
                      "h-2 w-2 rounded-full transition-[background-color,box-shadow] duration-150",
                      isActive
                        ? "bg-[var(--color-action-primary)] [box-shadow:0_0_0_2px_var(--color-background-elevated)]"
                        : "bg-[color-mix(in_oklch,var(--color-text-subtle)_60%,transparent)]",
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <button
        type="button"
        aria-expanded={false}
        aria-controls={bodyId}
        aria-labelledby={titleId}
        onClick={onExpand}
        className={cn(
          "flex flex-1 flex-col gap-3 p-4 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]",
        )}
      >
        {/* Header row: icon-badge + title + status pill on the right.
           Status pill drops on `empty` (placeholder + hint convey state). */}
        <span className="flex w-full items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-[var(--color-action-primary)] text-[var(--color-text-on-accent)]"
          >
            <Icon size={20} aria-hidden="true" />
          </span>
          <span
            id={titleId}
            title={title}
            className="min-w-0 flex-1 line-clamp-2 text-[15px] font-semibold leading-tight text-[var(--color-text-primary)]"
          >
            {title}
          </span>
          <StatusPill status={status} />
        </span>

        {/* Strip — visible-cap policy + HoverCard popover with full ordered
           list. items-start on the wrapper keeps the Radix Trigger inline-flex
           wrapper from being stretched by the parent flex-col (preserves the
           6h hover scope fix: popover opens only over the strip itself). */}
        <span className="flex flex-1 flex-col items-start justify-end overflow-visible">
          {ordered.length === 0 ? (
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
                    <span key={item.id}>
                      {renderTile(item, item.id === primaryId)}
                    </span>
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
          )}
        </span>

        {/* Visually-hidden media counts — kept for AT users / regression tests
           that previously asserted the photo/video counts. The visible carousel
           + dot count already conveys the same information sighted users. */}
        <span className="sr-only">
          <Camera size={12} aria-hidden="true" />
          {photoCount} {photoCount === 1 ? "foto" : "fotos"},{" "}
          <Video size={12} aria-hidden="true" />
          {videoCount} {videoCount === 1 ? "vídeo" : "vídeos"}
        </span>
      </button>
    </article>
  );
}

// ── Slide / placeholder / pill helpers ──────────────────────────────────

function Slide({
  slide,
  eager,
}: {
  slide: SubsystemSlide;
  eager: boolean;
}) {
  if (slide.kind === "image" || slide.kind === "map") {
    return (
      <Image
        src={slide.url}
        alt={slide.alt || slide.title}
        fill
        sizes="(max-width: 640px) 100vw, 320px"
        priority={eager}
        unoptimized
        className="object-cover"
      />
    );
  }
  // Video kind — `MediaAsset` has no posterUrl/thumbnail in schema, so the
  // collapsed view always renders a placeholder icon. Real video element
  // lives in the expanded gallery (out of 7a scope).
  return (
    <span
      className="grid h-full w-full place-items-center bg-[var(--color-background-muted)] text-[var(--color-text-subtle)]"
      aria-hidden="true"
    >
      <Video size={28} />
      <span className="sr-only">{slide.alt || slide.title}</span>
    </span>
  );
}

function Placeholder({
  subsystemId,
}: {
  subsystemId: string;
}) {
  // Per-subsystem identity gradient — terra (building) / olive (unit) /
  // info (parking) / warning (accessibility). Tokens live in semantic.css
  // and resolve per theme. No icon, no hint — the gradient alone is the
  // empty signal; the body header (icon-badge + title) carries identity.
  const gradient = `linear-gradient(135deg, var(--color-subsystem-${subsystemId}-from), var(--color-subsystem-${subsystemId}-to))`;
  return (
    <span
      aria-hidden="true"
      className="block h-full w-full"
      style={{ background: gradient }}
    />
  );
}


function StatusPill({ status }: { status: SubsystemStatus }) {
  if (status === "configured") {
    return (
      <span
        aria-label="Configurado"
        title="Configurado"
        className="inline-flex flex-none items-center gap-1 rounded-[8px] bg-[var(--color-status-success-bg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-status-success-text)]"
      >
        <Check size={11} strokeWidth={3} aria-hidden="true" />
        Configurado
      </span>
    );
  }
  return (
    <span
      aria-label="Pendiente"
      title="Pendiente"
      className="inline-flex flex-none items-center gap-1 rounded-[8px] bg-[var(--color-status-warning-bg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-status-warning-text)]"
    >
      <AlertTriangle size={11} strokeWidth={2.5} aria-hidden="true" />
      Pendiente
    </span>
  );
}
