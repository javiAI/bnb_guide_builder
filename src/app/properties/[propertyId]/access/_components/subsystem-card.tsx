"use client";

import { Camera, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { CardRole } from "./cockpit-grid";
import { HoverReveal } from "./hover-reveal";

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
  status: SubsystemStatus;
  emptyHintIcon: LucideIcon;
  emptyHintLabel: string;
  onExpand: () => void;
  onCollapse: () => void;
  expandedSubtitle?: string;
  children: ReactNode;
}

// Visible icon strip cap. Beyond this, the overflow renders a "+N" tile that
// reveals the hidden items via HoverReveal. Cards are 200px tall × roughly the
// column width — 4 fits comfortably at xl, 3 at sm-lg.
const STRIP_VISIBLE_MAX = 4;

export function SubsystemCard({
  role,
  cockpitId,
  icon: Icon,
  title,
  selectedItems,
  primaryId,
  photoCount,
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
  const visible = ordered.slice(0, STRIP_VISIBLE_MAX);
  const hidden = ordered.slice(STRIP_VISIBLE_MAX);

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
            "group flex w-full items-start gap-4 p-5 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
            "hover:bg-[var(--color-background-muted)]/40",
          )}
        >
          <span
            aria-hidden="true"
            className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]"
          >
            <Icon size={20} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex min-w-0 items-center gap-2">
              <span
                id={titleId}
                className="truncate text-[16px] font-semibold leading-tight text-[var(--color-text-primary)]"
              >
                {title}
              </span>
              {status === "configured" && (
                <CheckCircle2
                  size={16}
                  aria-label="Configurado"
                  className="flex-none text-[var(--color-status-success-text)]"
                />
              )}
              {status === "pending" && (
                <span className="sr-only">Por completar</span>
              )}
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
      type="button"
      aria-expanded={false}
      aria-controls={bodyId}
      aria-labelledby={titleId}
      onClick={onExpand}
      style={cardStyle}
      className={cn(
        "group flex h-full w-full flex-col rounded-[20px] border bg-[var(--color-background-elevated)] p-5 text-left",
        "transition-[border-color,box-shadow,transform] duration-200 ease-out",
        status === "pending"
          ? "border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)]"
          : "border-[var(--color-border-default)]",
        "hover:border-[var(--color-border-strong)] hover:shadow-[var(--elevation-surface-md)] hover:-translate-y-[1px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
        "min-h-[44px] h-[200px]",
      )}
    >
      {/* Header — icon row, then title row.
         Status: configured shows a small CheckCircle2 next to the title;
         partial tints the whole card via border + bg (set above); empty stays neutral. */}
      <span className="flex w-full flex-col gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]"
        >
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            id={titleId}
            className="block min-w-0 flex-1 text-[15px] font-semibold leading-tight text-[var(--color-text-primary)]"
          >
            {title}
          </span>
          {status === "configured" && (
            <CheckCircle2
              size={16}
              aria-label="Configurado"
              className="flex-none text-[var(--color-status-success-text)]"
            />
          )}
          {status === "pending" && <span className="sr-only">Por completar</span>}
        </span>
      </span>

      {/* Body — icon strip OR empty hint, vertical-centered between header and footer */}
      <span className="mt-4 flex flex-1 flex-col justify-center">
        {visible.length > 0 ? (
          <span className="flex flex-wrap items-center gap-2">
            {visible.map((item) => {
              const isPrimary = item.id === primaryId;
              const ItemIcon = item.icon;
              return (
                <span
                  key={item.id}
                  title={item.label}
                  aria-label={item.label}
                  className={cn(
                    "grid h-8 w-8 flex-none place-items-center rounded-[8px] border",
                    isPrimary
                      ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary)]"
                      : "border-[var(--color-border-default)] bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]",
                  )}
                >
                  <ItemIcon size={14} aria-hidden="true" />
                </span>
              );
            })}
            {hidden.length > 0 && (
              <HoverReveal
                trigger={
                  <span
                    aria-label={`${hidden.length} más`}
                    className="grid h-8 min-w-[32px] place-items-center rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] px-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)]"
                  >
                    +{hidden.length}
                  </span>
                }
                content={
                  <ul className="flex flex-col gap-1">
                    {hidden.map((it) => {
                      const ItemIcon = it.icon;
                      return (
                        <li key={it.id} className="flex items-center gap-2">
                          <ItemIcon
                            size={12}
                            aria-hidden="true"
                            className="flex-none text-[var(--color-text-secondary)]"
                          />
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

      {/* Footer — photo count, anchored at bottom */}
      <span className="mt-3 inline-flex min-h-[16px] items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
        {photoCount > 0 ? (
          <>
            <Camera size={12} aria-hidden="true" />
            {photoCount} {photoCount === 1 ? "foto" : "fotos"}
          </>
        ) : null}
      </span>
    </button>
  );
}
