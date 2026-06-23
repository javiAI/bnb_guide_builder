"use client";

import { Search, Eye, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface AmenitiesToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onlyConfigured: boolean;
  onToggleOnlyConfigured: () => void;
  onAdd: () => void;
}

// NOTE: the 44-hit-area + button-shape tokens are written inline as string
// literals (not hoisted to a const) so the static touch-target gate in
// component-invariants.test.ts can see them — it cannot follow imported
// constants.

export function AmenitiesToolbar({
  query,
  onQueryChange,
  onlyConfigured,
  onToggleOnlyConfigured,
  onAdd,
}: AmenitiesToolbarProps) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5">
      <div className="flex h-11 min-w-[180px] max-w-[380px] flex-1 items-center gap-2 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] px-3 focus-within:border-[var(--color-border-focus)] focus-within:ring-2 focus-within:ring-[var(--color-border-focus)]">
        <Search
          size={14}
          aria-hidden="true"
          className="shrink-0 text-[var(--color-text-muted)]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar equipamiento…"
          aria-label="Buscar equipamiento"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none"
        />
      </div>

      <button
        type="button"
        aria-pressed={onlyConfigured}
        onClick={onToggleOnlyConfigured}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border px-3 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
          onlyConfigured
            ? "border-[var(--color-interactive-selected-border)] bg-[var(--color-interactive-selected)] text-[var(--color-interactive-selected-fg)]"
            : "border-[var(--color-border-default)] bg-[var(--color-background-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)]",
        )}
      >
        <Eye size={13} aria-hidden="true" />
        Solo disponibles
      </button>

      <button
        type="button"
        onClick={onAdd}
        className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
      >
        <Plus size={13} aria-hidden="true" />
        Añadir equipamiento
      </button>
    </div>
  );
}
