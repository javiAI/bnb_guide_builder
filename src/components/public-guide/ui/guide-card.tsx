import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef } from "react";

const guideCard = cva(
  "rounded-[var(--card-radius)] border",
  {
    variants: {
      variant: {
        hero:      "bg-[var(--guide-brand)] text-[var(--guide-brand-fg)] border-transparent shadow-[var(--card-shadow)]",
        essential: "bg-[var(--card-bg)] text-[var(--card-fg)] border-[var(--color-border-strong)] shadow-[var(--card-shadow)]",
        standard:  "bg-[var(--card-bg)] text-[var(--card-fg)] border-[var(--card-border)]",
        warning:   "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)] border-[var(--color-status-warning-border)]",
      },
      padding: {
        sm: "p-[var(--card-padding-sm)]",
        md: "p-[var(--card-padding-md)]",
        lg: "p-[var(--card-padding-lg)]",
      },
    },
    defaultVariants: {
      variant: "standard",
      padding: "md",
    },
  },
);

type CardProps = ComponentPropsWithoutRef<"div"> & VariantProps<typeof guideCard>;

function GuideCard({ variant, padding, className, ...props }: CardProps) {
  return <div className={cn(guideCard({ variant, padding }), className)} {...props} />;
}

export function HeroCard({ className, ...props }: Omit<CardProps, "variant">) {
  return <GuideCard variant="hero" padding="lg" className={className} {...props} />;
}

export function EssentialCard({ className, ...props }: Omit<CardProps, "variant">) {
  return <GuideCard variant="essential" className={className} {...props} />;
}

export function StandardCard({ className, ...props }: Omit<CardProps, "variant">) {
  return <GuideCard variant="standard" className={className} {...props} />;
}

export function WarningCard({ className, ...props }: Omit<CardProps, "variant">) {
  return <GuideCard variant="warning" className={className} {...props} />;
}
