"use client";

import type { ReactNode } from "react";

/** Shared list primitives for the parking + transit "Añadidos / Sugeridos"
 * columns inside the access cockpit. Header layout, label typography, count
 * pill and action slot are identical across both surfaces — they live here
 * so the two cockpit lists stay in lockstep. */
export function CockpitListColumn({
  label,
  count,
  action,
  children,
}: {
  label: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
          {label}
        </span>
        <span className="rounded-full bg-[var(--color-background-subtle)] px-1.5 py-px text-[10px] font-medium text-[var(--color-text-secondary)]">
          {count}
        </span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </div>
  );
}

export function CockpitEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-subtle)] px-3 py-3 text-[12px] text-[var(--color-text-secondary)]">
      {children}
    </div>
  );
}

export function CockpitListContainer({ children }: { children: ReactNode }) {
  return (
    <div className="recipe-cockpit-list-container">
      <div className="recipe-cockpit-list-grid">{children}</div>
    </div>
  );
}
