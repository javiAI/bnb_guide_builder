"use client";

import { useTransition } from "react";
import { ChevronDown, StickyNote, Camera } from "lucide-react";
import { toggleAmenityAction } from "@/lib/actions/editor.actions";
import { cn } from "@/lib/cn";
import type { EnrichedAmenityItem } from "../page";
import { TIER_META } from "./eq-tier";
import { LcCheckbox } from "./lc-checkbox";

/** Presence indicator (note / photo) — informational, not interactive. */
function EqAttach({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof StickyNote;
  label: string;
  tone: "note" | "photo";
}) {
  return (
    <span
      className={cn(
        "grid h-6 w-6 place-items-center rounded-[6px]",
        tone === "note"
          ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent-fg)]"
          : "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-icon)]",
      )}
    >
      <Icon size={12} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Single source of truth for "does this row expose an inline detail panel".
 * Consumed by the row (to render the expander affordance) and by `EqGroupBand`
 * (to mount the panel) — keeping the predicate here prevents the two from
 * drifting out of sync, which would surface a chevron with no panel behind it.
 */
export function canExpandItem(item: EnrichedAmenityItem): boolean {
  return item.enabled && item.hasSubtype && item.subtypeFields.length > 0;
}

interface EqItemRowProps {
  propertyId: string;
  item: EnrichedAmenityItem;
  spaceId: string | null;
  isExpanded: boolean;
  onExpand: (key: string | null) => void;
  /** Stable expand key for this (item, space) — owned by the parent band. */
  expandKey: string;
  /** id of the inline detail panel this row controls (when expandable). */
  panelId: string;
}

export function EqItemRow({
  propertyId,
  item,
  spaceId,
  isExpanded,
  onExpand,
  expandKey,
  panelId,
}: EqItemRowProps) {
  const [isPending, startTransition] = useTransition();
  const canExpand = canExpandItem(item);
  const tier = TIER_META[item.importanceLevel];

  function handleToggle() {
    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("amenityKey", item.id);
    formData.set("enabled", String(!item.enabled));
    if (spaceId) formData.set("spaceId", spaceId);

    startTransition(async () => {
      await toggleAmenityAction(null, formData);
    });
    // Collapse the detail panel when the item is turned off.
    if (item.enabled) onExpand(null);
  }

  const nameClass = cn(
    "text-[13.5px] font-medium",
    item.enabled
      ? "text-[var(--color-text-primary)]"
      : "text-[var(--color-text-secondary)]",
  );
  const customBadge = item.isCustomInstance ? (
    <span
      title="Instancia personalizada"
      className="ml-2 rounded-full bg-[var(--color-action-primary-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-action-primary-subtle-fg)] align-middle"
    >
      Personalizado
    </span>
  ) : null;

  // Label + optional description — identical in the expandable and static
  // layouts, so it lives here once and is slotted into both branches below.
  const nameBlock = (
    <>
      <span className={nameClass}>
        {item.label}
        {customBadge}
      </span>
      {item.description && (
        <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--color-text-muted)]">
          {item.description}
        </span>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-l-2 border-b-[var(--color-border-subtle)] pl-3 transition-colors",
        "last:border-b-0 hover:bg-[var(--color-interactive-hover)]",
        tier.borderClass,
        isPending && "opacity-60",
      )}
    >
      <span className="sr-only">{tier.label}</span>
      <LcCheckbox
        checked={item.enabled}
        onToggle={handleToggle}
        disabled={isPending}
        label={item.label}
      />

      {canExpand ? (
        <button
          type="button"
          onClick={() => onExpand(isExpanded ? null : expandKey)}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] rounded-[6px]"
        >
          <span className="min-w-0 flex-1">{nameBlock}</span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn(
              "shrink-0 text-[var(--color-text-muted)] transition-transform",
              isExpanded && "rotate-180",
            )}
          />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col justify-center py-2.5">
          {nameBlock}
        </div>
      )}

      {(item.hasNote || item.hasPhoto) && (
        <div className="flex shrink-0 items-center gap-1.5 self-center pr-1">
          {item.hasNote && (
            <EqAttach icon={StickyNote} label="Con nota" tone="note" />
          )}
          {item.hasPhoto && (
            <EqAttach icon={Camera} label="Con foto" tone="photo" />
          )}
        </div>
      )}
    </div>
  );
}
