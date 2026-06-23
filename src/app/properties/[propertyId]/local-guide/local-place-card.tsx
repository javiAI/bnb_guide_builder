"use client";

import {
  useActionState,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Footprints } from "lucide-react";
import {
  updateLocalPlaceAction,
  deleteLocalPlaceAction,
} from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { formatDistance } from "@/lib/services/places";
import { findLocalPlaceCategory } from "@/lib/taxonomies/local-place-categories";
import { getLocalPlaceIcon } from "@/lib/icons/local-place-icons";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { autoSaveSubmit, useFormAutoSave } from "@/lib/use-form-auto-save";
import {
  EntityMediaCard,
  EntityCardStatusPill,
  type EntityCardRole,
  type EntityCardStatus,
} from "@/components/ui/entity-media-card";
import { DeleteConfirmationButton } from "@/components/ui/delete-confirmation-button";
import { InlineEditText } from "@/components/ui/inline-edit-text";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { FieldInput, FieldTextarea } from "@/components/ui/field";
import {
  resolveLocalPlaceStatus,
  missingLocalPlaceSignals,
  type LocalPlaceProgressLevel,
} from "./local-place-progress";

/** Serializable card payload prepared by the server page. */
export interface LocalPlaceData {
  id: string;
  name: string;
  categoryKey: string;
  shortNote: string | null;
  guestDescription: string | null;
  hoursText: string | null;
  linkUrl: string | null;
  distanceMeters: number | null;
  address: string | null;
}

export interface LocalPlaceCategoryOption {
  id: string;
  label: string;
}

interface LocalPlaceCardProps {
  propertyId: string;
  place: LocalPlaceData;
  /** Single-select category chips for the editor — taxonomy `lp.*` minus the
   * `lp.arrival_*` modes (those are managed from the Access cockpit). */
  categoryOptions: ReadonlyArray<LocalPlaceCategoryOption>;
  /** Accordion role + handlers (owned by the parent grid via useCockpitAccordion). */
  role: EntityCardRole;
  onExpand: () => void;
  onCollapse: () => void;
}

// Domain copy over the canonical entity-card status vocabulary (check/dot/dashed).
const STATUS_KEY: Record<LocalPlaceProgressLevel, EntityCardStatus> = {
  complete: "complete",
  partial: "partial",
  empty: "empty",
};
const STATUS_LABEL: Record<LocalPlaceProgressLevel, string> = {
  complete: "Completo",
  partial: "En progreso",
  empty: "Sin datos",
};

