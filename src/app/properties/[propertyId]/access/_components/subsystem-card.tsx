"use client";

import { AlertTriangle, Camera, Check, Star, Video } from "lucide-react";
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
  emptyHintIcon: LucideIcon;
  emptyHintLabel: string;
  onExpand: () => void;
  onCollapse: () => void;
  expandedSubtitle?: string;
  children: ReactNode;
}

// Container-aware visible cap. While the first measurement is pending
// (width === 0) we default to 4 so the card doesn't flash "0 visible" pre-paint.
function resolveStripCap(widthPx: number): number {
  if (widthPx === 0 || widthPx >= 280) return 4;
  if (widthPx >= 220) return 3;
  return 2;
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
  emptyHintIcon: EmptyIcon,
  emptyHintLabel,
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
  const stripVisibleMax = resolveStripCap(width);
  const visible = ordered.slice(0, stripVisibleMax);
  const hidden = ordered.slice(stripVisibleMax);

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
        "transition-[border-color,box-shadow,transform] duration-200 ease-out",
        status === "configured"
          ? "recipe-card-configured"
          : status === "pending"
            ? "recipe-card-partial"
            : "border border-[var(--color-border-default)] bg-[var(--color-background-elevated)]",
        "hover:shadow-[var(--elevation-surface-md)] hover:-translate-y-[1px]",
        status === "empty" && "hover:border-[var(--color-border-strong)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
        "min-h-[44px] h-[200px]",
      )}
    >
      {/* Status corner badge — top-right of the card. ✓ for configured (success
         tone), ⚠ for partial/pending (warning tone). Empty state has no badge.
         White SVG over solid status border colour for legibility on tinted bg. */}
      {status === "configured" && (
        <span
          aria-label="Configurado"
          title="Configurado"
          className="absolute right-[14px] top-[14px] grid h-5 w-5 place-items-center rounded-full bg-[var(--color-status-success-border)] text-white"
        >
          <Check size={12} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {status === "pending" && (
        <span
          aria-label="Falta configuración"
          title="Falta configuración"
          className="absolute right-[14px] top-[14px] grid h-5 w-5 place-items-center rounded-full bg-[var(--color-status-warning-border)] text-white"
        >
          <AlertTriangle size={12} strokeWidth={2.5} aria-hidden="true" />
        </span>
      )}

      {/* Header — icon inline with title (flex-row). Icon: outline-only olive
         (V3). Empty state falls back to neutral muted icon. pr-9 reserves room
         for the corner badge so the title can't collide with it. */}
      <span className="flex w-full items-center gap-3 pr-9">
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
          className="block min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-[var(--color-text-primary)]"
        >
          {title}
        </span>
      </span>

      {/* Body — icon strip OR empty hint, vertical-centered between header and footer.
         overflow-visible so the corner star (-3/-3) on the primary tile isn't clipped. */}
      <span className="mt-4 flex flex-1 flex-col justify-center">
        {visible.length > 0 ? (
          <span className="flex flex-nowrap items-center gap-2 overflow-visible">
            {visible.map((item) => {
              const isPrimary = item.id === primaryId;
              const ItemIcon = item.icon;
              return (
                <HoverCard
                  key={item.id}
                  trigger={
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
                          className="absolute -right-[3px] -top-[3px] grid h-[11px] w-[11px] place-items-center rounded-full bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] outline outline-2 outline-[var(--color-background-elevated)]"
                        >
                          <Star size={7} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                  }
                  content={
                    <span className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-[var(--color-text-primary)]">
                      <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[6px] bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]">
                        <ItemIcon size={12} aria-hidden="true" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                  }
                />
              );
            })}
            {hidden.length > 0 && (
              <HoverCard
                trigger={
                  <span
                    role="img"
                    aria-label={`${hidden.length} más`}
                    className="grid h-8 min-w-[32px] flex-none place-items-center rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] px-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)]"
                  >
                    +{hidden.length}
                  </span>
                }
                content={
                  <ul className="flex flex-col">
                    {hidden.map((it, i) => {
                      const ItemIcon = it.icon;
                      return (
                        <li
                          key={it.id}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-2 text-[13px]",
                            i > 0 &&
                              "border-t border-[color-mix(in_oklch,var(--color-border-default)_60%,transparent)]",
                          )}
                        >
                          <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[6px] bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]">
                            <ItemIcon size={12} aria-hidden="true" />
                          </span>
                          <span className="truncate">{it.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                }
              />
            )}
          </span>
        ) : (
          <span className="inline-flex max-w-full items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
            <EmptyIcon size={14} aria-hidden="true" className="flex-none" />
            <span className="truncate">{emptyHintLabel}</span>
          </span>
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
