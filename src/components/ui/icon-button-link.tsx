import Link from "next/link";
import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type IconButtonLinkSize = "sm" | "md";
export type IconButtonLinkTone = "neutral" | "primary";

const SIZE_CLASS: Record<IconButtonLinkSize, string> = {
  sm: "recipe-icon-btn-32 grid h-8 w-8 place-items-center",
  md: "grid h-11 w-11 place-items-center",
};

const TONE_CLASS: Record<IconButtonLinkTone, string> = {
  neutral:
    "rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
  primary:
    "rounded-[10px] bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] no-underline transition-colors hover:bg-[var(--color-action-primary-hover)] hover:text-[var(--color-action-primary-fg)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
};

type LinkProps = ComponentProps<typeof Link>;

interface IconButtonLinkProps extends Omit<LinkProps, "children"> {
  icon: LucideIcon;
  iconSize?: number;
  size?: IconButtonLinkSize;
  tone?: IconButtonLinkTone;
  "aria-label": string;
}

export function IconButtonLink({
  icon: Icon,
  iconSize = 15,
  size = "md",
  tone = "neutral",
  className,
  ...props
}: IconButtonLinkProps) {
  return (
    <Link className={cn(SIZE_CLASS[size], TONE_CLASS[tone], className)} {...props}>
      <Icon size={iconSize} aria-hidden="true" />
    </Link>
  );
}
