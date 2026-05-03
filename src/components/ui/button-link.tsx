import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonLinkSize = "sm" | "md" | "lg";
export type ButtonLinkVariant = "primary" | "secondary";

/* Bakes hover:no-underline so consumers cannot forget — defends against the
 * a:hover { text-decoration: underline } global rule in base.css. */
const VARIANT_CLASS: Record<ButtonLinkVariant, string> = {
  primary:
    "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] no-underline transition-colors hover:bg-[var(--color-action-primary-hover)] hover:text-[var(--color-action-primary-fg)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
  secondary:
    "border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-primary)] no-underline transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
};

const SIZE_CLASS: Record<ButtonLinkSize, string> = {
  sm: "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium",
  md: "inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium",
  lg: "inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] px-4 text-[14px] font-medium",
};

type LinkProps = ComponentProps<typeof Link>;

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonLinkVariant;
  size?: ButtonLinkSize;
  children: ReactNode;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(SIZE_CLASS[size], VARIANT_CLASS[variant], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
