import type { BadgeTone } from "@/lib/types";
import { cn } from "@/lib/cn";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]",
  success: "bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]",
  warning: "bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]",
  danger:  "bg-[var(--badge-error-bg)] text-[var(--badge-error-fg)]",
};

interface BadgeProps {
  label: string;
  tone: BadgeTone;
  className?: string;
}

export function Badge({ label, tone, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--badge-radius)]",
        "px-[var(--badge-padding-x)] py-[var(--badge-padding-y)]",
        "text-[length:var(--badge-font-size)] font-[number:var(--badge-font-weight)]",
        toneStyles[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
