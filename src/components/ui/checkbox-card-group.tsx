"use client";

export interface CheckboxCardOption {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
}

interface CheckboxCardGroupProps {
  name: string;
  options: CheckboxCardOption[];
  value: string[];
  onChange: (values: string[]) => void;
  showRecommended?: boolean;
}

export function CheckboxCardGroup({ name, options, value, onChange, showRecommended = true }: CheckboxCardGroupProps) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <fieldset className="space-y-3">
      {options.map((option) => {
        const selected = value.includes(option.id);
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
              type="checkbox"
              name={name}
              value={option.id}
              checked={selected}
              onChange={() => toggle(option.id)}
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
