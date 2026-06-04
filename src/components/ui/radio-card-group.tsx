"use client";

import { OptionTile, RecommendedBadge } from "./card-tile";

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

export function RadioCardGroup({ name, options, value, onChange, showRecommended = true, layout = "stack" }: RadioCardGroupProps) {
  if (layout === "grid") {
    return (
      <fieldset className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <OptionTile
              key={option.id}
              selected={selected}
              label={option.label}
              description={option.description}
              recommended={option.recommended}
              showRecommended={showRecommended}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
            </OptionTile>
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
