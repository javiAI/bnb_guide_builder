import type { ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface SectionEyebrowProps extends ComponentPropsWithoutRef<"h3"> {
  icon?: LucideIcon;
  iconSize?: number;
}

export function SectionEyebrow({
  icon: Icon,
  iconSize = 14,
  className,
  children,
  ...props
}: SectionEyebrowProps) {
  return (
    <h3
      className={cn("recipe-eyebrow", className)}
      {...props}
    >
      {Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
    </h3>
  );
}
