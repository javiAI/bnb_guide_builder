"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const Select        = RadixSelect.Root;
export const SelectGroup   = RadixSelect.Group;
export const SelectValue   = RadixSelect.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof RadixSelect.Trigger>) {
  return (
    <RadixSelect.Trigger
      className={cn(
        "flex w-full items-center justify-between",
        "h-[var(--input-height-md)] rounded-[var(--input-radius)]",
        "bg-[var(--input-bg)] text-[var(--input-fg)]",
        "text-[length:var(--input-font-size)]",
        "border border-[var(--input-border)] px-[var(--input-padding-x)]",
        "transition-colors",
        "hover:border-[var(--input-border-hover)]",
        "focus:outline-none focus:border-[var(--input-border-focus)] focus:shadow-[var(--input-shadow-focus)]",
        "disabled:bg-[var(--input-bg-disabled)] disabled:text-[var(--input-fg-disabled)] disabled:cursor-not-allowed",
        "data-[placeholder]:text-[var(--input-placeholder)]",
        className,
      )}
      {...props}
    >
      {children}
      <RadixSelect.Icon asChild>
        <ChevronDown
          aria-hidden
          style={{ width: "var(--icon-size-sm)", height: "var(--icon-size-sm)", color: "var(--select-chevron)", flexShrink: 0 }}
        />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: ComponentPropsWithoutRef<typeof RadixSelect.Content>) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        position={position}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden",
          "rounded-[var(--input-radius)]",
          "bg-[var(--input-bg)] border border-[var(--input-border)]",
          "shadow-[var(--input-shadow-focus)]",
          "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <RadixSelect.ScrollUpButton className="flex items-center justify-center py-1 text-[var(--select-chevron)]">
          <ChevronUp style={{ width: "var(--icon-size-sm)", height: "var(--icon-size-sm)" }} aria-hidden />
        </RadixSelect.ScrollUpButton>
        <RadixSelect.Viewport className="p-1">{children}</RadixSelect.Viewport>
        <RadixSelect.ScrollDownButton className="flex items-center justify-center py-1 text-[var(--select-chevron)]">
          <ChevronDown style={{ width: "var(--icon-size-sm)", height: "var(--icon-size-sm)" }} aria-hidden />
        </RadixSelect.ScrollDownButton>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixSelect.Label>) {
  return (
    <RadixSelect.Label
      className={cn(
        "px-2 py-1.5 text-[length:var(--input-font-size)] font-[number:var(--button-font-weight)] text-[var(--input-placeholder)]",
        className,
      )}
      {...props}
    />
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof RadixSelect.Item>) {
  return (
    <RadixSelect.Item
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center",
        "rounded-[var(--dropdown-item-radius)] py-1.5 pl-8 pr-2",
        "text-[length:var(--input-font-size)] text-[var(--input-fg)]",
        "transition-colors",
        "focus:bg-[var(--color-interactive-hover)] focus:outline-none",
        "data-[disabled]:pointer-events-none data-[disabled]:text-[var(--input-fg-disabled)]",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex items-center justify-center">
        <RadixSelect.ItemIndicator>
          <Check
            aria-hidden
            style={{ width: "var(--icon-size-sm)", height: "var(--icon-size-sm)", color: "var(--color-action-primary)" }}
          />
        </RadixSelect.ItemIndicator>
      </span>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixSelect.Separator>) {
  return (
    <RadixSelect.Separator
      className={cn("-mx-1 my-1 h-px bg-[var(--color-border-subtle)]", className)}
      {...props}
    />
  );
}
