"use client";

import { useActionState, useState } from "react";
import { Clock } from "lucide-react";

import {
  approveDraftAction,
  discardDraftAction,
  editDraftBodyAction,
  skipDraftAction,
} from "@/lib/actions/messaging.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { Badge } from "@/components/ui/badge";
import { findMessagingTrigger } from "@/lib/taxonomies/messaging-triggers";
import { normaliseTriggerType } from "@/lib/schemas/messaging.schema";
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

type LifecycleVariant = "primary" | "secondary" | "ghost" | "danger";

const LIFECYCLE_CLASS: Record<LifecycleVariant, string> = {
  primary:
    "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)] hover:bg-[var(--color-action-primary-hover)]",
  secondary:
    "border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-interactive-hover)]",
  ghost:
    "text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)]",
  danger:
    "text-[var(--color-status-error-text)] hover:bg-[var(--color-status-error-bg)]",
};

function lifecycleClass(variant: LifecycleVariant): string {
  return `inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50 ${LIFECYCLE_CLASS[variant]}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface LifecycleButtonProps {
  action: DraftFormAction;
  pending: boolean;
  draftId: string;
  propertyId: string;
  variant: LifecycleVariant;
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
  return (
    <form action={action}>
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="propertyId" value={propertyId} />
      <button type="submit" disabled={pending} className={lifecycleClass(variant)}>
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
    ? findMessagingTrigger(
        normaliseTriggerType(draft.automation.triggerType) ?? draft.automation.triggerType,
      )
    : null;

  const canMutate = draft.status === "pending_review";

  return (
    <li className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {draft.reservation && (
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-action-primary-subtle)] text-xs font-semibold text-[var(--color-action-primary-subtle-fg)]"
            >
              {initials(draft.reservation.guestName)}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                label={STATUS_LABELS[draft.status] ?? draft.status}
                tone={STATUS_TONES[draft.status] ?? "neutral"}
              />
              {draft.reservation && (
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {draft.reservation.guestName}
                </span>
              )}
              {draft.reservation && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {draft.reservation.checkInDate} → {draft.reservation.checkOutDate}
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--color-text-muted)]">
              <span>{trigger?.label ?? draft.automation?.triggerType ?? "Sin trigger"}</span>
              {draft.touchpointKey && <span>· {draft.touchpointKey}</span>}
              {draft.channelKey && <span>· {draft.channelKey}</span>}
              {draft.scheduledSendAt && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-background-muted)] px-2 py-0.5 text-[var(--color-text-secondary)]">
                  <Clock size={11} aria-hidden="true" />
                  {new Date(draft.scheduledSendAt).toLocaleString("es-ES")}
                </span>
              )}
            </p>
          </div>
        </div>

        {canMutate && !editing && (
          <div className="flex flex-wrap items-center justify-start gap-2 sm:shrink-0 sm:justify-end">
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
              className={lifecycleClass("secondary")}
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
        <pre className="mt-3 whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--color-background-subtle)] p-3 text-sm text-[var(--color-text-primary)]">
          {draft.bodyMd}
        </pre>
      ) : (
        <form action={editAction} className="mt-3 space-y-3">
          <input type="hidden" name="draftId" value={draft.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          {editState?.error && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-status-error-bg)] p-2 text-xs text-[var(--color-status-error-text)]">
              {editState.error}
            </p>
          )}
          <textarea
            name="bodyMd"
            defaultValue={draft.bodyMd}
            rows={Math.max(6, draft.bodyMd.split("\n").length + 1)}
            className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm leading-relaxed text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={editSubmitting}
              className={lifecycleClass("primary")}
            >
              {editSubmitting ? "Guardando…" : "Guardar edición"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={lifecycleClass("ghost")}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
