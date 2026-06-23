"use client";

import { useState, useTransition } from "react";
import { updateSystemCoverageAction } from "@/lib/actions/editor.actions";
import { fieldControlClass } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

interface Space {
  id: string;
  name: string;
  spaceType: string;
}

interface Props {
  systemId: string;
  spaces: Space[];
  /** spaceId → stored coverage mode (inherited / override_yes / override_no). */
  coverageMap: Record<string, string>;
  /** spaceId → stored per-space note (only for spaces with an override note). */
  noteMap: Record<string, string>;
  /** Taxonomy default for this system (all_relevant_spaces ⇒ true). Toggling
   * back to this value persists `inherited` (deletes the override row). */
  defaultsOn: boolean;
}

interface CoverageItem {
  spaceId: string;
  name: string;
  covered: boolean;
  note: string;
}

/**
 * Per-space coverage for this system — mirror of `SpaceSystemsCoverage`. Each
 * row toggles whether the system reaches a space (override_yes / override_no via
 * `updateSystemCoverageAction`) and carries an optional per-space note. Matching
 * the taxonomy default persists `inherited` (the action DELETEs the override
 * row), so the table only ever holds genuine overrides. Optimistic with rollback
 * on error. The action derives the property from the system — no propertyId here.
 */
export function SystemCoverageTable({ systemId, spaces, coverageMap, noteMap, defaultsOn }: Props) {
  const [items, setItems] = useState<CoverageItem[]>(() =>
    spaces.map((s) => {
      const mode = coverageMap[s.id] ?? "inherited";
      const covered = mode === "override_yes" ? true : mode === "override_no" ? false : defaultsOn;
      return { spaceId: s.id, name: s.name, covered, note: noteMap[s.id] ?? "" };
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function persist(spaceId: string, covered: boolean, note: string, prev: CoverageItem[]) {
    // Matching the taxonomy default → store `inherited` (action DELETEs the row).
    const mode = covered === defaultsOn ? "inherited" : covered ? "override_yes" : "override_no";
    const fd = new FormData();
    fd.append("systemId", systemId);
    fd.append("spaceId", spaceId);
    fd.append("mode", mode);
    if (note && mode !== "inherited") fd.append("note", note);
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const result = await updateSystemCoverageAction(null, fd);
          if (result && "success" in result && result.success === false) {
            setItems(prev);
            setError("No se pudo guardar la cobertura. Inténtalo de nuevo.");
          }
        } catch {
          setItems(prev);
          setError("No se pudo guardar la cobertura. Inténtalo de nuevo.");
        }
      })();
    });
  }

  function toggle(spaceId: string) {
    const prev = items;
    const item = prev.find((s) => s.spaceId === spaceId);
    if (!item) return;
    const covered = !item.covered;
    const note = covered ? item.note : "";
    setItems(prev.map((s) => (s.spaceId === spaceId ? { ...s, covered, note } : s)));
    persist(spaceId, covered, note, prev);
  }

  function saveNote(spaceId: string, note: string) {
    const prev = items;
    const item = prev.find((s) => s.spaceId === spaceId);
    if (!item || item.note === note) return;
    setItems(prev.map((s) => (s.spaceId === spaceId ? { ...s, note } : s)));
    persist(spaceId, item.covered, note, prev);
  }

  return (
    <div className="space-y-2.5">
      {error && (
        <p className="text-xs text-[var(--color-status-error-text)]">{error}</p>
      )}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((s) => (
          <div
            key={s.spaceId}
            className={cn(
              "rounded-[var(--radius-lg)] border-2 transition-colors",
              s.covered
                ? "border-[var(--color-action-primary)] bg-[var(--color-interactive-selected)]"
                : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)]",
            )}
          >
            <div className="flex min-h-[44px] items-center gap-2.5 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                {s.name}
              </span>
              <Switch
                size="sm"
                checked={s.covered}
                onChange={() => toggle(s.spaceId)}
                ariaLabel={`${s.name}: ${s.covered ? "cubierto por este sistema" : "no cubierto por este sistema"}`}
              />
            </div>
            {/* Note input always present (disabled when off) so every card is the
               same height regardless of state. */}
            <div className="px-3 pb-2.5">
              <input
                key={`${s.spaceId}-${s.covered}`}
                type="text"
                defaultValue={s.note}
                disabled={!s.covered}
                placeholder={s.covered ? "Matiz para este espacio (opcional)" : "Actívalo para añadir un matiz"}
                onBlur={(e) => saveNote(s.spaceId, e.target.value.trim())}
                className={cn(
                  fieldControlClass,
                  "min-h-[36px] px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-[var(--color-background-muted)]/40 disabled:text-[var(--color-text-muted)]",
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
