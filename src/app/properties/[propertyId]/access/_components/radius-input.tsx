"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_DISCOVERY_RADIUS_M } from "@/lib/services/arrival-discovery.service";

// Free-entry radius input (meters). Rendered next to each section's refresh
// button so the operator sees the search scope they're about to widen/narrow
// before re-running discovery. Source of truth lives in access-form; this
// control just reads + writes that single shared value.
//
// Min 50 m guards against typos (radius <50 m returns nothing useful) without
// preventing intentional small scopes (e.g. 100 m for a single block). The
// server action clamps to `[1, MAX_DISCOVERY_RADIUS_M]` at the boundary.

export const RADIUS_MIN_M = 50;

export function RadiusInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (meters: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = useCallback(() => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(
      RADIUS_MIN_M,
      Math.min(MAX_DISCOVERY_RADIUS_M, Math.round(parsed)),
    );
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  }, [draft, value, onChange]);

  return (
    <div className="relative inline-flex items-center">
      <input
        type="number"
        inputMode="numeric"
        min={RADIUS_MIN_M}
        max={MAX_DISCOVERY_RADIUS_M}
        step={50}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        aria-label="Radio de búsqueda en metros"
        className="h-6 w-[68px] rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] py-0 pl-1.5 pr-5 text-right text-[11px] font-medium tabular-nums text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 text-[10px] font-medium text-[var(--color-text-subtle)]"
      >
        m
      </span>
    </div>
  );
}
