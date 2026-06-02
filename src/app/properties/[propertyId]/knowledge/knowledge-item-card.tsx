"use client";

import { useState, useActionState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { useFormAutoSave } from "@/lib/use-form-auto-save";
import {
  updateKnowledgeItemAction,
  deleteKnowledgeItemAction,
} from "@/lib/actions/knowledge.actions";
import type { ActionResult } from "@/lib/types/action-result";
import type { BadgeTone } from "@/lib/types";

interface KnowledgeItemData {
  id: string;
  topic: string;
  bodyMd: string;
  visibility: string;
  journeyStage: string | null;
  confidenceScore: number | null;
  lastVerifiedAt: string | null;
  chunkType: string;
  entityType: string;
  contextPrefix: string;
}

interface KnowledgeItemCardProps {
  item: KnowledgeItemData;
  propertyId: string;
  visibilityLabel: string;
  visibilityTone: BadgeTone;
  journeyLabel: string | null;
}

export function KnowledgeItemCard({
  item,
  propertyId,
  visibilityLabel,
  visibilityTone,
  journeyLabel,
}: KnowledgeItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [prefixOpen, setPrefixOpen] = useState(false);

  const [updateState, updateAction, updatePending] = useActionState<ActionResult | null, FormData>(
    updateKnowledgeItemAction,
    null,
  );

  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteKnowledgeItemAction,
    null,
  );

  // Auto-save: edits persist as you make them (no "Guardar" button). The form
  // mounts only when editing, so the hook re-attaches when it appears; `flush()`
  // before closing guarantees the last keystroke persists. `topic`/`bodyMd` are
  // required, so the validity gate skips saving an emptied title/body.
  const formRef = useRef<HTMLFormElement>(null);
  const flush = useFormAutoSave(formRef);
  const closeEditing = () => {
    flush();
    setEditing(false);
  };

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none";

  const fieldError = (field: string) =>
    updateState?.fieldErrors?.[field]?.[0];

  if (editing) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5">
        <form ref={formRef} action={updateAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="propertyId" value={propertyId} />

          {updateState?.error && (
            <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-status-error-bg)] p-3 text-sm text-[var(--color-status-error-text)]">
              {updateState.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs text-[var(--color-text-muted)]">Tema *</span>
              <input name="topic" type="text" required defaultValue={item.topic} className={inputClass} />
              {fieldError("topic") && (
                <p className="mt-1 text-xs text-[var(--color-status-error-text)]">{fieldError("topic")}</p>
              )}
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs text-[var(--color-text-muted)]">Contenido (Markdown) *</span>
              <textarea
                name="bodyMd"
                required
                rows={4}
                defaultValue={item.bodyMd}
                className={inputClass}
              />
              {fieldError("bodyMd") && (
                <p className="mt-1 text-xs text-[var(--color-status-error-text)]">{fieldError("bodyMd")}</p>
              )}
            </label>

            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Visibilidad</span>
              <select name="visibility" defaultValue={item.visibility} className={inputClass}>
                <option value="guest">Huésped</option>
                <option value="ai">AI</option>
                <option value="internal">Interno</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Etapa del journey</span>
              <select name="journeyStage" defaultValue={item.journeyStage ?? ""} className={inputClass}>
                <option value="">— Sin etapa —</option>
                <option value="pre_booking">Pre-reserva</option>
                <option value="post_booking">Post-reserva</option>
                <option value="pre_arrival">Pre-llegada</option>
                <option value="during_stay">Durante estancia</option>
                <option value="post_stay">Post-estancia</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={closeEditing}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-5 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)]"
            >
              Listo
            </button>
            <AutoSaveStatus pending={updatePending} />
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              {item.topic}
            </h3>
            <Badge label={visibilityLabel} tone={visibilityTone} />
            {journeyLabel && (
              <Badge label={journeyLabel} tone="neutral" />
            )}
            {item.entityType && item.entityType !== "property" && (
              <Badge label={item.entityType} tone="neutral" />
            )}
            {item.chunkType && item.chunkType !== "fact" && (
              <Badge label={item.chunkType} tone="neutral" />
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">
            {item.bodyMd}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            {item.confidenceScore != null && (
              <span>Confianza: {Math.round(item.confidenceScore * 100)}%</span>
            )}
            {item.lastVerifiedAt && (
              <span>Verificado: {new Date(item.lastVerifiedAt).toLocaleDateString("es-ES")}</span>
            )}
          </div>
          {item.contextPrefix && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setPrefixOpen((v) => !v)}
                className="text-xs text-[var(--color-text-link)] hover:underline"
              >
                {prefixOpen ? "Ocultar contexto IA" : "Ver contexto IA"}
              </button>
              {prefixOpen && (
                <pre className="mt-1 whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--color-background-muted)] p-2 text-xs text-[var(--color-text-secondary)]">
                  {item.contextPrefix}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="ml-4 flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-interactive-hover)]"
          >
            Editar
          </button>
          <form action={deleteAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="propertyId" value={propertyId} />
            <button
              type="submit"
              disabled={deletePending}
              className="rounded-[var(--radius-md)] border border-[var(--color-status-error-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-status-error-text)] transition-colors hover:bg-[var(--color-status-error-bg)] disabled:opacity-50"
            >
              {deletePending ? "…" : "Eliminar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
