import type { BadgeTone } from "@/lib/types";

const toneStyles: Record<BadgeTone, string> = {
  neutral:
    "bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]",
  success:
    "bg-[var(--color-success-50)] text-[var(--color-success-700)]",
  warning:
    "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]",
  danger:
    "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]",
};

interface BadgeProps {
  label: string;
  tone: BadgeTone;
}

export function Badge({ label, tone }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneStyles[tone]}`}
    >
      {label}
    </span>
  );
}
