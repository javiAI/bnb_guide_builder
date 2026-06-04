"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./tooltip";

interface CollapsibleSectionProps {
  title: React.ReactNode;
  selectedLabel?: string | null;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** Optional action rendered outside the toggle button (e.g. edit icon). Must not contain interactive elements that conflict with the outer button. */
  headerAction?: React.ReactNode;
}

function SelectionBadge({ label }: { label: string }) {
  const parts = label.split(", ").map((s) => s.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return (
      <span className="rounded-full bg-[var(--color-interactive-selected)] px-3 py-0.5 text-xs font-medium text-[var(--color-interactive-selected-fg)]">
        {label}
      </span>
    );
  }

  return (
    <Tooltip text={parts.join(", ")}>
      <span className="inline-flex items-center gap-1">
        <span className="rounded-full bg-[var(--color-interactive-selected)] px-3 py-0.5 text-xs font-medium text-[var(--color-interactive-selected-fg)]">
          {parts[0]}
        </span>
        <span className="rounded-full bg-[var(--color-background-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
          +{parts.length - 1}
        </span>
      </span>
    </Tooltip>
  );
}

export function CollapsibleSection({
  title,
  selectedLabel,
  expanded,
  onToggle,
  children,
  headerAction,
}: CollapsibleSectionProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border-2 border-[var(--color-border-default)] bg-[var(--color-background-elevated)]">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 p-4 text-left"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="shrink-0 text-sm font-semibold text-[var(--color-text-primary)]">{title}</span>
            <div className="flex min-w-0 items-center gap-2">
              {!expanded && selectedLabel && <SelectionBadge label={selectedLabel} />}
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={cn(
                  "shrink-0 text-[var(--color-text-muted)] transition-transform duration-300 ease-out motion-reduce:transition-none",
                  !expanded && "-rotate-90",
                )}
              />
            </div>
          </div>
        </button>
        {headerAction && <div className="flex-shrink-0 pr-3">{headerAction}</div>}
      </div>

      {/* Smooth collapse via grid-template-rows 0fr↔1fr (animates real height,
          no max-height jank). Content stays mounted but is `inert` + faded out
          when collapsed so it leaves the tab order and a11y tree. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden" inert={!expanded}>
          <div
            className={cn(
              "px-4 pb-4 transition-opacity duration-200 motion-reduce:transition-none",
              expanded ? "opacity-100" : "opacity-0",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
