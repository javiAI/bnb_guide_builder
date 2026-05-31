// Shared className contracts for the contacts editor (read + create/edit forms).
// Centralised so the field shell and the 44-hit-area primary action button keep
// a single definition across contact-card.tsx and contacts-form.tsx.

export const FIELD =
  "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm";

export const FIELD_PH = `${FIELD} placeholder:text-[var(--color-text-placeholder)]`;

export const PRIMARY_BTN =
  "inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-40";