export function LocalPlaceCard({
  propertyId,
  place,
  categoryOptions,
  role,
  onExpand,
  onCollapse,
}: LocalPlaceCardProps) {
  const titleId = useId();
  const bodyId = useId();

  const TypeIcon = getLocalPlaceIcon(place.categoryKey);
  const categoryLabel =
    findLocalPlaceCategory(place.categoryKey)?.label ?? place.categoryKey;

  const { progressLevel, statusDetail } = useMemo(() => {
    const missing = missingLocalPlaceSignals(place);
    return {
      progressLevel: resolveLocalPlaceStatus(place),
      statusDetail: missing.length > 0 ? `Falta: ${missing.join(", ")}` : undefined,
    };
  }, [place]);

  // ── Category chips (controlled state → hidden mirror in the autosave form) ──
  const [categoryKey, setCategoryKey] = useState(place.categoryKey);

  // ── Rename — inline on the card title; same action as the details editor ──
  const [renameState, renameDispatch, renamePending] = useActionState<
    ActionResult | null,
    FormData
  >(updateLocalPlaceAction, null);
  const [, startRenameTransition] = useTransition();
  const handleRename = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed || trimmed === place.name) return;
      const fd = new FormData();
      fd.append("placeId", place.id);
      fd.append("propertyId", propertyId);
      fd.append("name", trimmed);
      // useActionState dispatch must run inside a transition (imperative call).
      startRenameTransition(() => {
        renameDispatch(fd);
      });
    },
    [place.id, place.name, propertyId, renameDispatch],
  );

  // ── Details editor — auto-saved (no "Guardar"); flush on collapse ──
  const formRef = useRef<HTMLFormElement>(null);
  const flush = useFormAutoSave(formRef);
  const [detailsState, detailsDispatch, detailsPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateLocalPlaceAction, null);
  const handleCollapse = useCallback(() => {
    flush();
    onCollapse();
  }, [flush, onCollapse]);

  // ── Delete — the action cross-checks propertyId, which the shared dialog's
  // single hidden field can't carry; this client wrapper threads it in. ──
  const deletePlace = useCallback(
    async (prev: ActionResult | null, formData: FormData) => {
      formData.set("propertyId", propertyId);
      return deleteLocalPlaceAction(prev, formData);
    },
    [propertyId],
  );
  const deleteDescription = `Se eliminará "${place.name}" de la guía local. Esta acción no se puede deshacer.`;

  // ── Collapsed facts — distance + short note. Always rendered (min-h) so the
  // bottom-right delete overlay never lands on the header/status row; `pr-12`
  // keeps the text clear of that corner. ──
  const note = place.shortNote ?? place.guestDescription;
  const collapsedContent = (
    <div className="flex min-h-[20px] w-full flex-wrap items-center gap-x-3 gap-y-1 pr-12 text-[12px] text-[var(--color-text-secondary)]">
      {place.distanceMeters != null && (
        <span className="inline-flex flex-none items-center gap-1">
          <Footprints
            size={13}
            aria-hidden="true"
            className="text-[var(--color-text-muted)]"
          />
          {formatDistance(place.distanceMeters)}
        </span>
      )}
      {note && <span className="min-w-0 line-clamp-1">{note}</span>}
    </div>
  );

  // Hover-revealed on fine pointers (clean idle card), always visible on coarse
  // (no hover on touch) — same overlay contract as the Spaces cockpit.
  const hoverOverlay = (
    <div className="absolute bottom-3 right-3 z-20 flex items-center opacity-0 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100">
      <DeleteConfirmationButton
        title="Eliminar lugar"
        description={deleteDescription}
        entityId={place.id}
        fieldName="placeId"
        action={deletePlace}
        triggerClassName="rounded-full bg-[var(--color-background-muted)]"
      />
    </div>
  );

  const renameError =
    renameState && !renameState.success
      ? (renameState.error ?? renameState.fieldErrors?.name?.[0] ?? null)
      : null;
  const detailsError =
    detailsState && !detailsState.success
      ? (detailsState.error ??
        Object.values(detailsState.fieldErrors ?? {}).flat()[0] ??
        null)
      : null;

  // ── Editor body — only built in the active role (EntityMediaCard ignores
  // children when collapsed). Lean field set (D4): categoría · distancia ·
  // nota rápida · descripción · horario · enlace. No HTML `required` — the
  // form auto-saves incrementally and `requestSubmit()` refuses invalid forms.
  const editor =
    role !== "active" ? null : (
      <div className="space-y-5">
        {renameError && (
          <p className="-mt-1 text-xs text-[var(--color-status-error-text)]">
            {renameError}
          </p>
        )}

        <form
          ref={formRef}
          onSubmit={autoSaveSubmit(detailsDispatch)}
          className="space-y-5"
        >
          <input type="hidden" name="placeId" value={place.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="categoryKey" value={categoryKey} />

          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
              Categoría
            </p>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((opt) => (
                <ToggleChip
                  key={opt.id}
                  active={categoryKey === opt.id}
                  hideCheck
                  onToggle={() => setCategoryKey(opt.id)}
                >
                  {opt.label}
                </ToggleChip>
              ))}
            </div>
          </div>

          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <FieldInput
              label="Distancia (metros)"
              name="distanceMeters"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={place.distanceMeters ?? ""}
              placeholder="200"
            />
            <FieldInput
              label="Nota rápida"
              name="shortNote"
              type="text"
              defaultValue={place.shortNote ?? ""}
              help="Una frase tuya — aparece bajo el nombre en la guía."
            />
          </div>

          <FieldTextarea
            label="Descripción"
            name="guestDescription"
            rows={2}
            defaultValue={place.guestDescription ?? ""}
            placeholder="Cuéntale al huésped por qué recomiendas este sitio…"
          />

          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <FieldInput
              label="Horario"
              name="hoursText"
              type="text"
              defaultValue={place.hoursText ?? ""}
              placeholder="Ej: Mar–Sáb 7:30–14:30"
            />
            {/* type="text", not "url": native URL validation on a half-typed
               value would block the whole form's incremental auto-save. */}
            <FieldInput
              label="Enlace"
              name="linkUrl"
              type="text"
              defaultValue={place.linkUrl ?? ""}
              placeholder="https://…"
            />
          </div>
        </form>

        {/* Footer — autosave status (left) + a clearly-labeled delete (right). */}
        <div className="flex items-center justify-between border-t border-[var(--color-border-default)] pt-4">
          <div className="flex items-center gap-3">
            <AutoSaveStatus pending={detailsPending || renamePending} />
            {detailsError && (
              <span className="text-xs text-[var(--color-status-error-text)]">
                {detailsError}
              </span>
            )}
          </div>
          <DeleteConfirmationButton
            title="Eliminar lugar"
            triggerLabel="Eliminar lugar"
            description={deleteDescription}
            entityId={place.id}
            fieldName="placeId"
            action={deletePlace}
          />
        </div>
      </div>
    );

  return (
    <EntityMediaCard
      role={role}
      compact
      viewTransitionName={`local-place-card-${place.id}`}
      titleId={titleId}
      bodyId={bodyId}
      icon={TypeIcon}
      title={place.name}
      titleNode={
        role === "active" ? (
          <InlineEditText
            value={place.name}
            onCommit={handleRename}
            placeholder="Nombre del lugar"
            ariaLabel="Nombre del lugar"
            textClassName="text-[16px] font-semibold leading-tight text-[var(--color-text-primary)]"
            withTooltip
          />
        ) : undefined
      }
      subtitle={
        role === "active"
          ? `${categoryLabel}${place.address ? ` · ${place.address}` : ""}`
          : undefined
      }
      status={
        <EntityCardStatusPill
          status={STATUS_KEY[progressLevel]}
          label={STATUS_LABEL[progressLevel]}
          detail={statusDetail}
        />
      }
      collapsedContent={collapsedContent}
      hoverOverlay={hoverOverlay}
      onExpand={onExpand}
      onCollapse={handleCollapse}
    >
      {editor}
    </EntityMediaCard>
  );
}
