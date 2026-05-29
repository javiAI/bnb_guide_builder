"use client";

import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Collapsible bordered section header used by the access cockpit blocks
// (parking, intercity transit, last-mile). One shared shell keeps the
// chevron, icon, label and summary uniform across all three surfaces.

interface SectionShellProps {
  icon: LucideIcon;
  label: string;
  summary: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Optional action node rendered on the right of the header (e.g. a refresh
   * icon-button next to a TransitSection title). */
  action?: ReactNode;
  children: ReactNode;
}

export function SectionShell({
  icon: Icon,
  label,
  summary,
  collapsed,
  onToggleCollapsed,
  action,
  children,
}: SectionShellProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-1.5">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className="inline-flex min-h-[32px] flex-1 items-center gap-2 rounded-[var(--radius-sm)] text-left text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
        >
          <ChevronDown
            size={14}
            strokeWidth={2}
            aria-hidden="true"
            className={cn(
              "transition-transform duration-150",
              collapsed && "-rotate-90",
            )}
          />
          <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
          <h4 className="text-[12px] font-semibold uppercase tracking-[0.06em]">
            {label}
          </h4>
          {summary && (
            <span className="cockpit-section-summary ml-1 truncate text-[11px] font-normal normal-case tracking-normal text-[var(--color-text-subtle)]">
              {summary}
            </span>
          )}
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {!collapsed && children}
    </section>
  );
}
