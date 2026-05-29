"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";

// Column-header refresh affordance for parking/transit/lightbox discovery
// lists. 32×32 visual (h-8 w-8) with `recipe-icon-btn-32` baking 6px ::before
// slop so hit area reaches 44 on fine pointers (collapses to 44 visual on
// coarse). Loading state swaps RefreshCw for a spinning Loader2.

export function RefreshIconButton({
  onClick,
  disabled = false,
  loading = false,
  tooltip,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tooltip: string;
}) {
  return (
    <Tooltip text={tooltip}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip}
        className={cn(
          "recipe-icon-btn-32 inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--color-text-muted)]",
          "transition-colors duration-100 hover:bg-[var(--color-background-subtle)] hover:text-[var(--color-text-secondary)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {loading ? (
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
        ) : (
          <RefreshCw size={14} aria-hidden="true" />
        )}
      </button>
    </Tooltip>
  );
}
