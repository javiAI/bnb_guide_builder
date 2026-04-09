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
}

export function RadioCardGroup({ name, options, value, onChange }: RadioCardGroupProps) {
  return (
    <fieldset className="space-y-3">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <label
            key={option.id}
            className={`relative flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border-2 p-4 transition-colors ${
              selected
                ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]"
                : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--color-neutral-400)]"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={selected}
              onChange={() => onChange(option.id)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-primary-500)]"
            />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--foreground)]">
                {option.label}
                {option.recommended && (
                  <span className="ml-2 inline-block rounded-full bg-[var(--color-primary-100)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary-700)]">
                    Recomendado
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs text-[var(--color-neutral-500)]">
                {option.description}
              </span>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
