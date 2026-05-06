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
            "z-50 min-w-[140px] max-w-[240px] rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-1.5 text-[13px] text-[var(--color-text-primary)] shadow-[var(--elevation-surface-lg)]",
            "data-[state=open]:animate-hovercard-in data-[state=closed]:animate-hovercard-out",
            contentClassName,
          )}
        >
          {content}
          {/* Arrow merges with popover border. Open SVG path strokes only the
             slant edges (not the base) — the base sits flush with the popover
             edge so the popover's own border continues into the slants without
             visible double-line. fill-bg-elevated closes the triangle visually. */}
          <RadixHoverCard.Arrow asChild width={14} height={7}>
            <svg viewBox="0 0 14 7" fill="none" aria-hidden="true">
              <path
                d="M0 0 L7 7 L14 0"
                fill="var(--color-background-elevated)"
                stroke="var(--color-border-default)"
                strokeWidth="1"
              />
            </svg>
          </RadixHoverCard.Arrow>
        </RadixHoverCard.Content>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
}
