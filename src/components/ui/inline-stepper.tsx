"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

const STEPPER_BTN_CLS =
  "recipe-icon-btn-32 grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] disabled:opacity-40";

/**
 * Compact minus/value/plus stepper for dense editors (bed quantity, integer
 * feature counts, modal capacities). 32px buttons + `recipe-icon-btn-32` slop
 * = 44 hit area; one silhouette everywhere instead of per-file variants.
 */
export function InlineStepper({
  value,
  min = 0,
  max,
  onChange,
  label,
  format,
  wrap = false,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  /** Accessible subject for the buttons: "Reducir/Aumentar {label}". */
  label: string;
  /** Optional value formatter (e.g. slot → "22:00", kg → "15 kg"). */
  format?: (n: number) => string;
  /** Cycle past the bounds (23:30 → 00:00). Requires BOTH min and max set;
   * otherwise it no-ops and the bounds disable the buttons as usual. */
  wrap?: boolean;
  className?: string;
}) {
  const canWrap = wrap && max != null;
  const dec = () => onChange(canWrap && value <= min ? max! : Math.max(min, value - 1));
  const inc = () =>
    onChange(
      canWrap && max != null && value >= max ? min : max == null ? value + 1 : Math.min(max, value + 1),
    );
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        disabled={!canWrap && value <= min}
        onClick={dec}
        aria-label={`Reducir ${label}`}
        className={STEPPER_BTN_CLS}
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <span
        className={cn(
          "text-center text-sm font-semibold text-[var(--color-text-primary)]",
          format ? "min-w-[3.25rem]" : "min-w-[1.75rem]",
        )}
      >
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        disabled={!canWrap && max != null && value >= max}
        onClick={inc}
        aria-label={`Aumentar ${label}`}
        className={STEPPER_BTN_CLS}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
