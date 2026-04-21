"use client";

import { useActionState } from "react";
import { deleteLocalPlaceAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { formatDistance } from "@/lib/services/places";

interface LocalPlaceCardProps {
  propertyId: string;
  place: {
    id: string;
    name: string;
    shortNote: string | null;
    distanceMeters: number | null;
  };
}

export function LocalPlaceCard({ propertyId, place }: LocalPlaceCardProps) {
  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteLocalPlaceAction,
    null,
  );

  return (
    <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
      <div>
        <h3 className="text-sm font-medium text-[var(--foreground)]">
          {place.name}
        </h3>
        <div className="mt-0.5 flex gap-3 text-xs text-[var(--color-neutral-500)]">
          {place.shortNote && <span>{place.shortNote}</span>}
          {place.distanceMeters != null && (
            <span>{formatDistance(place.distanceMeters)}</span>
          )}
        </div>
      </div>
      <form action={deleteAction}>
        <input type="hidden" name="placeId" value={place.id} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <button
          type="submit"
          disabled={deletePending}
          className="text-xs text-[var(--color-neutral-400)] hover:text-[var(--color-danger-500)] disabled:opacity-50"
        >
          {deletePending ? "…" : "Eliminar"}
        </button>
      </form>
    </div>
  );
}
