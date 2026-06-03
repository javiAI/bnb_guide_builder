"use client";

import { useCallback, useState } from "react";
import { SquarePen } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./tooltip";

/**
 * The single inline text-edit system across the app. Display = the value (or an
 * italic placeholder when blank) + a `SquarePen` affordance; clicking either
 * opens an inline `<input>` that commits on blur / Enter and cancels on Escape.
 * One component so the icon, affordance and keyboard behaviour are identical
 * everywhere (property title, access place rows, …) — pinned by
 * `inline-edit-consistency.test.tsx`. Typography is contextual via
 * `textClassName` (a large page title vs a compact 13px row); the edit
 * mechanics never change.
 */
interface InlineEditTextProps {
  value: string;
  onCommit: (next: string) => void;
  /** Italic prompt shown when the value is blank or "-". */
  placeholder?: string;
  ariaLabel?: string;
  /** Typography applied to both the display text and the edit input so the
   *  field inherits its surrounding context. */
  textClassName?: string;
  disabled?: boolean;
  /** Compact rows reveal the pencil on ancestor `.group` hover/focus; titles
   *  (default) show it always so the edit point is never hidden. */
  revealOnHover?: boolean;
  /** Wrap the display text in a Tooltip with the full value (for truncation). */
  withTooltip?: boolean;
  iconSize?: number;
}

export function InlineEditText({
  value,
  onCommit,
  placeholder = "Añadir nombre",
  ariaLabel,
  textClassName,
  disabled = false,
  revealOnHover = false,
  withTooltip = false,
  iconSize = 14,
}: InlineEditTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const trimmed = value.trim();
  const hasValue = trimmed !== "" && trimmed !== "-";

  const start = useCallback(() => {
    if (disabled) return;
    setDraft(hasValue ? trimmed : "");
    setEditing(true);
  }, [disabled, hasValue, trimmed]);

  const commit = useCallback(() => {
    const next = draft.trim();
    if (next !== trimmed) onCommit(next);
    setEditing(false);
  }, [draft, trimmed, onCommit]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-action-primary)] bg-[var(--color-background-elevated)] px-1.5 py-0.5 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-action-primary)]",
          textClassName,
        )}
      />
    );
  }

  const displayText = (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      className={cn(
        "min-w-0 max-w-full truncate text-left focus-visible:underline focus-visible:outline-none disabled:cursor-not-allowed",
        hasValue
          ? "text-[var(--color-text-primary)] hover:text-[var(--color-action-primary)]"
          : "italic text-[var(--color-text-subtle)] hover:text-[var(--color-action-primary)]",
        textClassName,
      )}
    >
      {hasValue ? value : placeholder}
    </button>
  );

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {withTooltip ? (
        <Tooltip text={hasValue ? value : placeholder} className="min-w-0 shrink">
          {displayText}
        </Tooltip>
      ) : (
        displayText
      )}
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        aria-label={hasValue ? "Editar nombre" : placeholder}
        className={cn(
          "recipe-icon-btn-32 grid h-8 w-8 flex-none place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-opacity duration-100 hover:bg-[var(--color-background-muted)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-action-primary)] disabled:cursor-not-allowed disabled:opacity-30",
          revealOnHover && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
        )}
      >
        <SquarePen size={iconSize} aria-hidden="true" />
      </button>
    </span>
  );
}
