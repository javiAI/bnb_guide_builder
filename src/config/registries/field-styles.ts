// Shared input styling tokens for field-type renderers (amenity subtypes,
// system subtypes, and any future consumer of the field-type registry).

export const inputClass =
  "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none";

export const textareaClass = `${inputClass} resize-none`;

export const checkboxClass =
  "h-4 w-4 rounded border-[var(--border)] text-[var(--color-primary-500)]";
