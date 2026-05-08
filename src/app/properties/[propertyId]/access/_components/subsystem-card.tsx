"use client";

import { AlertTriangle, Camera, Check, Plus, Star, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { CardRole } from "./cockpit-grid";
import { HoverCard } from "@/components/ui/hover-card";
import {
  MediaCarousel,
  type MediaCarouselSlide,
} from "@/components/ui/media-carousel";
import type { SubsystemSlide } from "./subsystem-card.types";
import { MultiPinMap, type MultiPinSpec } from "./multi-pin-map";

// Every subsystem resolves to one of these two — "empty" was removed in 7b
// when explicit opt-outs (`ba.no_building` / `pk.no_parking` chips + the
// `hasAccessibilityConsiderations` tri-state) made it possible for every
// card to declare configured-or-pending deterministically.
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
          kind:
            p.feeType === "free"
              ? "confirmed-free"
              : p.feeType === "paid"
                ? "confirmed-paid"
                : "confirmed-unknown",
          label: p.label,
        }));
        const anchor = s.liveAnchor;
        return {
          id: s.id,
          title: s.title,
          kind: "custom",
          render: (height: number) => (
            <div className="absolute inset-0">
              {/* Cover map is display-only: pointer events fall through to
                  the carousel so swipe to the next slide works, and
                  tap-to-expand reaches the cover button. The expanded editor
                  uses ParkingPlacesEditor with its own interactive map. */}
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

  const carouselSlides = useMemo(
    () => toCarouselSlides(slides ?? []),
    [slides],
  );
  const placeholderGradient =
    SUBSYSTEM_GRADIENTS[cockpitId] ?? SUBSYSTEM_GRADIENTS.building;
  const uploadUsageKey = `access.${cockpitId}`;

  // Active slide index — owned here so it survives the `role` flip (the
  // collapsed and active branches render two MediaCarousel instances; the
  // user expects the slide they were viewing to stay put). Clamp when the
  // slides set shrinks so we never point past the last slide.
  const [carouselIdx, setCarouselIdx] = useState(0);
  useEffect(() => {
    const max = Math.max(0, carouselSlides.length - 1);
    setCarouselIdx((prev) => Math.min(prev, max));
  }, [carouselSlides.length]);

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
        {/* Media-first layout: cover area on top, title button below.
           The carousel is display-only here (no click-through) — the title
           button is the sole collapse trigger. */}
        <MediaCarousel
          slides={carouselSlides}
          propertyId={propertyId}
          title={title}
          variant="active"
          uploadEntityType="access_method"
          uploadUsageKey={uploadUsageKey}
          placeholderGradient={placeholderGradient}
          currentIdx={carouselIdx}
          onCurrentIdxChange={setCarouselIdx}
        />
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
      <MediaCarousel
        slides={carouselSlides}
        propertyId={propertyId}
        title={title}
        variant="collapsed"
        uploadEntityType="access_method"
        uploadUsageKey={uploadUsageKey}
        placeholderGradient={placeholderGradient}
        bodyId={bodyId}
        onExpand={onExpand}
        currentIdx={carouselIdx}
        onCurrentIdxChange={setCarouselIdx}
      />

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

// ── Status pill ─────────────────────────────────────────────────────────

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
