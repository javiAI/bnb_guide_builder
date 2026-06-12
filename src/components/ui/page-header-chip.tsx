import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Chip label "bold count + pluralized noun" (e.g. "5 espacios") — the
 * count-first convention shared by the content tabs' header chips. */
export function countChipLabel(n: number, singular: string, plural: string) {
  return (
    <>
      <span className="font-semibold text-[var(--color-text-primary)]">{n}</span>{" "}
      {n === 1 ? singular : plural}
    </>
  );
}

interface PageHeaderChipProps {
  icon?: LucideIcon;
  iconSize?: number;
  label?: ReactNode;
  value?: ReactNode;
  className?: string;
}

export function PageHeaderChip({
  icon: Icon,
  iconSize = 12,
  label,
  value,
  className,
}: PageHeaderChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "rounded-full border border-[var(--color-border-default)] bg-[var(--color-background-muted)]",
        "px-[9px] py-1",
        "text-[12px] text-[var(--color-text-secondary)]",
        className,
      )}
    >
      {Icon && (
        <Icon
          size={iconSize}
          aria-hidden="true"
          className="text-[var(--color-text-muted)]"
        />
      )}
      {label && <span>{label}</span>}
      {value && (
        <span className="font-semibold text-[var(--color-text-primary)]">
          {value}
        </span>
      )}
    </span>
  );
}
