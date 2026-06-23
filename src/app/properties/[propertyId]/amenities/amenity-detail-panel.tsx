"use client";

import { useState, useTransition, useRef } from "react";
import { updateAmenityAction, toggleAmenityAction } from "@/lib/actions/editor.actions";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { useFormAutoSave } from "@/lib/use-form-auto-save";
import { SubtypeFieldInput } from "./subtype-field-input";
import type { EnrichedAmenityItem } from "./page";
import type { SubtypeField } from "@/lib/types/taxonomy";
import { EntityGallery } from "@/components/media/entity-gallery";

interface AmenityDetailPanelProps {
  propertyId: string;
  item: EnrichedAmenityItem;
  spaceId: string | null;
}

/** Evaluate shown_if condition for a subtype field. */
function isFieldVisible(field: SubtypeField, details: Record<string, unknown>): boolean {
  if (!field.shown_if) return true;
  const current = details[field.shown_if.field];
  if (field.shown_if.equals !== undefined) return current === field.shown_if.equals;
  if (field.shown_if.in && Array.isArray(field.shown_if.in)) return field.shown_if.in.includes(current);
  return true;
}

export function AmenityDetailPanel({ propertyId, item, spaceId }: AmenityDetailPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [details, setDetails] = useState<Record<string, unknown>>(
    item.detailsJson ?? {},
  );

  function handleFieldChange(fieldId: string, value: unknown) {
    setDetails((prev) => ({ ...prev, [fieldId]: value }));
  }

  // Auto-save: edits persist as you make them (no "Guardar" button). The panel
  // has no native form fields (everything is controlled), so we wrap the fields
  // in a <form> and use `watch` over the details. `item.dbId` is part of the
  // signal so that, for an amenity with no DB row yet, the create step's id
  // arriving via revalidation re-triggers a save that persists the details the
  // create couldn't. `requestSubmit()` fires `save()` below.
  const formRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(formRef, 700, () => JSON.stringify({ dbId: item.dbId, details }));

  function save() {
    // If no DB row yet (e.g. canonicalOwner auto-enabled), create it first; the
    // details are persisted on the follow-up save once the new dbId arrives.
    if (!item.dbId) {
      const createFd = new FormData();
      createFd.set("propertyId", propertyId);
      createFd.set("amenityKey", item.id);
      createFd.set("enabled", "true");
      if (spaceId) createFd.set("spaceId", spaceId);

      startTransition(async () => {
        const res = await toggleAmenityAction(null, createFd);
        setError(res.success ? null : (res.error ?? "No se pudo guardar."));
      });
      return;
    }

    const formData = new FormData();
    formData.set("amenityId", item.dbId);
    formData.set("propertyId", propertyId);
    formData.set("detailsJson", JSON.stringify(details));
    // The taxonomy has a 1:1 mapping of amenity → subtype (keyed by amenity_id).
    // Persisting the subtypeKey makes it explicit which subtype shape produced
    // this detailsJson, so a later subtype rename/split doesn't silently
    // mismatch the stored fields.
    if (item.hasSubtype) formData.set("subtypeKey", item.id);

    startTransition(async () => {
      const res = await updateAmenityAction(null, formData);
      setError(res.success ? null : (res.error ?? "No se pudo guardar."));
    });
  }

  const visibleFields = item.subtypeFields.filter((f) => isFieldVisible(f, details));

  return (
    <div className="mb-3 ml-3 border-l-2 border-[var(--color-border-default)] pb-1 pl-4 pt-1">
      <div className="mb-2 flex items-center justify-end">
        <AutoSaveStatus pending={isPending} />
      </div>

      {error && (
        <p className="mb-3 rounded-[var(--radius-md)] bg-[var(--color-status-error-bg)] p-2 text-xs text-[var(--color-status-error-text)]">
          {error}
        </p>
      )}

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="space-y-3">
          {visibleFields.map((field) => {
            // Conditional fields (shown_if) render indented under their trigger,
            // mirroring Espacios' reveal-below-trigger pattern.
            const revealClass = field.shown_if
              ? "border-l-2 border-[var(--color-border-default)] pl-3"
              : undefined;
            // Boolean fields render their own label inline
            if (field.type === "boolean") {
              return (
                <div key={field.id} className={revealClass}>
                  <SubtypeFieldInput
                    field={field}
                    value={details[field.id]}
                    onChange={handleFieldChange}
                  />
                </div>
              );
            }
            return (
              <div key={field.id} className={revealClass}>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">
                    {field.label}
                  </span>
                  {field.description && (
                    <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">
                      {field.description}
                    </span>
                  )}
                  <SubtypeFieldInput
                    field={field}
                    value={details[field.id]}
                    onChange={handleFieldChange}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </form>

      {/* Photos for this amenity instance — outside the auto-save form so the
          gallery's own controls never nest inside it. */}
      {item.dbId && (
        <div className="mt-4 border-t border-[var(--color-border-default)] pt-3">
          <EntityGallery
            propertyId={propertyId}
            entityType="amenity_instance"
            entityId={item.dbId}
            label="Fotos"
            defaultCollapsed
            compact
          />
        </div>
      )}
    </div>
  );
}
