"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const Tabs        = RadixTabs.Root;
export const TabsContent = RadixTabs.Content;

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn(
        "flex border-b border-[var(--tabs-list-border)] gap-[var(--tabs-list-gap)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "relative h-[var(--tab-height)] px-[var(--tab-padding)] shrink-0",
        "text-[length:var(--tab-font-size)] font-[number:var(--tab-font-weight)]",
        "text-[var(--tab-fg)] transition-colors",
        "hover:text-[var(--tab-fg-hover)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
        "disabled:pointer-events-none disabled:text-[var(--color-text-disabled)]",
        "data-[state=active]:text-[var(--tab-fg-active)]",
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5",
        "after:bg-transparent data-[state=active]:after:bg-[var(--tab-indicator)]",
        className,
      )}
      {...props}
    />
  );
}
