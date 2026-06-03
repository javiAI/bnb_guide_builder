"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Shared control surface for every labeled form field. Semantic tokens, AA in
// light + dark, `focus-visible` ring, and ≥44px min-height for touch targets.
// `className` is merged last so per-call overrides (e.g. the auto-fill flash
// `!bg-…`/`!border-…`) win via twMerge.
export const fieldControlClass =
  "block min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus-visible:border-[var(--color-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]";

interface FieldChromeProps {
  /** Visible label. Omit for an unlabeled control (rare — prefer `aria-label`). */
  label?: ReactNode;
  /** Contextual help rendered under the control, wired via `aria-describedby`. */
  help?: ReactNode;
  /** `default` for primary/required fields, `muted` for secondary ones. */
  labelTone?: "default" | "muted";
  /**
   * Shows the `*` hint and sets `aria-required` — but NOT the native `required`
   * attribute. This app auto-saves via `requestSubmit()`, which refuses an
   * invalid form; native `required` would block incremental saves. Server-side
   * Zod is the real validation layer.
   */
  required?: boolean;
}

const LABEL_TONE_CLS: Record<NonNullable<FieldChromeProps["labelTone"]>, string> = {
  default: "text-[var(--color-text-primary)]",
  muted: "text-[var(--color-text-secondary)]",
};

function FieldChrome({
  id,
  label,
  help,
  helpId,
  labelTone = "default",
  required,
  children,
}: FieldChromeProps & {
  id: string;
  helpId: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label != null && (
        <label
          htmlFor={id}
          className={cn("mb-1 block text-sm font-medium", LABEL_TONE_CLS[labelTone])}
        >
          {label}
          {required && <span className="ml-0.5 text-[var(--color-text-muted)]">*</span>}
        </label>
      )}
      {children}
      {help != null && (
        <p id={helpId} className="mt-1 text-xs text-[var(--color-text-muted)]">
          {help}
        </p>
      )}
    </div>
  );
}

type InputProps = FieldChromeProps & InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, help, labelTone, required, className, id: idProp, ...rest }: InputProps) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const helpId = `${id}-help`;
  return (
    <FieldChrome id={id} label={label} help={help} helpId={helpId} labelTone={labelTone} required={required}>
      <input
        id={id}
        aria-required={required || undefined}
        aria-describedby={help != null ? helpId : undefined}
        className={cn(fieldControlClass, className)}
        {...rest}
      />
    </FieldChrome>
  );
}

type SelectProps = FieldChromeProps & SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ label, help, labelTone, required, className, id: idProp, children, ...rest }: SelectProps) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const helpId = `${id}-help`;
  return (
    <FieldChrome id={id} label={label} help={help} helpId={helpId} labelTone={labelTone} required={required}>
      <select
        id={id}
        aria-required={required || undefined}
        aria-describedby={help != null ? helpId : undefined}
        className={cn(fieldControlClass, className)}
        {...rest}
      >
        {children}
      </select>
    </FieldChrome>
  );
}

type TextareaProps = FieldChromeProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ label, help, labelTone, required, className, id: idProp, ...rest }: TextareaProps) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const helpId = `${id}-help`;
  return (
    <FieldChrome id={id} label={label} help={help} helpId={helpId} labelTone={labelTone} required={required}>
      <textarea
        id={id}
        aria-required={required || undefined}
        aria-describedby={help != null ? helpId : undefined}
        className={cn(fieldControlClass, className)}
        {...rest}
      />
    </FieldChrome>
  );
}
