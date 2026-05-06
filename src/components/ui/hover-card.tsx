"use client";

import * as RadixHoverCard from "@radix-ui/react-hover-card";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface HoverCardProps {
  trigger: ReactNode;
  content: ReactNode;
  gap?: number;
  contentClassName?: string;
  openDelay?: number;
  closeDelay?: number;
}

export function HoverCard({
  trigger,
  content,
  gap = 8,
  contentClassName,
  openDelay = 80,
  closeDelay = 100,
}: HoverCardProps) {
  return (
    <RadixHoverCard.Root openDelay={openDelay} closeDelay={closeDelay}>
      <RadixHoverCard.Trigger asChild>
        <span className="inline-flex">{trigger}</span>
      </RadixHoverCard.Trigger>
      <RadixHoverCard.Portal>
        <RadixHoverCard.Content
          sideOffset={gap}
          className={cn(
            "z-50 max-w-[240px] rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-2.5 text-[12px] text-[var(--color-text-primary)] shadow-[var(--elevation-surface-md)]",
            "data-[state=open]:animate-hovercard-in data-[state=closed]:animate-hovercard-out",
            contentClassName,
          )}
        >
          {content}
          <RadixHoverCard.Arrow
            width={10}
            height={5}
            className="fill-[var(--color-background-elevated)]"
          />
        </RadixHoverCard.Content>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
}
