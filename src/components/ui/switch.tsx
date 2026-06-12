"use client";

import { cn } from "@/lib/cn";

/**
 * Canonical on/off switch (charter 16I) — replaces the per-file hand-rolled
 * track+thumb pairs (policies, space systems coverage). The <button> is a
 * 44px hit area centered on the visual track; `role="switch"` announces state.
 */
export function Switch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  size = "md",
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  /** md = 44×24 track (forms); sm = 38×22 (dense card rows). */
  size?: "sm" | "md";
  className?: string;
}) {
  const track = size === "md" ? "h-6 w-11" : "h-[22px] w-[38px]";
  const thumb = size === "md" ? "h-4 w-4" : "h-[18px] w-[18px]";
  const travel = size === "md" ? "translate-x-5" : "translate-x-4";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex min-h-[44px] min-w-[44px] flex-none items-center justify-center disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex flex-none items-center rounded-full p-0.5 transition-colors",
          track,
          checked ? "bg-[var(--color-action-primary)]" : "bg-[var(--color-border-strong)]",
        )}
      >
        <span
          className={cn(
            "inline-block rounded-full bg-white shadow-sm transition-transform",
            thumb,
            checked ? travel : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}
