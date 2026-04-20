"use client";

import { useActionState, useState } from "react";

import {
  approveDraftAction,
  discardDraftAction,
  editDraftBodyAction,
  skipDraftAction,
} from "@/lib/actions/messaging.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { Badge } from "@/components/ui/badge";
import { findMessagingTrigger } from "@/lib/taxonomy-loader";
import type { DraftStatus } from "@/lib/services/messaging-automation.service";

interface DraftCardData {
  id: string;
  bodyMd: string;
  channelKey: string | null;
  status: DraftStatus;
  touchpointKey: string | null;
  scheduledSendAt: string | null; // ISO
  reservation: {
    id: string;
    guestName: string;
    checkInDate: string;
    checkOutDate: string;
  } | null;
  automation: {
    id: string;
    triggerType: string;
  } | null;
}

interface DraftCardProps {
  propertyId: string;
  draft: DraftCardData;
}

const STATUS_TONES: Record<DraftStatus, "neutral" | "success" | "warning" | "danger"> = {
  pending_review: "warning",
  approved: "success",
  sent: "success",
  skipped: "neutral",
  cancelled: "neutral",
  error: "danger",
};

const STATUS_LABELS: Record<DraftStatus, string> = {
  pending_review: "Pendiente",
  approved: "Aprobado",
  sent: "Enviado",
  skipped: "Omitido",
  cancelled: "Cancelado",
  error: "Error",
};

type DraftFormAction = (formData: FormData) => void | Promise<void>;

interface LifecycleButtonProps {
  action: DraftFormAction;
  pending: boolean;
  draftId: string;
  propertyId: string;
  variant: "primary" | "ghost" | "danger";
  label: string;
  pendingLabel?: string;
}

function LifecycleButton({
  action,
  pending,
  draftId,
  propertyId,
  variant,
  label,
  pendingLabel,
}: LifecycleButtonProps) {
  const className =
    variant === "primary"
      ? "rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      : variant === "danger"
        ? "rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] disabled:opacity-50"
        : "rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] disabled:opacity-50";
  return (
    <form action={action}>
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="propertyId" value={propertyId} />
      <button type="submit" disabled={pending} className={className}>
        {pending && pendingLabel ? pendingLabel : label}
      </button>
    </form>
  );
}

export function DraftCard({ propertyId, draft }: DraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editSubmitting] = useActionState<
    ActionResult | null,
    FormData
  >(editDraftBodyAction, null);
  const [, approveAction, approving] = useActionState<
    ActionResult | null,
    FormData
  >(approveDraftAction, null);
  const [, skipAction, skipping] = useActionState<
    ActionResult | null,
    FormData
  >(skipDraftAction, null);
  const [, discardAction, discarding] = useActionState<
    ActionResult | null,
    FormData
  >(discardDraftAction, null);

  const trigger = draft.automation
    ? findMessagingTrigger(draft.automation.triggerType)
    : null;

  const canMutate = draft.status === "pending_review";

  return (
    <li className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              label={STATUS_LABELS[draft.status] ?? draft.status}
              tone={STATUS_TONES[draft.status] ?? "neutral"}
            />
            {draft.reservation && (
              <span className="text-sm font-medium text-[var(--foreground)]">
                {draft.reservation.guestName}
              </span>
            )}
            {draft.reservation && (
              <span className="text-xs text-[var(--color-neutral-500)]">
                {draft.reservation.checkInDate} → {draft.reservation.checkOutDate}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
            {trigger?.label ?? draft.automation?.triggerType ?? "Sin trigger"}
            {draft.touchpointKey ? ` · ${draft.touchpointKey}` : ""}
            {draft.channelKey ? ` · ${draft.channelKey}` : ""}
            {draft.scheduledSendAt
              ? ` · envío ${new Date(draft.scheduledSendAt).toLocaleString(
                  "es-ES",
                )}`
              : ""}
          </p>
        </div>

        {canMutate && !editing && (
          <div className="flex shrink-0 items-center gap-2">
            <LifecycleButton
              action={approveAction}
              pending={approving}
              draftId={draft.id}
              propertyId={propertyId}
              variant="primary"
              label="Aprobar"
              pendingLabel="Aprobando…"
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)]"
            >
              Editar
            </button>
            <LifecycleButton
              action={skipAction}
              pending={skipping}
              draftId={draft.id}
              propertyId={propertyId}
              variant="ghost"
              label="Omitir"
            />
            <LifecycleButton
              action={discardAction}
              pending={discarding}
              draftId={draft.id}
              propertyId={propertyId}
              variant="danger"
              label="Descartar"
            />
          </div>
        )}

        {draft.status === "approved" && (
          <div className="shrink-0">
            <LifecycleButton
              action={discardAction}
              pending={discarding}
              draftId={draft.id}
              propertyId={propertyId}
              variant="danger"
              label="Descartar"
            />
          </div>
        )}
      </div>

      {!editing ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--color-neutral-50)] p-3 text-sm text-[var(--foreground)]">
          {draft.bodyMd}
        </pre>
      ) : (
        <form action={editAction} className="mt-3 space-y-3">
          <input type="hidden" name="draftId" value={draft.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          {editState?.error && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-2 text-xs text-[var(--color-danger-700)]">
              {editState.error}
            </p>
          )}
          <textarea
            name="bodyMd"
            defaultValue={draft.bodyMd}
            rows={Math.max(6, draft.bodyMd.split("\n").length + 1)}
            className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={editSubmitting}
              className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-50"
            >
              {editSubmitting ? "Guardando…" : "Guardar edición"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
