"use client";

interface NumberStepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** Form field name — renders a hidden input for form submission */
  name?: string;
  /** Unit suffix shown after the value (e.g. "kg", "EUR") */
  suffix?: string;
}

const stepBtnCls = "flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] disabled:cursor-not-allowed disabled:bg-[var(--button-disabled-bg)] disabled:text-[var(--button-disabled-fg)]";

export function NumberStepper({
  label,
  value,
  min = 0,
  max = 99,
  step = 1,
  onChange,
  name,
  suffix,
}: NumberStepperProps) {
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-4 py-3">
      {name && <input type="hidden" name={name} value={value} />}
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className={stepBtnCls}
          aria-label={`Reducir ${label}`}
        >
          &minus;
        </button>
        <span className="min-w-[2rem] text-center text-sm font-semibold text-[var(--color-text-primary)]">
          {value}{suffix ? ` ${suffix}` : ""}
        </span>
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className={stepBtnCls}
          aria-label={`Aumentar ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
