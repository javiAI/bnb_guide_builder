import type { BadgeTone } from "@/lib/types";

export const TONE_DOT_BORDER: Record<BadgeTone, string> = {
  neutral: "border-[var(--color-border-default)]",
  success: "border-[var(--color-status-success-solid)]",
  warning: "border-[var(--color-status-warning-solid)]",
  danger:  "border-[var(--color-status-error-solid)]",
};

export const TONE_TEXT: Record<BadgeTone, string> = {
  neutral: "text-[var(--color-text-secondary)]",
  success: "text-[var(--color-status-success-text)]",
  warning: "text-[var(--color-status-warning-text)]",
  danger:  "text-[var(--color-status-error-text)]",
};

export const TONE_BG_SOFT: Record<BadgeTone, string> = {
  neutral: "bg-[var(--color-background-muted)]",
  success: "bg-[var(--color-status-success-bg)]",
  warning: "bg-[var(--color-status-warning-bg)]",
  danger:  "bg-[var(--color-status-error-bg)]",
};

export const TONE_BORDER: Record<BadgeTone, string> = {
  neutral: "border-[var(--color-border-default)]",
  success: "border-[var(--color-status-success-border)]",
  warning: "border-[var(--color-status-warning-border)]",
  danger:  "border-[var(--color-status-error-border)]",
};
