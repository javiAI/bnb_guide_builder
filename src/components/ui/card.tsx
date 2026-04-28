import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const cardVariants = cva(
  "rounded-[var(--card-radius)] bg-[var(--card-bg)] text-[var(--card-fg)]",
  {
    variants: {
      variant: {
        default:  "border border-[var(--card-border)] shadow-[var(--card-shadow)]",
        elevated: "shadow-[var(--card-shadow-hover)]",
        outlined: "border border-[var(--card-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

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
