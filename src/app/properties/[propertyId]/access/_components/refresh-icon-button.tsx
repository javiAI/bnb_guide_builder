"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";

// Column-header refresh affordance for parking/transit/lightbox discovery
// lists. 24×24 visual (smaller than the standard IconButton tokens) because
// it lives inline with a count and a 24-tall RadiusInput. Loading state
// swaps RefreshCw for a spinning Loader2.

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
          "inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--color-text-muted)]",
          "transition-colors duration-100 hover:bg-[var(--color-background-subtle)] hover:text-[var(--color-text-secondary)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {loading ? (
          <Loader2 size={12} aria-hidden="true" className="animate-spin" />
        ) : (
          <RefreshCw size={12} aria-hidden="true" />
        )}
      </button>
    </Tooltip>
  );
}
