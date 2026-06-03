"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Shared presentation for the `layout="grid"` tiles of RadioCardGroup and
// CheckboxCardGroup. The groups own only the input element (radio vs checkbox)
// + selection state; the tile chrome (border, selected tint, check mark, label,
// description, recommended badge) lives here so a visual tweak lands once.

export function RecommendedBadge() {
  return (
    <span className="ml-2 inline-block rounded-full bg-[var(--color-interactive-selected)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-interactive-selected-fg)]">
      Recomendado
    </span>
  );
}

interface OptionTileProps {
  selected: boolean;
  label: string;
  description: string;
  recommended?: boolean;
  showRecommended: boolean;
  /** The visually-hidden `<input>` (radio or checkbox) that drives selection. */
  children: ReactNode;
  /**
   * Inline detail rendered *inside* the tile when selected (e.g. the "Otro"
   * name/description form). It lives as a sibling of the `<label>` — never
   * inside it — so clicking the form's own inputs doesn't toggle selection.
   * When present and selected, the tile spans the full grid width to give the
   * form room. The grow/shrink is animated by the caller via withViewTransition.
   */
  expandedContent?: ReactNode;
}

export function OptionTile({ selected, label, description, recommended, showRecommended, children, expandedContent }: OptionTileProps) {
  const expandable = expandedContent != null;
  return (
    <div
      className={cn(
        "relative min-h-[44px] rounded-[var(--radius-lg)] border-2 transition-colors focus-within:ring-2 focus-within:ring-[var(--color-border-focus)]",
        selected
          ? "border-[var(--color-action-primary)] bg-[var(--color-interactive-selected)]"
          : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-border-emphasis)]",
        expandable && selected && "col-[1/-1]",
      )}
    >
      <label className="flex cursor-pointer flex-col gap-0.5 p-3">
        {children}
        {selected && (
          <Check size={16} aria-hidden="true" className="absolute right-2 top-2 text-[var(--color-action-primary)]" />
        )}
        <span className="block pr-5 text-sm font-medium text-[var(--color-text-primary)]">
          {label}
          {showRecommended && recommended && <RecommendedBadge />}
        </span>
        {description && (
          <span className="block text-xs leading-snug text-[var(--color-text-muted)]">{description}</span>
        )}
      </label>
      {expandable && selected && (
        <div className="border-t border-[var(--color-border-default)] px-3 pb-3 pt-3">{expandedContent}</div>
      )}
    </div>
  );
}
