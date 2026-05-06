"use client";

import type { LucideIcon } from "lucide-react";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/cn";

interface MethodRowProps {
  id: string;
  icon: LucideIcon;
  name: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  recommended?: boolean;
  // When true, the row hosts inline name + description inputs while selected.
  // Selecting the row enters this mode; deselecting collapses it.
  isOther?: boolean;
  customLabel?: string;
  customDesc?: string;
  onCustomLabelChange?: (value: string) => void;
  onCustomDescChange?: (value: string) => void;
  // Primary marker — only present when the layer supports the concept
  // (building / unit / parking). Accessibility omits this entirely.
  isPrimary?: boolean;
  onMakePrimary?: () => void;
}

export function MethodRow({
  icon: Icon,
  name,
  description,
  selected,
  onClick,
  recommended,
  isOther,
  customLabel,
  customDesc,
  onCustomLabelChange,
  onCustomDescChange,
  isPrimary,
  onMakePrimary,
}: MethodRowProps) {
  const showInline = isOther === true && selected;
  const showStar = onMakePrimary !== undefined && selected;

  return (
    <div
      className={cn(
        "group rounded-[12px] border-[1.5px]",
        "transition-[border-color,background-color] duration-150 ease-out",
        selected
          ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)]"
          : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-border-strong)]",
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          aria-pressed={selected}
          onClick={onClick}
          className={cn(
            "flex min-h-[56px] flex-1 items-start gap-3 rounded-[12px] p-3 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid h-8 w-8 flex-none place-items-center rounded-[8px]",
              selected
                ? "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)]"
                : "bg-[var(--color-background-muted)] text-[var(--color-text-secondary)]",
            )}
          >
            <Icon size={16} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-[14px] font-semibold leading-tight text-[var(--color-text-primary)]">
                {name}
              </span>
              {isPrimary && (
                <span className="rounded-full bg-[var(--color-action-primary)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-action-primary-fg)]">
                  Principal
                </span>
              )}
              {recommended && !isPrimary && (
                <span className="rounded-full border border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-status-success-text)]">
                  Recomendado
                </span>
              )}
            </span>
            {description && (
              <span className="line-clamp-2 text-[12px] leading-[1.45] text-[var(--color-text-secondary)]">
                {description}
              </span>
            )}
          </span>
          {selected && !showStar && (
            <Check
              size={18}
              aria-hidden="true"
              className="mt-0.5 flex-none text-[var(--color-action-primary)]"
            />
          )}
        </button>
        {showStar && (
          <button
            type="button"
            onClick={onMakePrimary}
            aria-label={isPrimary ? "Método principal" : "Marcar como principal"}
            aria-pressed={isPrimary === true}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-none items-center justify-center rounded-[12px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-page)]",
              isPrimary
                ? "text-[var(--color-action-primary)]"
                : "text-[var(--color-text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--color-action-primary)]",
            )}
          >
            <Star
              size={18}
              aria-hidden="true"
              className={isPrimary ? "fill-[var(--color-action-primary)]" : ""}
            />
          </button>
        )}
      </div>
      {showInline && (
        <div className="space-y-3 border-t border-[var(--color-action-primary)]/30 px-3 py-3">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
              Nombre del método *
            </span>
            <input
              type="text"
              value={customLabel ?? ""}
              onChange={(e) => onCustomLabelChange?.(e.target.value)}
              placeholder="Ej. Tarjeta del garaje"
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
              Descripción
            </span>
            <textarea
              rows={2}
              value={customDesc ?? ""}
              onChange={(e) => onCustomDescChange?.(e.target.value)}
              placeholder="Cómo funciona este método de acceso (opcional)"
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm focus:border-[var(--color-action-primary)] focus:outline-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}
