"use client";

import { useState, useTransition } from "react";
import { updateSystemCoverageAction } from "@/lib/actions/editor.actions";
import { systemIconFor } from "@/lib/icons/system-icons";
import { fieldControlClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export interface SpaceCoverageSystem {
  systemId: string;
  systemKey: string;
  label: string;
  covered: boolean;
  note: string;
  /** Taxonomy default (all_relevant_spaces ⇒ true). Toggling back to this value
   * persists `inherited` (deletes the override row) instead of a redundant one. */
  defaultsOn: boolean;
}

/**
 * Editable per-space system coverage (Opción 1 core). Each card toggles whether
 * a property system reaches this space (override_yes / override_no via
 * `updateSystemCoverageAction`) and carries an optional per-space note. The
 * device TYPE (radiator / split / fan-coil) is defined once in Sistemas and
 * shown as the muted subtitle — never re-entered here.
 */
export function SpaceSystemsCoverage({
  propertyId,
  spaceId,
  systems,
}: {
  propertyId: string;
  spaceId: string;
  systems: SpaceCoverageSystem[];
}) {
  const [items, setItems] = useState(systems);
  const [, startTransition] = useTransition();

  function persist(systemId: string, covered: boolean, note: string) {
    const item = items.find((s) => s.systemId === systemId);
    // Matching the taxonomy default → store `inherited` (the action DELETEs the
    // override row) so the coverage table only ever holds genuine overrides.
    const mode =
      item && covered === item.defaultsOn ? "inherited" : covered ? "override_yes" : "override_no";
    const fd = new FormData();
    fd.append("systemId", systemId);
    fd.append("spaceId", spaceId);
    fd.append("mode", mode);
    if (note && mode !== "inherited") fd.append("note", note);
    startTransition(async () => {
      await updateSystemCoverageAction(null, fd);
    });
  }

  function toggle(systemId: string) {
    // Compute + persist in the event handler — NEVER inside the setItems updater
    // (that runs during render → "Cannot call startTransition while rendering").
    const item = items.find((s) => s.systemId === systemId);
    if (!item) return;
    const covered = !item.covered;
    const note = covered ? item.note : "";
    setItems((prev) => prev.map((s) => (s.systemId === systemId ? { ...s, covered, note } : s)));
    persist(systemId, covered, note);
  }

  function saveNote(systemId: string, note: string) {
    const item = items.find((s) => s.systemId === systemId);
    if (!item || item.note === note) return;
    setItems((prev) => prev.map((s) => (s.systemId === systemId ? { ...s, note } : s)));
    persist(systemId, item.covered, note);
  }

  if (items.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-secondary)]">
        Aún no hay sistemas que puedan cubrir espacios. Defínelos en{" "}
        <a href={`/properties/${propertyId}/systems`} className="font-medium text-[var(--color-text-link)] hover:underline">Sistemas</a>.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {items.map((s) => {
        const Icon = systemIconFor(s.systemKey);
        return (
          <div
            key={s.systemId}
            className={cn(
              "rounded-[var(--radius-lg)] border-2 transition-colors",
              s.covered
                ? "border-[var(--color-action-primary)] bg-[var(--color-interactive-selected)]"
                : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)]",
            )}
          >
            <button
              type="button"
              role="switch"
              aria-checked={s.covered}
              aria-label={`${s.label}: ${s.covered ? "cubre esta estancia" : "no cubre esta estancia"}`}
              onClick={() => toggle(s.systemId)}
              className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]"
            >
              <Icon
                size={16}
                aria-hidden="true"
                className={cn("flex-none", s.covered ? "text-[var(--color-action-primary)]" : "text-[var(--color-text-muted)]")}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">{s.label}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "relative h-[22px] w-[38px] flex-none rounded-full transition-colors",
                  s.covered ? "bg-[var(--color-action-primary)]" : "bg-[var(--color-border-strong)]",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-[left]",
                    s.covered ? "left-[18px]" : "left-[2px]",
                  )}
                />
              </span>
            </button>
            {/* Note input always present (disabled when the system is off) so
               every card is the same height regardless of state. */}
            <div className="px-3 pb-2.5">
              <input
                key={`${s.systemId}-${s.covered}`}
                type="text"
                defaultValue={s.note}
                disabled={!s.covered}
                placeholder={s.covered ? "Matiz para esta estancia (opcional)" : "Actívalo para añadir un matiz"}
                onBlur={(e) => saveNote(s.systemId, e.target.value.trim())}
                className={cn(
                  fieldControlClass,
                  "min-h-[36px] px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-[var(--color-background-muted)]/40 disabled:text-[var(--color-text-muted)]",
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
