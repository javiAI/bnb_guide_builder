"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  createStockItemAction,
  deleteStockItemAction,
} from "@/lib/actions/ops.actions";
import type { ActionResult } from "@/lib/types/action-result";

const STOCK_CATEGORIES = [
  { id: "toiletries", label: "Artículos de baño" },
  { id: "cleaning", label: "Limpieza" },
  { id: "kitchen", label: "Cocina" },
  { id: "bedding", label: "Ropa de cama" },
  { id: "general", label: "General" },
];

interface StockItemData {
  id: string;
  categoryKey: string;
  name: string;
  restockThreshold: number | null;
  locationNote: string | null;
  unitLabel: string | null;
}

interface OpsStockSectionProps {
  items: StockItemData[];
  propertyId: string;
}

export function OpsStockSection({ items, propertyId }: OpsStockSectionProps) {
  const [createState, createAction, createPending] = useActionState<ActionResult | null, FormData>(
    createStockItemAction,
    null,
  );

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  const fieldError = (field: string) =>
    createState?.fieldErrors?.[field]?.[0];

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--color-neutral-400)]">Sin items de stock.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <StockRow key={item.id} item={item} propertyId={propertyId} />
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
            <span className="text-xs text-[var(--color-neutral-500)]">Categoría *</span>
            <select name="categoryKey" required className={inputClass}>
              <option value="">— Seleccionar —</option>
              {STOCK_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {fieldError("categoryKey") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("categoryKey")}</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Nombre *</span>
            <input name="name" type="text" required placeholder="Ej: Jabón de manos" className={inputClass} />
            {fieldError("name") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">{fieldError("name")}</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">Umbral reposición</span>
            <input name="restockThreshold" type="number" min={1} placeholder="5" className={inputClass} />
          </label>
        </div>

        <button
          type="submit"
          disabled={createPending}
          className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
        >
          {createPending ? "Añadiendo…" : "Añadir item"}
        </button>
      </form>
    </div>
  );
}

function StockRow({ item, propertyId }: { item: StockItemData; propertyId: string }) {
  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteStockItemAction,
    null,
  );

  const catLabel = STOCK_CATEGORIES.find((c) => c.id === item.categoryKey)?.label ?? item.categoryKey;

  return (
    <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">{item.name}</span>
          <Badge label={catLabel} tone="neutral" />
        </div>
        <div className="mt-0.5 text-xs text-[var(--color-neutral-400)]">
          {item.restockThreshold && <span>Reponer a ≤{item.restockThreshold} {item.unitLabel ?? "uds"}</span>}
          {item.locationNote && <span className="ml-2">· {item.locationNote}</span>}
        </div>
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
