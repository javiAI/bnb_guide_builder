"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toggleAmenityAction } from "@/lib/actions/editor.actions";
import { cn } from "@/lib/cn";
import { slugifyLabel } from "./text";

interface CustomAmenityInputProps {
  propertyId: string;
  spaceId: string | null;
  /** Anchor id so the toolbar "Añadir item" CTA can scroll/focus here. */
  inputId?: string;
}

/** Inline field to add a custom amenity to a group. */
export function CustomAmenityInput({
  propertyId,
  spaceId,
  inputId,
}: CustomAmenityInputProps) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const trimmed = value.trim();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trimmed) return;

    // Custom amenities use "custom." prefix + slugified label.
    const slug = slugifyLabel(trimmed);
    if (!slug) return;

    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("amenityKey", `custom.${slug}`);
    formData.set("enabled", "true");
    if (spaceId) formData.set("spaceId", spaceId);

    startTransition(async () => {
      await toggleAmenityAction(null, formData);
    });
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2 pl-3">
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Añadir equipamiento…"
        className={cn(
          "h-11 w-56 rounded-[10px] border border-dashed border-[var(--color-border-strong)]",
          "bg-[var(--color-background-surface)] px-3 text-[13px] text-[var(--color-text-primary)]",
          "placeholder:text-[var(--color-text-placeholder)]",
          "focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]",
        )}
      />
      {trimmed && (
        <button
          type="submit"
          disabled={isPending}
          aria-label="Añadir equipamiento personalizado"
          className={cn(
            "inline-flex h-11 min-w-[44px] items-center justify-center rounded-[10px] px-3",
            "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] transition-colors",
            "hover:bg-[var(--color-action-primary-hover)] disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
          )}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
