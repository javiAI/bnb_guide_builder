import type { BadgeTone } from "@/lib/types";

export const TONE_DOT_BORDER: Record<BadgeTone, string> = {
  neutral: "border-[var(--color-border-default)]",
  success: "border-[var(--color-status-success-solid)]",
  warning: "border-[var(--color-status-warning-solid)]",
  danger:  "border-[var(--color-status-error-solid)]",
};

/** Filled dot variant — solid tone fill for timeline markers, status dots. */
export const TONE_DOT_FILL: Record<BadgeTone, string> = {
  neutral: "bg-[var(--color-text-muted)]",
  success: "bg-[var(--color-status-success-solid)]",
  warning: "bg-[var(--color-status-warning-solid)]",
  danger:  "bg-[var(--color-status-error-solid)]",
};
