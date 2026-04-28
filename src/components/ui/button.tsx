import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-[var(--button-gap)]",
    "rounded-[var(--button-radius)]",
    "font-[number:var(--button-font-weight)] text-[length:var(--button-font-size)]",
    "transition-colors select-none",
    "focus-visible:outline-none focus-visible:shadow-[var(--button-focus-ring)]",
    "disabled:cursor-not-allowed disabled:bg-[var(--button-disabled-bg)] disabled:text-[var(--button-disabled-fg)]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]",
          "hover:bg-[var(--button-primary-bg-hover)] active:bg-[var(--button-primary-bg-active)]",
          "border border-[var(--button-primary-border)]",
        ].join(" "),
        secondary: [
          "bg-[var(--button-secondary-bg)] text-[var(--button-secondary-fg)]",
          "hover:bg-[var(--button-secondary-bg-hover)] active:bg-[var(--button-secondary-bg-active)]",
          "border border-[var(--button-secondary-border)]",
        ].join(" "),
        ghost: [
          "bg-[var(--button-ghost-bg)] text-[var(--button-ghost-fg)]",
          "hover:bg-[var(--button-ghost-bg-hover)] active:bg-[var(--button-ghost-bg-active)]",
          "border border-[var(--button-ghost-border)]",
        ].join(" "),
        destructive: [
          "bg-[var(--button-destructive-bg)] text-[var(--button-destructive-fg)]",
          "hover:bg-[var(--button-destructive-bg-hover)] active:bg-[var(--button-destructive-bg-active)]",
        ].join(" "),
      },
      size: {
        sm: "h-[var(--button-height-sm)] px-[var(--button-padding-x-sm)]",
        md: "h-[var(--button-height-md)] px-[var(--button-padding-x-md)]",
        lg: "h-[var(--button-height-lg)] px-[var(--button-padding-x-lg)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

interface ButtonProps
  extends ComponentPropsWithoutRef<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
