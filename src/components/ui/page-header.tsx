import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  chips?: ReactNode;
  className?: string;
  /** Bottom hairline. Ignored when `sticky` (the sticky border serves as rule). */
  showRule?: boolean;
  /**
   * Stick the header directly under the topbar on scroll — the operator-shell
   * default. A solid page background + bottom border mask content scrolling
   * underneath. No negative-margin bleed is used: the header masks the content
   * column it shares, so it is robust regardless of how deeply it is nested
   * inside the page (e.g. embedded in a client form component).
   */
  sticky?: boolean;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  chips,
  className,
  showRule = true,
  sticky = true,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        "mb-6",
        sticky &&
          "sticky top-[var(--topbar-height)] z-20 border-b border-[var(--color-border-default)] bg-[var(--color-background-page)] pb-4 pt-6",
        className,
      )}
    >
      {eyebrow && (
        <div
          className={cn(
            "inline-flex items-center gap-1.5",
            "text-[11px] font-semibold uppercase tracking-[0.08em]",
            "text-[var(--color-text-muted)]",
            "mb-2",
            "before:content-[''] before:inline-block before:h-px before:w-3 before:bg-[var(--color-border-strong)]",
          )}
        >
          {eyebrow}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <h1 className="m-0 text-[22px] font-semibold leading-[1.15] tracking-[-0.015em] text-[var(--color-text-primary)] sm:text-[28px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-[62ch] text-[13px] leading-[1.5] text-[var(--color-text-secondary)] sm:text-[14px]">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        )}
      </div>
      {chips && (
        <div className="mt-3 flex flex-wrap gap-1.5">{chips}</div>
      )}
      {!sticky && showRule && (
        <div className="mb-6 mt-5 h-px bg-[var(--color-border-default)]" aria-hidden="true" />
      )}
    </section>
  );
}
