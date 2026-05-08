import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface NumberedSectionProps {
  number: string;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function NumberedSection({
  number,
  title,
  action,
  children,
  className,
}: NumberedSectionProps) {
  return (
    <section className={cn("mb-8", className)}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          <span
            aria-hidden="true"
            className="grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-[var(--color-background-muted)] text-[10px] font-bold tracking-normal text-[var(--color-text-secondary)]"
          >
            {number}
          </span>
          {title}
        </h2>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}
