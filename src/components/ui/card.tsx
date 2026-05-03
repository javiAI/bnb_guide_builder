import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const cardVariants = cva("", {
  variants: {
    variant: {
      default:  "rounded-[var(--card-radius)] bg-[var(--card-bg)] text-[var(--card-fg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]",
      elevated: "rounded-[var(--card-radius)] bg-[var(--card-bg)] text-[var(--card-fg)] shadow-[var(--card-shadow-hover)]",
      outlined: "rounded-[var(--card-radius)] bg-[var(--card-bg)] text-[var(--card-fg)] border border-[var(--card-border)]",
      // overview replicates EXACTLY the shell of operator overview cards (16D)
      // via the recipe-card-shell @apply (src/styles/recipes.css). Padding (p-4)
      // is baked in; do NOT nest CardHeader/CardContent inside (would double-pad,
      // since --card-padding-md = var(--space-5) ≠ p-4).
      overview: "recipe-card-shell",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface CardProps
  extends ComponentPropsWithoutRef<"div">,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-[var(--card-padding-md)]", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("p-[var(--card-padding-md)] pt-0", className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex items-center p-[var(--card-padding-md)] pt-0", className)}
      {...props}
    />
  );
}
