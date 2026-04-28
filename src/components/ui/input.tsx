import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const inputVariants = cva(
  [
    "w-full rounded-[var(--input-radius)]",
    "bg-[var(--input-bg)] text-[var(--input-fg)]",
    "text-[length:var(--input-font-size)]",
    "placeholder:text-[var(--input-placeholder)]",
    "border border-[var(--input-border)] px-[var(--input-padding-x)]",
    "transition-colors",
    "focus:outline-none focus:border-[var(--input-border-focus)] focus:shadow-[var(--input-shadow-focus)]",
    "hover:border-[var(--input-border-hover)]",
    "disabled:bg-[var(--input-bg-disabled)] disabled:text-[var(--input-fg-disabled)] disabled:cursor-not-allowed",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-[var(--input-height-sm)]",
        md: "h-[var(--input-height-md)]",
        lg: "h-[var(--input-height-lg)]",
      },
      error: {
        true: "border-[var(--input-border-error)] focus:border-[var(--input-border-error)] focus:shadow-[var(--input-shadow-error)]",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      error: false,
    },
  },
);

interface InputProps
  extends Omit<ComponentPropsWithoutRef<"input">, "size">,
    Omit<VariantProps<typeof inputVariants>, "error"> {
  error?: boolean;
}

export function Input({ className, size, error, ...props }: InputProps) {
  return (
    <input
      className={cn(inputVariants({ size, error: error ?? false }), className)}
      {...props}
    />
  );
}
