import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type TextLinkSize = "xs" | "sm" | "md";

/*
 * size="xs" consumes recipe-text-link (src/styles/recipes.css), which @applies
 * the same 11px + medium + link-color + hover:underline contract. sm/md sizes
 * keep their classes inline because the recipe is xs-specific (microcopy).
 */
const SIZE_CLASS: Record<TextLinkSize, string> = {
  xs: "recipe-text-link",
  sm: "text-[12px] font-medium text-[var(--color-text-link)] hover:underline",
  md: "text-[13px] font-medium text-[var(--color-text-link)] hover:underline",
};

interface TextLinkProps extends ComponentProps<typeof Link> {
  size?: TextLinkSize;
  arrow?: boolean;
}

export function TextLink({
  size = "xs",
  arrow = false,
  className,
  children,
  ...props
}: TextLinkProps) {
  return (
    <Link
      className={cn(SIZE_CLASS[size], className)}
      {...props}
    >
      {children}
      {arrow && " →"}
    </Link>
  );
}
