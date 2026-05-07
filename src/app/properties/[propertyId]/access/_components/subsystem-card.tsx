"use client";

import { AlertTriangle, Camera, Check, Plus, Star, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useMeasure } from "@/lib/hooks/use-measure";
import type { CardRole } from "./cockpit-grid";
import { HoverCard } from "@/components/ui/hover-card";

export type SubsystemStatus = "configured" | "pending" | "empty";

export interface SubsystemSelectedItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface SubsystemCardProps {
  role: CardRole;
  cockpitId: string;
  icon: LucideIcon;
  title: string;
  selectedItems: readonly SubsystemSelectedItem[];
  primaryId: string | null;
  photoCount: number;
  videoCount?: number;
  status: SubsystemStatus;
  onExpand: () => void;
  onCollapse: () => void;
  expandedSubtitle?: string;
  children: ReactNode;
}

// Container-aware visible cap, computed from real measurements:
//  tile    = 32px (h-8 w-8)
//  gap     = 8px (gap-2)
//  +N chip = 32px min-width (only present when there's overflow)
// useMeasure observes the button's content-box (excludes padding+border), so
// `widthPx` is already the inner available width — no extra subtraction.
// The algorithm tries to fit ALL tiles first (no +N chip needed); if not, it
// computes the max number of tiles that fit alongside a +N chip:
//   visible*(TILE+GAP) + PLUS_N <= available  →  visible = floor((avail-PLUS_N)/(TILE+GAP))
// During the first paint (width === 0) we default to 4 to avoid a "0 visible"
// flash before useMeasure resolves.
function resolveStripCap(widthPx: number, totalCount: number): number {
  if (widthPx === 0) return Math.min(4, totalCount);
  const TILE = 32;
  const GAP = 8;
  const PLUS_N = 32;
  const allTilesWidth = totalCount * TILE + Math.max(0, totalCount - 1) * GAP;
  if (allTilesWidth <= widthPx) return totalCount;
  return Math.max(1, Math.floor((widthPx - PLUS_N) / (TILE + GAP)));
}

