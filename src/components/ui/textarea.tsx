import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends ComponentPropsWithoutRef<"textarea"> {
  error?: boolean;
}

export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[var(--input-radius)]",
        "bg-[var(--input-bg)] text-[var(--input-fg)]",
        "text-[length:var(--input-font-size)]",
        "placeholder:text-[var(--input-placeholder)]",
        "border border-[var(--input-border)]",
        "transition-colors resize-y",
        "focus:outline-none focus:border-[var(--input-border-focus)] focus:shadow-[var(--input-shadow-focus)]",
        "hover:border-[var(--input-border-hover)]",
        "disabled:bg-[var(--input-bg-disabled)] disabled:text-[var(--input-fg-disabled)] disabled:cursor-not-allowed",
        error && "border-[var(--input-border-error)] focus:border-[var(--input-border-error)] focus:shadow-[var(--input-shadow-error)]",
        className,
      )}
      style={{ minHeight: "var(--textarea-min-height)", padding: "var(--textarea-padding)" }}
      {...props}
    />
  );
}
