"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  createChecklistItemAction,
  deleteChecklistItemAction,
  type ActionResult,
} from "@/lib/actions/ops.actions";

const SCOPE_OPTIONS = [
  { id: "turnover", label: "Entre huéspedes" },
  { id: "weekly", label: "Semanal" },
  { id: "monthly", label: "Mensual" },
  { id: "seasonal", label: "Estacional" },
];

interface ChecklistItemData {
  id: string;
  scopeKey: string;
  title: string;
  detailsMd: string | null;
  estimatedMinutes: number | null;
  required: boolean;
}

interface OpsChecklistSectionProps {
  items: ChecklistItemData[];
  propertyId: string;
}

export function OpsChecklistSection({ items, propertyId }: OpsChecklistSectionProps) {
  const [createState, createAction, createPending] = useActionState<ActionResult | null, FormData>(
    createChecklistItemAction,
    null,
  );

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  const fieldError = (field: string) =>
    createState?.fieldErrors?.[field]?.[0];

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--color-neutral-400)]">Sin tareas de checklist.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ChecklistRow key={item.id} item={item} propertyId={propertyId} />
          ))}
        </div>
      )}

      <form action={createAction} className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <input type="hidden" name="propertyId" value={propertyId} />

        {createState?.error && (
          <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
            {createState.error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Alcance *</span>
            <select name="scopeKey" required className={inputClass}>
              <option value="">— Seleccionar —</option>
              {SCOPE_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {fieldError("scopeKey") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("scopeKey")}</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Tarea *</span>
            <input name="title" type="text" required placeholder="Ej: Cambiar sábanas" className={inputClass} />
            {fieldError("title") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("title")}</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Minutos estimados</span>
            <input name="estimatedMinutes" type="number" min={1} placeholder="15" className={inputClass} />
          </label>
        </div>

        <button
          type="submit"
          disabled={createPending}
          className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
        >
          {createPending ? "Añadiendo…" : "Añadir tarea"}
        </button>
      </form>
    </div>
  );
}

function ChecklistRow({ item, propertyId }: { item: ChecklistItemData; propertyId: string }) {
  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteChecklistItemAction,
    null,
  );

  const scopeLabel = SCOPE_OPTIONS.find((s) => s.id === item.scopeKey)?.label ?? item.scopeKey;

  return (
    <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">{item.title}</span>
          <Badge label={scopeLabel} tone="neutral" />
          {item.required && <Badge label="Obligatorio" tone="warning" />}
        </div>
        {item.estimatedMinutes && (
          <span className="text-xs text-[var(--color-neutral-400)]">
            ~{item.estimatedMinutes} min
          </span>
        )}
      </div>
      <form action={deleteAction} className="shrink-0">
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <button
          type="submit"
          disabled={deletePending}
          className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] px-2 py-1 text-xs text-[var(--color-danger-600)] transition-colors hover:bg-[var(--color-danger-50)] disabled:opacity-50"
        >
          {deletePending ? "…" : "×"}
        </button>
      </form>
    </div>
  );
}
