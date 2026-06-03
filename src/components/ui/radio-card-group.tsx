"use client";

import { Check } from "lucide-react";

export interface RadioCardOption {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
}

interface RadioCardGroupProps {
  name: string;
  options: RadioCardOption[];
  value: string | null;
  onChange: (value: string) => void;
  showRecommended?: boolean;
  /**
   * `stack` (default) = full-width rows. `grid` = compact tiles in a responsive
   * grid (state at a glance, change in one click). Additive — existing callers
   * are unaffected.
   */
  layout?: "stack" | "grid";
}

function RecommendedBadge() {
  return (
    <span className="ml-2 inline-block rounded-full bg-[var(--color-interactive-selected)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-interactive-selected-fg)]">
      Recomendado
    </span>
  );
}

export function RadioCardGroup({ name, options, value, onChange, showRecommended = true, layout = "stack" }: RadioCardGroupProps) {
  if (layout === "grid") {
    return (
      <fieldset className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={`relative flex min-h-[44px] cursor-pointer flex-col gap-0.5 rounded-[var(--radius-lg)] border-2 p-3 transition-colors focus-within:ring-2 focus-within:ring-[var(--color-border-focus)] ${
                selected
                  ? "border-[var(--color-action-primary)] bg-[var(--color-interactive-selected)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-border-emphasis)]"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              {selected && (
                <Check
                  size={16}
                  aria-hidden="true"
                  className="absolute right-2 top-2 text-[var(--color-action-primary)]"
                />
              )}
              <span className="block pr-5 text-sm font-medium text-[var(--color-text-primary)]">
                {option.label}
                {showRecommended && option.recommended && <RecommendedBadge />}
              </span>
              {option.description && (
                <span className="block text-xs leading-snug text-[var(--color-text-muted)]">
                  {option.description}
                </span>
              )}
            </label>
          );
        })}
      </fieldset>
    );
  }

  return (
    <fieldset className="space-y-3">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <label
            key={option.id}
            className={`relative flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border-2 p-4 transition-colors ${
              selected
                ? "border-[var(--color-action-primary)] bg-[var(--color-interactive-selected)]"
                : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] hover:border-[var(--color-border-emphasis)]"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={selected}
              onChange={() => onChange(option.id)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-action-primary)]"
            />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                {option.label}
                {showRecommended && option.recommended && <RecommendedBadge />}
              </span>
              <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                {option.description}
              </span>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
