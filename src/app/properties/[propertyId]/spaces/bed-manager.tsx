"use client";

import { useActionState, useState } from "react";
import {
  addBedAction,
  updateBedAction,
  deleteBedAction,
  updateBedConfigAction,
} from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { bedTypes, getItems, findItem } from "@/lib/taxonomy-loader";

const bedTypeOptions = getItems(bedTypes);

const MATTRESS_TYPES = [
  { id: "spring", label: "Muelles" },
  { id: "memory_foam", label: "Viscoelástica" },
  { id: "latex", label: "Látex" },
  { id: "foam", label: "Espuma" },
  { id: "hybrid", label: "Híbrido" },
];
const MATTRESS_FIRMNESS = [
  { id: "soft", label: "Blando" },
  { id: "medium", label: "Intermedio" },
  { id: "firm", label: "Firme" },
];
const PILLOW_TYPES = [
  { id: "down", label: "Plumón" },
  { id: "synthetic", label: "Sintética" },
  { id: "memory_foam", label: "Viscoelástica" },
  { id: "bamboo", label: "Bambú" },
  { id: "firm", label: "Firme" },
  { id: "adjustable", label: "Ajustable" },
];

export interface BedData {
  id: string;
  bedType: string;
  quantity: number;
  configJson: Record<string, unknown> | null;
}

interface BedManagerProps {
  propertyId: string;
  spaceId: string;
  beds: BedData[];
  maxGuests?: number | null;
}

