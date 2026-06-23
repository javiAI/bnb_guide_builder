"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toggleAmenityAction } from "@/lib/actions/editor.actions";
import { FieldInput } from "@/components/ui/field";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { cn } from "@/lib/cn";
import { slugifyLabel } from "./text";
import type { CustomAmenityEntry } from "../page";

interface CustomAmenitySectionProps {
  propertyId: string;
  entries: CustomAmenityEntry[];
  /** Configured spaces, for the destination chips. */
  spaces: { id: string; name: string }[];
  /** Anchor id so the catalog toolbar's "Añadir equipamiento" CTA can focus here. */
  inputId: string;
}

const GENERAL_DESTINATION = "general";

/**
 * Section 02 — "Equipamiento propio". Lists the operator-created `custom.*`
 * instances (plus orphans that no catalog row consumed) and offers a single
 * free-label add control: a one-line input + a destination chip row + a Plus
 * button. One-click creation is impossible here (the label is free text), so
 * this is the one justified primary control in the tab.
 */
export function CustomAmenitySection({
  propertyId,
  entries,
  spaces,
  inputId,
}: CustomAmenitySectionProps) {
  const [value, setValue] = useState("");
  const [destination, setDestination] = useState<string>(GENERAL_DESTINATION);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const trimmed = value.trim();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const slug = slugifyLabel(trimmed);
    if (!slug) return;

    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("amenityKey", `custom.${slug}`);
    formData.set("customLabel", trimmed);
    formData.set("enabled", "true");
    if (destination !== GENERAL_DESTINATION) formData.set("spaceId", destination);

    startTransition(async () => {
      const res = await toggleAmenityAction(null, formData);
      if (res.success) {
        setValue("");
        setDestination(GENERAL_DESTINATION);
        setError(null);
      } else {
        setError(res.error ?? "No se pudo añadir.");
      }
    });
  }

  return (
    <div>
      {entries.length > 0 && (
        <ul className="mb-5 divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-lg)] border border-[var(--color-border-default)]">
          {entries.map((entry) => (
            <li
              key={entry.dbId}
              className="flex items-center gap-3 px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="text-[13.5px] font-medium text-[var(--color-text-primary)]">
                  {entry.label}
                </span>
                <span className="ml-2 align-middle text-[11px] text-[var(--color-text-muted)]">
                  {entry.scopeLabel}
                </span>
              </span>
              <DeleteConfirmationButton
                title={`Eliminar “${entry.label}”`}
                description="Se quitará de la lista de equipamiento propio. No afecta a otros módulos."
                entityId={entry.dbId}
                fieldName="amenityInstanceId"
                action={async () => {
                  const fd = new FormData();
                  fd.set("propertyId", propertyId);
                  fd.set("amenityKey", entry.amenityKey);
                  fd.set("enabled", "false");
                  if (entry.spaceId) fd.set("spaceId", entry.spaceId);
                  const res = await toggleAmenityAction(null, fd);
                  return { success: res.success };
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex flex-wrap items-end gap-2.5">
          <FieldInput
            id={inputId}
            label="Nombre del equipamiento"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="p. ej. Masajeador de cuello"
            className="w-full sm:w-72"
            maxLength={80}
          />
          <button
            type="submit"
            disabled={!trimmed || isPending}
            aria-label="Añadir equipamiento propio"
            className={cn(
              "inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-3 text-sm font-medium transition-colors",
              "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] hover:bg-[var(--color-action-primary-hover)]",
              "disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
            )}
          >
            <Plus size={16} aria-hidden="true" />
            Añadir
          </button>
        </div>

        {spaces.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11.5px] text-[var(--color-text-muted)]">
              Ubicación
            </span>
            <ToggleChip
              active={destination === GENERAL_DESTINATION}
              onToggle={() => setDestination(GENERAL_DESTINATION)}
              hideCheck
            >
              General
            </ToggleChip>
            {spaces.map((s) => (
              <ToggleChip
                key={s.id}
                active={destination === s.id}
                onToggle={() => setDestination(s.id)}
                hideCheck
              >
                {s.name}
              </ToggleChip>
            ))}
          </div>
        )}

        {error && (
          <p className="text-[12px] text-[var(--color-status-error-text)]">{error}</p>
        )}
      </form>
    </div>
  );
}
