"use client";

import { useActionState, useState } from "react";
import {
  addBedAction,
  updateBedAction,
  deleteBedAction,
  type ActionResult,
} from "@/lib/actions/editor.actions";
import { bedTypes, getItems, findItem } from "@/lib/taxonomy-loader";
import { NumberStepper } from "@/components/ui/number-stepper";

const bedTypeOptions = getItems(bedTypes);

export interface BedData {
  id: string;
  bedType: string;
  quantity: number;
}

interface BedManagerProps {
  propertyId: string;
  spaceId: string;
  beds: BedData[];
}

export function BedManager({ propertyId, spaceId, beds }: BedManagerProps) {
  const [addState, addAction, addPending] = useActionState<ActionResult | null, FormData>(
    addBedAction,
    null,
  );

  const [selectedType, setSelectedType] = useState("");
  const [quantity, setQuantity] = useState(1);

  const totalCapacity = beds.reduce((sum, bed) => {
    const typeInfo = findItem(bedTypes, bed.bedType);
    const cap = typeInfo?.sleepingCapacity;
    return sum + (cap ?? 1) * bed.quantity;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Camas</h3>
        {beds.length > 0 && (
          <span className="text-xs text-[var(--color-neutral-500)]">
            Capacidad: {totalCapacity} {totalCapacity === 1 ? "persona" : "personas"}
          </span>
        )}
      </div>

      {beds.length > 0 ? (
        <div className="space-y-2">
          {beds.map((bed) => (
            <BedRow key={bed.id} bed={bed} propertyId={propertyId} spaceId={spaceId} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-neutral-400)]">
          Sin camas definidas en este espacio.
        </p>
      )}

      <form
        action={addAction}
        className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-neutral-300)] bg-[var(--surface)] p-4"
      >
        <input type="hidden" name="spaceId" value={spaceId} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="quantity" value={quantity} />

        {addState?.error && (
          <p className="mb-3 text-xs text-[var(--color-danger-500)]">{addState.error}</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-xs text-[var(--color-neutral-500)]">Tipo de cama</span>
            <select
              name="bedType"
              required
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            >
              <option value="">— Seleccionar —</option>
              {bedTypeOptions.map((bt) => (
                <option key={bt.id} value={bt.id}>
                  {bt.label}
                  {bt.recommended ? " ★" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="w-full sm:w-48">
            <NumberStepper label="Cantidad" value={quantity} min={1} max={10} onChange={setQuantity} />
          </div>

          <button
            type="submit"
            disabled={addPending || !selectedType}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
          >
            {addPending ? "Añadiendo…" : "Añadir"}
          </button>
        </div>

        {addState?.fieldErrors?.bedType && (
          <p className="mt-1 text-xs text-[var(--color-danger-500)]">
            {addState.fieldErrors.bedType[0]}
          </p>
        )}
      </form>
    </div>
  );
}

function BedRow({
  bed,
  propertyId,
  spaceId,
}: {
  bed: BedData;
  propertyId: string;
  spaceId: string;
}) {
  const [quantity, setQuantity] = useState(bed.quantity);
  const [, updateAction, updatePending] = useActionState<ActionResult | null, FormData>(
    updateBedAction,
    null,
  );
  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteBedAction,
    null,
  );

  const typeInfo = findItem(bedTypes, bed.bedType);
  const cap = typeInfo?.sleepingCapacity;
  const bedCapacity = (cap ?? 1) * quantity;
  const dirty = quantity !== bed.quantity;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
      <div className="flex-1">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {typeInfo?.label ?? bed.bedType}
        </span>
        <span className="ml-2 text-xs text-[var(--color-neutral-400)]">
          {bedCapacity} {bedCapacity === 1 ? "pers." : "pers."}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <NumberStepper
          label={`Cantidad de ${typeInfo?.label ?? bed.bedType}`}
          value={quantity}
          min={1}
          max={10}
          onChange={setQuantity}
        />

        {dirty && (
          <form action={updateAction}>
            <input type="hidden" name="bedId" value={bed.id} />
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="spaceId" value={spaceId} />
            <input type="hidden" name="bedType" value={bed.bedType} />
            <input type="hidden" name="quantity" value={quantity} />
            <button
              type="submit"
              disabled={updatePending}
              className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
            >
              {updatePending ? "…" : "Guardar"}
            </button>
          </form>
        )}

        <form action={deleteAction}>
          <input type="hidden" name="bedId" value={bed.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="spaceId" value={spaceId} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-md p-1.5 text-[var(--color-neutral-400)] transition-colors hover:bg-red-50 hover:text-red-600"
            title="Eliminar cama"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
