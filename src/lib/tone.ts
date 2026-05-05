import type { BadgeTone } from "@/lib/types";

export const TONE_DOT_BORDER: Record<BadgeTone, string> = {
  neutral: "border-[var(--color-border-default)]",
  success: "border-[var(--color-status-success-solid)]",
  warning: "border-[var(--color-status-warning-solid)]",
  danger:  "border-[var(--color-status-error-solid)]",
};
