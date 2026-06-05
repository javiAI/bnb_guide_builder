"use client";

import { cn } from "@/lib/cn";

/**
 * iOS-style segmented control for short single-select enums (space editor:
 * tipo de fuegos, tipo de sofá, orientación…). A muted track with pill segments
 * — active = elevated surface + accent text. Segments are 28px visual (compact,
 * matches the design mock) and reach a 44 hit area via `recipe-chip-28` (growing
 * to 44 visual on coarse pointers). Clicking the active segment clears it
 * (single-select, nullable). The track wraps for longer option sets.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { id: string; label: string }[];
  value: string | null;
  onChange: (next: string | null) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-[10px] bg-[var(--color-background-muted)] p-1"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : opt.id)}
            className={cn(
              "recipe-chip-28 inline-flex h-7 items-center rounded-[7px] px-3 text-xs transition-colors",
              active
                ? "bg-[var(--color-background-elevated)] font-semibold text-[var(--color-action-primary)] shadow-[var(--elevation-surface-sm)]"
                : "font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
