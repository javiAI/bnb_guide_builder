import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type TextLinkSize = "xs" | "sm" | "md";

const SIZE_CLASS: Record<TextLinkSize, string> = {
  xs: "text-[11px] font-medium",
  sm: "text-[12px] font-medium",
  md: "text-[13px] font-medium",
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
      className={cn(
        SIZE_CLASS[size],
        "text-[var(--color-text-link)] hover:underline",
        className,
      )}
      {...props}
    >
      {children}
      {arrow && " →"}
    </Link>
  );
}
