import type { ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type IconButtonSize = "sm" | "md";
export type IconButtonTone = "neutral" | "primary";

/* 32 visual + slop ::before pseudo-element brings hit area to 44 on fine pointers. */
export const ICON_BUTTON_SIZE_CLASS: Record<IconButtonSize, string> = {
  sm: "recipe-icon-btn-32 grid h-8 w-8 place-items-center",
  md: "grid h-11 w-11 place-items-center",
};

/*
 * Disabled semantics: when `disabled` is set on the underlying <button>, the
 * browser blocks click + focus naturally. The Tailwind `disabled:` variants
 * here neutralize the hover delta (so a placeholder doesn't look interactive),
 * cue the cursor, and dim the surface enough to read as "not yet active".
 * Use this for future-interactive controls that ship before their behavior
 * (current consumer: topbar notifications bell — see layout/topbar.tsx).
 */
const TONE_CLASS: Record<IconButtonTone, string> = {
  neutral:
    "rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[var(--color-background-elevated)] disabled:hover:text-[var(--color-text-secondary)]",
  primary:
    "rounded-[10px] bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[var(--color-action-primary)]",
};

interface IconButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  icon: LucideIcon;
  iconSize?: number;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  "aria-label": string;
}

export function IconButton({
  icon: Icon,
  iconSize = 15,
  size = "md",
  tone = "neutral",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(ICON_BUTTON_SIZE_CLASS[size], TONE_CLASS[tone], className)}
      {...props}
    >
      <Icon size={iconSize} aria-hidden="true" />
    </button>
  );
}
