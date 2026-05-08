import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ArrivalStepStatus = "done" | "cur" | "empty";

export interface ArrivalStepItem {
  id: string;
  num: string;
  title: string;
  body: ReactNode;
  status: ArrivalStepStatus;
  meta?: Array<{ icon: LucideIcon; label: string }>;
}

interface ArrivalStepsProps {
  items: ArrivalStepItem[];
  className?: string;
}

export function ArrivalSteps({ items, className }: ArrivalStepsProps) {
  return (
    <ol
      className={cn(
        "relative m-0 list-none p-0 pl-7",
        "before:absolute before:left-[10px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--color-border-default)]",
        className,
      )}
    >
      {items.map((item) => (
        <li
          key={item.id}
          data-status={item.status}
          className={cn(
            "relative mb-2 last:mb-0 rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4",
            "before:absolute before:left-[-22px] before:top-[18px] before:h-3.5 before:w-3.5 before:rounded-full before:border-2",
            "before:border-[var(--color-border-strong)] before:bg-[var(--color-background-page)]",
            "data-[status=done]:before:border-[var(--color-status-success-solid)] data-[status=done]:before:bg-[var(--color-status-success-solid)]",
            "data-[status=cur]:before:border-[var(--color-action-primary)] data-[status=cur]:before:bg-[var(--color-action-primary)]",
            "data-[status=cur]:before:shadow-[0_0_0_4px_var(--color-action-primary-subtle)]",
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {item.num}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {item.status === "done"
                ? "Listo"
                : item.status === "cur"
                  ? "En curso"
                  : "Sin redactar"}
            </span>
          </div>
          <h4 className="mt-1 text-[14px] font-semibold text-[var(--color-text-primary)]">
            {item.title}
          </h4>
          <div className="mt-1 text-[13px] leading-[1.5] text-[var(--color-text-secondary)]">
            {item.body}
          </div>
          {item.meta && item.meta.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
              {item.meta.map((m, i) => {
                const Icon = m.icon;
                return (
                  <span key={i} className="inline-flex items-center gap-1">
                    <Icon size={12} aria-hidden="true" />
                    {m.label}
                  </span>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
