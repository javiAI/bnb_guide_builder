"use client";

import { Loader2, Plus } from "lucide-react";

export interface AddEntityChipGroup {
  /** Group header ("Obligatorios", "Recomendados"…); hidden when only one group. */
  label: string | null;
  items: { id: string; label: string }[];
}

/**
 * One-click entity creation, the canonical `02 Añadir` control (charter 16I):
 * a grid of dashed type-chips grouped by urgency. Click = create at once with
 * a server-derived name — no form, no dropdown; rename happens inline on the
 * new card. Presentational: the caller owns the action dispatch and threads
 * back pending/error state (see AddSpaceChips for the canonical wiring).
 */
export function AddEntityChips({
  groups,
  onAdd,
  busy = false,
  pendingId = null,
  error,
  hint,
}: {
  groups: AddEntityChipGroup[];
  onAdd: (id: string) => void;
  /** Disables every chip while a creation is in flight. */
  busy?: boolean;
  /** Which chip fired — shows the spinner on it. */
  pendingId?: string | null;
  error?: string | null;
  /** One-line explainer above the chips. */
  hint?: string;
}) {
  const visible = groups.filter((g) => g.items.length > 0);
  return (
    <div className="space-y-4">
      {hint && <p className="text-sm text-[var(--color-text-secondary)]">{hint}</p>}
      {visible.map((group, i) => (
        <div key={group.label ?? i}>
          {visible.length > 1 && group.label && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {group.label}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {group.items.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onAdd(opt.id)}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-[var(--color-border-strong)] bg-transparent px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
              >
                {busy && pendingId === opt.id ? (
                  <Loader2 size={14} aria-hidden="true" className="animate-spin" />
                ) : (
                  <Plus size={14} aria-hidden="true" />
                )}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-[var(--color-status-error-text)]">{error}</p>}
    </div>
  );
}
