"use client";

import { useState, useTransition } from "react";
import { updateAmenityAction, toggleAmenityAction, type ActionResult } from "@/lib/actions/editor.actions";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
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
  const [saveResult, setSaveResult] = useState<ActionResult | null>(null);

  const [details, setDetails] = useState<Record<string, unknown>>(
    item.detailsJson ?? {},
  );

  function handleFieldChange(fieldId: string, value: unknown) {
    setDetails((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSave() {
    // If no DB row yet (e.g. canonicalOwner auto-enabled), create it first
    if (!item.dbId) {
      const createFd = new FormData();
      createFd.set("propertyId", propertyId);
      createFd.set("amenityKey", item.id);
      createFd.set("enabled", "true");
      if (spaceId) createFd.set("spaceId", spaceId);

      startTransition(async () => {
        await toggleAmenityAction(null, createFd);
        // After creating, the page will revalidate and we get a dbId
        // For now, just signal success
        setSaveResult({ success: true });
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
      const result = await updateAmenityAction(null, formData);
      setSaveResult(result);
    });
  }

  const saveStatus = isPending
    ? "saving" as const
    : saveResult?.success
      ? "saved" as const
      : saveResult?.error
        ? "error" as const
        : undefined;

  const visibleFields = item.subtypeFields.filter((f) => isFieldVisible(f, details));

  return (
    <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-[var(--foreground)]">
          {item.label}
        </h4>
        {saveStatus && <InlineSaveStatus status={saveStatus} />}
      </div>

      {saveResult?.error && (
        <p className="mb-3 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-2 text-xs text-[var(--color-danger-700)]">
          {saveResult.error}
        </p>
      )}


      <div className="space-y-3">
        {visibleFields.map((field) => {
          // Boolean fields render their own label inline
          if (field.type === "boolean") {
            return (
              <SubtypeFieldInput
                key={field.id}
                field={field}
                value={details[field.id]}
                onChange={handleFieldChange}
              />
            );
          }
          return (
            <div key={field.id}>
              <label className="block">
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {field.label}
                </span>
                {field.description && (
                  <span className="ml-1 text-[10px] text-[var(--color-neutral-400)]">
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

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
        >
          {isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {/* Photos for this amenity instance */}
      {item.dbId && (
        <div className="mt-4 border-t border-[var(--color-neutral-200)] pt-3">
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
