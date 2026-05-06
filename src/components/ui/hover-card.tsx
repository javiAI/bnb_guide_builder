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
             slants (no top edge). translateY(-1) shifts the SVG 1px INTO the
             popover so the bg-elevated fill covers the popover's border in the
             stem region — produces a clean notch where the popover border stops
             and the arrow slants continue. The math is rotation-agnostic: for
             side=bottom, translateY(-1) in SVG-local frame composes with Radix's
             180° rotation → +1 in screen → into popover (below arrow); for
             side=top, the 0° rotation passes -1 through unchanged → into popover
             (above arrow). Either way, into popover. */}
          <RadixHoverCard.Arrow asChild width={14} height={7}>
            <svg
              viewBox="0 0 14 7"
              fill="none"
              aria-hidden="true"
              style={{ display: "block", transform: "translateY(-1px)" }}
            >
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
