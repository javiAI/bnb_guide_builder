"use client";

import { useRef, useEffect, useState } from "react";

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
  const [hovered, setHovered] = useState(false);

  const parts = label.split(", ").map((s) => s.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return (
      <span className="rounded-full bg-[var(--color-interactive-selected)] px-3 py-0.5 text-xs font-medium text-[var(--color-interactive-selected-fg)]">
        {label}
      </span>
    );
  }

  return (
    <span
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="rounded-full bg-[var(--color-interactive-selected)] px-3 py-0.5 text-xs font-medium text-[var(--color-interactive-selected-fg)]">
        {parts[0]}
      </span>
      <span className="rounded-full bg-[var(--color-background-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
        +{parts.length - 1}
      </span>
      {hovered && (
        <span
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-[var(--tooltip-radius)] shadow-[var(--tooltip-shadow)]"
          style={{
            background: "var(--tooltip-bg)",
            color: "var(--tooltip-fg)",
            padding: "var(--tooltip-padding)",
          }}
        >
          <ul className="space-y-1 text-xs">
            {parts.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </span>
      )}
    </span>
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
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(expanded ? "auto" : 0);
  const [visible, setVisible] = useState(expanded);

  useEffect(() => {
    let expandTimer: ReturnType<typeof setTimeout> | undefined;
    let collapseTimer: ReturnType<typeof setTimeout> | undefined;
    let rafId: number | undefined;

    if (expanded) {
      setVisible(true);
      rafId = requestAnimationFrame(() => {
        if (contentRef.current) {
          setHeight(contentRef.current.scrollHeight);
          expandTimer = setTimeout(() => setHeight("auto"), 300);
        }
      });
    } else {
      if (contentRef.current) {
        setHeight(contentRef.current.scrollHeight);
        rafId = requestAnimationFrame(() => setHeight(0));
      }
      collapseTimer = setTimeout(() => setVisible(false), 300);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(expandTimer);
      clearTimeout(collapseTimer);
    };
  }, [expanded]);

  return (
    <div className="rounded-[var(--radius-lg)] border-2 transition-colors duration-200 border-[var(--color-border-default)] bg-[var(--color-background-elevated)]">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 p-4 text-left min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)] shrink-0">{title}</span>
            <div className="flex items-center gap-2 min-w-0">
              {!expanded && selectedLabel && (
                <SelectionBadge label={selectedLabel} />
              )}
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                {expanded ? "▲" : "▼"}
              </span>
            </div>
          </div>
        </button>
        {headerAction && (
          <div className="flex-shrink-0 pr-3">
            {headerAction}
          </div>
        )}
      </div>

      <div
        ref={contentRef}
        style={{ maxHeight: height === "auto" ? "none" : `${height}px` }}
        className="overflow-hidden transition-all duration-300 ease-in-out"
      >
        {visible && (
          <div className="px-4 pb-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
