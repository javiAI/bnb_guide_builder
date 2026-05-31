"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  updateMessageTemplateAction,
  deleteMessageTemplateAction,
} from "@/lib/actions/messaging.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { automationChannels } from "@/lib/taxonomies/automation-channels";
import { getItems } from "@/lib/taxonomies/_helpers";
import type { BadgeTone } from "@/lib/types";
import { MessageBodyEditor } from "./message-body-editor";
import { INPUT_CLASS, PRIMARY_BTN, SECONDARY_BTN } from "./_styles";

const channels = getItems(automationChannels);

interface TemplateData {
  id: string;
  bodyMd: string;
  channelKey: string | null;
  subjectLine: string | null;
  status: string;
  language: string;
}

interface TemplateCardProps {
  template: TemplateData;
  propertyId: string;
  statusLabel: string;
  statusTone: BadgeTone;
  channelLabel: string | null;
}

export function TemplateCard({
  template,
  propertyId,
  statusLabel,
  statusTone,
  channelLabel,
}: TemplateCardProps) {
  const [editing, setEditing] = useState(false);

  const [updateState, updateAction, updatePending] = useActionState<ActionResult | null, FormData>(
    updateMessageTemplateAction,
    null,
  );

  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteMessageTemplateAction,
    null,
  );

  const fieldError = (field: string) =>
    updateState?.fieldErrors?.[field]?.[0];

  if (editing) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5">
        <form action={updateAction}>
          <input type="hidden" name="templateId" value={template.id} />
          <input type="hidden" name="propertyId" value={propertyId} />

          {updateState?.error && (
            <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-status-error-bg)] p-3 text-sm text-[var(--color-status-error-text)]">
              {updateState.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Canal</span>
              <select name="channelKey" defaultValue={template.channelKey ?? ""} className={INPUT_CLASS}>
                <option value="">— Por defecto —</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Estado</span>
              <select name="status" defaultValue={template.status} className={INPUT_CLASS}>
                <option value="draft">Borrador</option>
                <option value="active">Activa</option>
                <option value="archived">Archivada</option>
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Asunto</span>
              <input name="subjectLine" type="text" defaultValue={template.subjectLine ?? ""} className={INPUT_CLASS} />
            </label>

            <div className="sm:col-span-2">
              <MessageBodyEditor
                propertyId={propertyId}
                name="bodyMd"
                required
                defaultValue={template.bodyMd}
                fieldError={fieldError("bodyMd")}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={updatePending} className={PRIMARY_BTN}>
              {updatePending ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className={SECONDARY_BTN}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {template.subjectLine && (
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {template.subjectLine}
              </span>
            )}
            <Badge label={statusLabel} tone={statusTone} />
            {channelLabel && <Badge label={channelLabel} tone="neutral" />}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {template.bodyMd}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] px-3 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
          >
            Editar
          </button>
          <form action={deleteAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <input type="hidden" name="propertyId" value={propertyId} />
            <button
              type="submit"
              disabled={deletePending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-status-error-border)] px-3 text-xs font-medium text-[var(--color-status-error-text)] transition-colors hover:bg-[var(--color-status-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:opacity-50"
            >
              {deletePending ? "…" : "Eliminar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