export function SubsystemCard({
  role,
  cockpitId,
  icon: Icon,
  title,
  selectedItems,
  primaryId,
  photoCount,
  videoCount = 0,
  status,
  onExpand,
  onCollapse,
  expandedSubtitle,
  children,
}: SubsystemCardProps) {
  const titleId = useId();
  const bodyId = useId();
  const [cardRef, { width }] = useMeasure<HTMLButtonElement>();

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
  const stripVisibleMax = resolveStripCap(width, ordered.length);
  const visible = ordered.slice(0, stripVisibleMax);
  const hidden = ordered.slice(stripVisibleMax);

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
            className="grid h-10 w-10 flex-none place-items-center rounded-[12px] border-[1.5px] border-[var(--color-action-primary)] bg-transparent text-[var(--color-action-primary)]"
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

  return (
    <button
      ref={cardRef}
      type="button"
      aria-expanded={false}
      aria-controls={bodyId}
      aria-labelledby={titleId}
      onClick={onExpand}
      style={cardStyle}
      className={cn(
        "group relative flex h-full w-full flex-col rounded-[20px] p-5 text-left",
        // Hover affordance — best-practice clickable card pattern: shadow
        // elevation (sm → md) + border tint shift to action-primary on the
        // empty state. NO transform on the card: any translate causes either
        // sub-pixel re-rasterization of children (title, star) or a perceived
        // "everything moved" that the user reads as decentered. Static
        // children + state-only changes signal interactivity without motion.
        "transition-[border-color,box-shadow] duration-200 ease-out",
        status === "configured"
          ? "recipe-card-configured"
          : status === "pending"
            ? "recipe-card-partial"
            : "border border-[var(--color-border-default)] bg-[var(--color-background-elevated)]",
        "hover:shadow-[var(--elevation-surface-md)]",
        status === "empty" && "hover:border-[var(--color-action-primary)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
        "min-h-[44px] h-[200px]",
      )}
    >
      {/* Status corner badge — esquina sup-der. Posición top-2 right-2 (8px
         del borde) en lugar de top-[14px]/right-[14px]: deja el badge en y:8-28
         y x: card_right-8 → -28. Combinado con pr-3 en el header row, libera
         espacio horizontal al title sin necesidad de empujar el row hacia
         abajo (preserva el spacing original del top de la card al título). */}
      {status === "configured" && (
        <span
          aria-label="Configurado"
          title="Configurado"
          className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-status-success-border)] text-white"
        >
          <Check size={12} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {status === "pending" && (
        <span
          aria-label="Falta configuración"
          title="Falta configuración"
          className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-status-warning-border)] text-white"
        >
          <AlertTriangle size={12} strokeWidth={2.5} aria-hidden="true" />
        </span>
      )}

      {/* Header — icon inline with title (flex-row). Icon: outline-only olive
         (V3). Empty state falls back to neutral muted icon. pr-3 reserva 12px
         a la derecha — suficiente para que el title container termine a la
         izquierda del badge (badge left edge = card_right-28; container right
         edge con pr-3 = card_right-32 para evitar overlap horizontal cuando
         el title hace wrap a 2 lineas).
         Title usa line-clamp-2 (2 lineas max + ellipsis) en lugar de truncate,
         con title={title} para mostrar el texto completo via tooltip nativo
         del browser al hover/long-press. Al ancho minimo de carta del nuevo
         grid policy (md: 2 cols con sidebar 256 → card ~250px), title
         disponible = 250-40(p-5)-40(icon)-12(gap)-12(pr-3) = 146px, que
         cubre "Aparcamiento" (~100px) y "Accesibilidad" (~107px) en una
         linea. Si el titulo aun asi no cabe en 2 lineas, el ellipsis y el
         tooltip nativo lo cubren. */}
      <span className="flex w-full items-center gap-3 pr-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-10 w-10 flex-none place-items-center rounded-[12px]",
            status === "empty"
              ? "border border-[var(--color-border-default)] bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]"
              : "border-[1.5px] border-[var(--color-action-primary)] bg-transparent text-[var(--color-action-primary)]",
          )}
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
      </span>

      {/* Body — icon strip OR empty hint, vertical-centered between header and footer.
         overflow-visible so the corner star (-4/-4) on the primary tile isn't clipped.
         Two render branches (single + multi unified for hover-behavior parity):
         - 0 selections: "Añade características" hint
         - ≥1 selections: strip (visible tiles + optional +N chip), wrapped in a
                          single combined HoverCard whose content lists ALL ordered
                          items with the primary row highlighted (icon + label,
                          plus a ⭐ marker on the primary). With 1 item the trigger
                          is a single tile and the popover lists that one row —
                          identical hover affordance as the multi case. */}
      <span className="mt-4 flex flex-1 flex-col justify-center">
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
        )}
      </span>

      {/* Footer — media counts. Photo + video, cada uno con su icono y label.
         Cuando un count es 0 se grisa el span (60% transparency sobre text-muted).
         Aparece en TODOS los estados (configured / pending / empty) — en empty
         ambos counts son 0 así que ambos labels salen greyed. */}
      <span className="mt-3 inline-flex min-h-[18px] items-center gap-3 text-[12px] text-[var(--color-text-muted)]">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            photoCount === 0 &&
              "text-[color-mix(in_oklch,var(--color-text-muted)_60%,transparent)]",
          )}
        >
          <Camera size={12} aria-hidden="true" />
          {photoCount > 0
            ? `${photoCount} ${photoCount === 1 ? "foto" : "fotos"}`
            : "sin fotos"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1",
            videoCount === 0 &&
              "text-[color-mix(in_oklch,var(--color-text-muted)_60%,transparent)]",
          )}
        >
          <Video size={12} aria-hidden="true" />
          {videoCount > 0
            ? `${videoCount} ${videoCount === 1 ? "vídeo" : "vídeos"}`
            : "sin vídeos"}
        </span>
      </span>
    </button>
  );
}
