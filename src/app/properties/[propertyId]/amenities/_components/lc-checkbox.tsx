"use client";

import { cn } from "@/lib/cn";

interface LcCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Accessible name — the amenity label, e.g. "Cafetera de cápsulas". */
  label: string;
}

/**
 * Equipamiento availability checkbox (kit `lc`). A 22px rounded box centered in
 * a 44×44 hit target. The outer <button> carries the 44 hit area (no surface of
 * its own, so the touch-target gate treats it as a non-button-shaped 44 control);
 * the inner decorative <span> is the visible box.
 *
 * `role="checkbox"` + `aria-checked` mirrors the kit's semantics; a native
 * <button> handles Enter/Space, firing onToggle.
 */
export function LcCheckbox({ checked, onToggle, disabled, label }: LcCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "group/lc grid h-11 w-11 shrink-0 place-items-center rounded-[10px] transition-colors",
        "hover:bg-[var(--color-interactive-hover)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid h-[22px] w-[22px] place-items-center rounded-[7px] border-[1.5px] transition-colors",
          checked
            ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)]"
            : "border-[var(--color-border-strong)] bg-[var(--color-background-surface)] group-hover/lc:border-[var(--color-border-emphasis)]",
        )}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
            <polyline
              points="3,8 7,12 13,4"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
