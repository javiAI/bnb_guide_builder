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
                ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]"
                : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--color-neutral-400)]"
            }`}
          >
            <input
              type="checkbox"
              name={name}
              value={option.id}
              checked={selected}
              onChange={() => toggle(option.id)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-primary-500)]"
            />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--foreground)]">
                {option.label}
                {showRecommended && option.recommended && (
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
