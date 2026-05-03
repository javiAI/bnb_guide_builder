import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type IconBadgeTone = "neutral" | "success" | "warning" | "danger" | "primary";

const TONE_BG: Record<IconBadgeTone, string> = {
  neutral: "bg-[var(--color-background-muted)] text-[var(--color-text-primary)]",
  success: "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]",
  warning: "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]",
  danger:  "bg-[var(--color-status-error-bg)] text-[var(--color-status-error-text)]",
  primary: "bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary-subtle-fg)]",
};

interface IconBadgeProps {
  icon: LucideIcon;
  tone?: IconBadgeTone;
  iconSize?: number;
  size?: "sm" | "md";
  className?: string;
}

export function IconBadge({
  icon: Icon,
  tone = "neutral",
  iconSize = 14,
  size = "sm",
  className,
}: IconBadgeProps) {
  const sizeClass = size === "sm" ? "h-[30px] w-[30px]" : "h-[36px] w-[36px]";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-[8px]",
        sizeClass,
        TONE_BG[tone],
        className,
      )}
      aria-hidden="true"
    >
      <Icon size={iconSize} />
    </span>
  );
}
