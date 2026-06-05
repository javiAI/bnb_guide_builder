"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Compact selectable chip for dense operator editors (space features, short
 * enums, multiselects). 28px visual (Access-sized) + `recipe-chip-28` slop =
 * 44 hit area on fine pointers, growing to 44 visual on coarse. Active = solid
 * accent with a check; inactive = outline. Single-select groups (radio-like)
 * pass `hideCheck` off and just flip which chip is active; multiselect groups
 * toggle each independently.
 */
export function ToggleChip({
  active,
  onToggle,
  children,
  hideCheck = false,
  ariaLabel,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Suppress the check glyph (e.g. single-select segments where the fill is enough). */
  hideCheck?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={cn(
        "recipe-chip-28 inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs transition-colors",
        active
          ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] font-semibold text-[var(--color-action-primary-fg)]"
          : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-background-subtle)]",
        className,
      )}
    >
      {active && !hideCheck && <Check size={13} aria-hidden="true" className="-ml-0.5 flex-none" />}
      {children}
    </button>
  );
}
