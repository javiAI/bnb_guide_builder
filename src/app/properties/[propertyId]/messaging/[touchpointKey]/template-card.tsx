"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  updateMessageTemplateAction,
  deleteMessageTemplateAction,
  type ActionResult,
} from "@/lib/actions/messaging.actions";
import { validateVariables } from "@/lib/schemas/messaging.schema";
import { automationChannels, getItems } from "@/lib/taxonomy-loader";
import type { BadgeTone } from "@/lib/types";

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

  // Variable validation preview
  const { unknown } = validateVariables(template.bodyMd);

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  const fieldError = (field: string) =>
    updateState?.fieldErrors?.[field]?.[0];

  if (editing) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <form action={updateAction}>
          <input type="hidden" name="templateId" value={template.id} />
          <input type="hidden" name="propertyId" value={propertyId} />

          {updateState?.error && (
            <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
              {updateState.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-[var(--color-neutral-500)]">Canal</span>
              <select name="channelKey" defaultValue={template.channelKey ?? ""} className={inputClass}>
                <option value="">— Por defecto —</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-[var(--color-neutral-500)]">Estado</span>
              <select name="status" defaultValue={template.status} className={inputClass}>
                <option value="draft">Borrador</option>
                <option value="active">Activa</option>
                <option value="archived">Archivada</option>
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs text-[var(--color-neutral-500)]">Asunto</span>
              <input name="subjectLine" type="text" defaultValue={template.subjectLine ?? ""} className={inputClass} />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs text-[var(--color-neutral-500)]">Contenido *</span>
              <textarea
                name="bodyMd"
                required
                rows={4}
                defaultValue={template.bodyMd}
                className={inputClass}
              />
              {fieldError("bodyMd") && (
                <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("bodyMd")}</p>
              )}
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={updatePending}
              className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
            >
              {updatePending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--color-neutral-100)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {template.subjectLine && (
              <span className="text-sm font-medium text-[var(--foreground)]">
                {template.subjectLine}
              </span>
            )}
            <Badge label={statusLabel} tone={statusTone} />
            {channelLabel && (
              <Badge label={channelLabel} tone="neutral" />
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--color-neutral-500)]">
            {template.bodyMd}
          </p>
          {unknown.length > 0 && (
            <p className="mt-1 text-xs text-[var(--color-warning-600)]">
              Variables desconocidas: {unknown.map((v) => `{{${v}}}`).join(", ")}
            </p>
          )}
        </div>

        <div className="ml-4 flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--color-neutral-100)]"
          >
            Editar
          </button>
          <form action={deleteAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <input type="hidden" name="propertyId" value={propertyId} />
            <button
              type="submit"
              disabled={deletePending}
              className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] px-3 py-1.5 text-xs font-medium text-[var(--color-danger-600)] transition-colors hover:bg-[var(--color-danger-50)] disabled:opacity-50"
            >
              {deletePending ? "…" : "Eliminar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
