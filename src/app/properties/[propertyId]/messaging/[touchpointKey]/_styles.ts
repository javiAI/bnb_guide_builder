/**
 * Shared className recipes for the touchpoint authoring forms (template card,
 * create-template form, automation section). Single source of truth so the
 * field + button treatments cannot drift across the three co-located files.
 *
 * Touch-target note: PRIMARY_BTN / SECONDARY_BTN bake `min-h-[44px]` (the
 * operator touch-target floor). Keep that token in the recipe — consumers
 * reference these by constant, so the 44 floor lives here, once.
 */

export const INPUT_CLASS =
  "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]";

export const PRIMARY_BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-5 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50";

export const SECONDARY_BTN =
  "inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] px-5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]";
