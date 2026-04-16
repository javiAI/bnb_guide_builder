"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  createMaintenanceTaskAction,
  deleteMaintenanceTaskAction,
} from "@/lib/actions/ops.actions";
import type { ActionResult } from "@/lib/types/action-result";

const TASK_TYPES = [
  { id: "plumbing", label: "Fontanería" },
  { id: "electrical", label: "Electricidad" },
  { id: "appliance", label: "Electrodoméstico" },
  { id: "hvac", label: "Climatización" },
  { id: "structural", label: "Estructura" },
  { id: "garden", label: "Jardín/Exterior" },
  { id: "other", label: "Otro" },
];

const CADENCE_OPTIONS = [
  { id: "weekly", label: "Semanal" },
  { id: "monthly", label: "Mensual" },
  { id: "quarterly", label: "Trimestral" },
  { id: "biannual", label: "Semestral" },
  { id: "annual", label: "Anual" },
  { id: "on_demand", label: "Bajo demanda" },
];

interface MaintenanceTaskData {
  id: string;
  taskType: string;
  title: string;
  cadenceKey: string | null;
  nextDueAt: string | null;
  ownerNote: string | null;
}

interface OpsMaintenanceSectionProps {
  tasks: MaintenanceTaskData[];
  propertyId: string;
}

export function OpsMaintenanceSection({ tasks, propertyId }: OpsMaintenanceSectionProps) {
  const [createState, createAction, createPending] = useActionState<ActionResult | null, FormData>(
    createMaintenanceTaskAction,
    null,
  );

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  const fieldError = (field: string) =>
    createState?.fieldErrors?.[field]?.[0];

  return (
    <div>
      {tasks.length === 0 ? (
        <p className="text-xs text-[var(--color-neutral-400)]">Sin tareas de mantenimiento.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <MaintenanceRow key={task.id} task={task} propertyId={propertyId} />
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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Tipo *</span>
            <select name="taskType" required className={inputClass}>
              <option value="">— Seleccionar —</option>
              {TASK_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            {fieldError("taskType") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("taskType")}</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Título *</span>
            <input name="title" type="text" required placeholder="Ej: Revisar caldera" className={inputClass} />
            {fieldError("title") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("title")}</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Cadencia</span>
            <select name="cadenceKey" defaultValue="" className={inputClass}>
              <option value="">— Sin cadencia —</option>
              {CADENCE_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Próxima fecha</span>
            <input name="nextDueAt" type="date" className={inputClass} />
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

function MaintenanceRow({ task, propertyId }: { task: MaintenanceTaskData; propertyId: string }) {
  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteMaintenanceTaskAction,
    null,
  );

  const typeLabel = TASK_TYPES.find((t) => t.id === task.taskType)?.label ?? task.taskType;
  const cadenceLabel = CADENCE_OPTIONS.find((c) => c.id === task.cadenceKey)?.label;
  const isOverdue = task.nextDueAt && new Date(task.nextDueAt) < new Date();

  return (
    <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">{task.title}</span>
          <Badge label={typeLabel} tone="neutral" />
          {cadenceLabel && <Badge label={cadenceLabel} tone="neutral" />}
          {isOverdue && <Badge label="Vencida" tone="danger" />}
        </div>
        {task.nextDueAt && (
          <span className="text-xs text-[var(--color-neutral-400)]">
            Próxima: {new Date(task.nextDueAt).toLocaleDateString("es-ES")}
          </span>
        )}
      </div>
      <form action={deleteAction} className="shrink-0">
        <input type="hidden" name="itemId" value={task.id} />
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
