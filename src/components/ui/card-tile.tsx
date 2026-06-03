"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

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
}

export function OptionTile({ selected, label, description, recommended, showRecommended, children }: OptionTileProps) {
  return (
    <label
      className={`relative flex min-h-[44px] cursor-pointer flex-col gap-0.5 rounded-[var(--radius-lg)] border-2 p-3 transition-colors focus-within:ring-2 focus-within:ring-[var(--color-border-focus)] ${
        selected
          ? "border-[var(--color-action-primary)] bg-[var(--color-interactive-selected)]"
          : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-border-emphasis)]"
      }`}
    >
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
  );
}
