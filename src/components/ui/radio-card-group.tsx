"use client";

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
}

export function RadioCardGroup({ name, options, value, onChange, showRecommended = true }: RadioCardGroupProps) {
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
                {showRecommended && option.recommended && (
                  <span className="ml-2 inline-block rounded-full bg-[var(--color-interactive-selected)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-interactive-selected-fg)]">
                    Recomendado
                  </span>
                )}
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