export function BedManager({ propertyId, spaceId, beds, maxGuests }: BedManagerProps) {
  const [addState, addAction, addPending] = useActionState<ActionResult | null, FormData>(
    addBedAction,
    null,
  );

  const [selectedType, setSelectedType] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [customBedLabel, setCustomBedLabel] = useState("");

  const totalCapacity = beds.reduce((sum, bed) => {
    if (bed.bedType === "bt.other") {
      const customCap = (bed.configJson?.customCapacity as number | undefined) ?? 1;
      return sum + customCap * bed.quantity;
    }
    const typeInfo = findItem(bedTypes, bed.bedType);
    return sum + (typeInfo?.sleepingCapacity ?? 1) * bed.quantity;
  }, 0);

  return (
    <div className="space-y-3">
      {/* Existing beds */}
      {beds.length > 0 && (
        <div className="divide-y divide-[var(--border)]">
          {beds.map((bed) => (
            <BedRow key={bed.id} bed={bed} propertyId={propertyId} spaceId={spaceId} />
          ))}
        </div>
      )}

      {totalCapacity > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--color-neutral-500)] font-medium">
            Capacidad total: {totalCapacity} {totalCapacity === 1 ? "persona" : "personas"}
          </p>
          {maxGuests != null && totalCapacity > maxGuests && (
            <div className="flex items-start gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-2.5 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--color-status-warning-icon)]" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-[var(--color-status-warning-text)]">
                Este espacio tiene camas para {totalCapacity} personas, más que el máximo actual de la propiedad ({maxGuests}). Esto no es un error — puedes tener más plazas de las habituales — pero conviene revisarlo si no es intencionado.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add bed form */}
      <form action={addAction} className="pt-1">
        <input type="hidden" name="spaceId" value={spaceId} />
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="quantity" value={addQty} />
        {selectedType === "bt.other" && (
          <input type="hidden" name="customLabel" value={customBedLabel} />
        )}

        {addState?.error && (
          <p className="mb-2 text-xs text-[var(--color-danger-500)]">{addState.error}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <select
            name="bedType"
            required
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setCustomBedLabel(""); }}
            className="flex-1 min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
          >
            <option value="">— Tipo de cama —</option>
            {bedTypeOptions.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {bt.label}{bt.recommended ? " ★" : ""}
              </option>
            ))}
          </select>
          {selectedType === "bt.other" && (
            <input
              type="text"
              value={customBedLabel}
              onChange={(e) => setCustomBedLabel(e.target.value)}
              placeholder="Nombre (ej. Hammock, Tatami…)"
              className="flex-1 min-w-[140px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none placeholder:text-[var(--color-neutral-400)]"
            />
          )}

          {/* Compact quantity stepper */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={addQty <= 1}
              onClick={() => setAddQty((q) => Math.max(1, q - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-sm text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] disabled:opacity-40"
              aria-label="Reducir cantidad"
            >
              &minus;
            </button>
            <span className="w-5 text-center text-sm font-medium text-[var(--foreground)]">
              {addQty}
            </span>
            <button
              type="button"
              disabled={addQty >= 10}
              onClick={() => setAddQty((q) => Math.min(10, q + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-sm text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] disabled:opacity-40"
              aria-label="Aumentar cantidad"
            >
              +
            </button>
          </div>

          <button
            type="submit"
            disabled={addPending || !selectedType || (selectedType === "bt.other" && !customBedLabel.trim())}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
          >
            {addPending ? "…" : "Añadir"}
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
  const [expanded, setExpanded] = useState(false);
  const [, updateAction, updatePending] = useActionState<ActionResult | null, FormData>(
    updateBedAction,
    null,
  );
  const [, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteBedAction,
    null,
  );
  const [configState, configAction, configPending] = useActionState<ActionResult | null, FormData>(
    updateBedConfigAction,
    null,
  );

  const cfg = bed.configJson ?? {};
  const [mattressType, setMattressType] = useState<string>((cfg.mattressType as string) ?? "");
  const [mattressFirmness, setMattressFirmness] = useState<string>((cfg.mattressFirmness as string) ?? "");
  const [pillowTypes, setPillowTypes] = useState<string[]>((cfg.pillowTypes as string[]) ?? []);
  const [linenIncluded, setLinenIncluded] = useState<boolean>((cfg.linenIncluded as boolean) ?? false);
  const [extraBlanket, setExtraBlanket] = useState<boolean>((cfg.extraBlanket as boolean) ?? false);
  const [mattressProtector, setMattressProtector] = useState<boolean>((cfg.mattressProtector as boolean) ?? false);
  const [customCapacity, setCustomCapacity] = useState<number>((cfg.customCapacity as number) ?? 1);
  const [customLabelEdit, setCustomLabelEdit] = useState<string>((cfg.customLabel as string) ?? "");

  const typeInfo = findItem(bedTypes, bed.bedType);
  const isCustom = bed.bedType === "bt.other";
  const cap = isCustom ? customCapacity : (typeInfo?.sleepingCapacity ?? 1);
  const quantityDirty = quantity !== bed.quantity;

  const configDirty =
    mattressType !== ((cfg.mattressType as string) ?? "") ||
    mattressFirmness !== ((cfg.mattressFirmness as string) ?? "") ||
    JSON.stringify([...pillowTypes].sort()) !== JSON.stringify([...((cfg.pillowTypes as string[]) ?? [])].sort()) ||
    linenIncluded !== ((cfg.linenIncluded as boolean) ?? false) ||
    extraBlanket !== ((cfg.extraBlanket as boolean) ?? false) ||
    mattressProtector !== ((cfg.mattressProtector as boolean) ?? false) ||
    (isCustom && customLabelEdit !== ((cfg.customLabel as string) ?? "")) ||
    (isCustom && customCapacity !== ((cfg.customCapacity as number) ?? 1));

  function togglePillow(id: string) {
    setPillowTypes((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]);
  }

  // Has any config been set?
  const hasConfig = !!(cfg.mattressType || cfg.mattressFirmness || (cfg.pillowTypes as string[] | undefined)?.length || cfg.linenIncluded || cfg.extraBlanket || cfg.mattressProtector || cfg.customLabel);

  return (
    <div className="py-2">
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Bed label */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-[var(--foreground)]">
            {isCustom
              ? ((cfg.customLabel as string) || "Cama personalizada")
              : (typeInfo?.label ?? bed.bedType)}
          </span>
          {cap > 0 && (
            <span className="ml-1.5 text-xs text-[var(--color-neutral-400)]">
              · {cap * quantity} {cap * quantity === 1 ? "pers." : "pers."}
            </span>
          )}
        </div>

        {/* Config toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title="Configurar colchón, almohada y ropa de cama"
          className={`inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-md)] border px-2 py-1 text-xs font-medium transition-colors ${
            hasConfig
              ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]"
              : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--color-neutral-600)] hover:border-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-100)]"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v1.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 015.38 3.03l1.25.834a6.957 6.957 0 011.416-.587l.294-1.473zM13 10a3 3 0 11-6 0 3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          {expanded ? "Cerrar" : "Configurar"}
        </button>

        {/* Inline quantity stepper */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] text-xs text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] disabled:opacity-40"
            aria-label={`Reducir cantidad de ${typeInfo?.label ?? bed.bedType}`}
          >
            &minus;
          </button>
          <span className="w-5 text-center text-sm font-medium text-[var(--foreground)]">
            {quantity}
          </span>
          <button
            type="button"
            disabled={quantity >= 10}
            onClick={() => setQuantity((q) => Math.min(10, q + 1))}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] text-xs text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] disabled:opacity-40"
            aria-label={`Aumentar cantidad de ${typeInfo?.label ?? bed.bedType}`}
          >
            +
          </button>
        </div>

        {/* Save quantity (only when dirty) */}
        {quantityDirty && (
          <form action={updateAction}>
            <input type="hidden" name="bedId" value={bed.id} />
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="spaceId" value={spaceId} />
            <input type="hidden" name="bedType" value={bed.bedType} />
            <input type="hidden" name="quantity" value={quantity} />
            <button
              type="submit"
              disabled={updatePending}
              className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-50"
            >
              {updatePending ? "…" : "Guardar"}
            </button>
          </form>
        )}

        {/* Delete */}
        <form action={deleteAction}>
          <input type="hidden" name="bedId" value={bed.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="spaceId" value={spaceId} />
          <button
            type="submit"
            disabled={deletePending}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-md)] text-[var(--color-neutral-400)] transition-colors hover:bg-[var(--color-status-error-bg)] hover:text-[var(--color-status-error-icon)] disabled:opacity-40"
            title="Eliminar cama"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
          </button>
        </form>
      </div>

      {/* Expandable config panel */}
      {expanded && (
        <form action={configAction} className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--color-neutral-50)] px-4 py-3 space-y-4">
          <input type="hidden" name="bedId" value={bed.id} />
          <input type="hidden" name="spaceId" value={spaceId} />
          <input
            type="hidden"
            name="configJson"
            value={JSON.stringify({ mattressType, mattressFirmness, pillowTypes, linenIncluded, extraBlanket, mattressProtector, ...(isCustom ? { customLabel: customLabelEdit, customCapacity } : {}) })}
          />

          {/* Custom bed: name + capacity */}
          {isCustom && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">Identificación</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--foreground)] mb-1 block">Nombre</span>
                  <input
                    type="text"
                    value={customLabelEdit}
                    onChange={(e) => setCustomLabelEdit(e.target.value)}
                    placeholder="Ej. Futón, Hammock, Tatami…"
                    className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:border-[var(--color-primary-400)] focus:outline-none placeholder:text-[var(--color-neutral-400)]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--foreground)] mb-1 block">Capacidad (personas)</span>
                  <div className="flex items-center gap-1 mt-1">
                    <button type="button" onClick={() => setCustomCapacity(Math.max(1, customCapacity - 1))} className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-sm hover:bg-[var(--color-neutral-100)] disabled:opacity-40" disabled={customCapacity <= 1}>−</button>
                    <span className="w-6 text-center text-sm font-medium">{customCapacity}</span>
                    <button type="button" onClick={() => setCustomCapacity(Math.min(20, customCapacity + 1))} className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-sm hover:bg-[var(--color-neutral-100)]">+</button>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Mattress type */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">Colchón</p>
            <div className="flex flex-wrap gap-2">
              {MATTRESS_TYPES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMattressType(mattressType === opt.id ? "" : opt.id)}
                  className={`inline-flex min-h-[44px] items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${mattressType === opt.id ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : "border-[var(--border)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {mattressType && (
              <div className="mt-2 flex flex-wrap gap-2">
                {MATTRESS_FIRMNESS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMattressFirmness(mattressFirmness === opt.id ? "" : opt.id)}
                    className={`inline-flex min-h-[44px] items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${mattressFirmness === opt.id ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : "border-[var(--border)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pillows */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">Almohadas</p>
            <div className="flex flex-wrap gap-2">
              {PILLOW_TYPES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => togglePillow(opt.id)}
                  className={`inline-flex min-h-[44px] items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${pillowTypes.includes(opt.id) ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : "border-[var(--border)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Linen */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">Ropa de cama</p>
            <div className="space-y-1.5">
              {[
                { key: "linenIncluded", label: "Ropa de cama incluida", val: linenIncluded, set: setLinenIncluded },
                { key: "extraBlanket", label: "Manta extra disponible", val: extraBlanket, set: setExtraBlanket },
                { key: "mattressProtector", label: "Protector de colchón", val: mattressProtector, set: setMattressProtector },
              ].map(({ key, label, val, set }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary-500)]" checked={val} onChange={(e) => set(e.target.checked)} />
                  <span className="text-sm text-[var(--foreground)]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={configPending || !configDirty}
              className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
            >
              {configPending ? "Guardando…" : "Guardar configuración"}
            </button>
            {configState?.success && !configDirty && (
              <span className="text-xs text-[var(--color-success-600)]">Guardado</span>
            )}
            {configState?.error && (
              <span className="text-xs text-[var(--color-danger-600)]">{configState.error}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
