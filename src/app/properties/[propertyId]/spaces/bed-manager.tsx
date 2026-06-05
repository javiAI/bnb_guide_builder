"use client";

import { useActionState, useMemo, useState, useRef } from "react";
import {
  addBedAction,
  updateBedAction,
  deleteBedAction,
  updateBedConfigAction,
} from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { useFormAutoSave } from "@/lib/use-form-auto-save";
import { Tooltip } from "@/components/ui/tooltip";
import { Minus, Plus, Settings2, Trash2, TriangleAlert } from "lucide-react";
import { bedTypes } from "@/lib/taxonomies/bed-types";
import {
  mattressTypes as mattressTypeOptions,
  mattressFirmness as mattressFirmnessOptions,
  pillowTypes as pillowTypeOptions,
} from "@/lib/taxonomies/bedding-options";
import { getItems, findItem } from "@/lib/taxonomies/_helpers";

const bedTypeOptions = getItems(bedTypes);

const STEPPER_BTN_CLS = "flex recipe-icon-btn-32 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)] disabled:opacity-40";
const STEPPER_BTN_SM_CLS = "flex recipe-icon-btn-32 items-center justify-center rounded-full border border-[var(--color-border-default)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)] disabled:opacity-40";

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
        <div className="divide-y divide-[var(--color-border-default)]">
          {beds.map((bed) => (
            <BedRow key={bed.id} bed={bed} propertyId={propertyId} spaceId={spaceId} />
          ))}
        </div>
      )}

      {totalCapacity > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--color-text-secondary)] font-medium">
            Capacidad total: {totalCapacity} {totalCapacity === 1 ? "persona" : "personas"}
          </p>
          {maxGuests != null && totalCapacity > maxGuests && (
            <div className="flex items-start gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-2.5 py-2">
              <TriangleAlert size={14} aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--color-status-warning-icon)]" />
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
          <p className="mb-2 text-xs text-[var(--color-status-error-text)]">{addState.error}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <select
            name="bedType"
            required
            aria-label="Tipo de cama"
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setCustomBedLabel(""); }}
            className="flex-1 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none"
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
              className="flex-1 min-w-[140px] rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none placeholder:text-[var(--color-text-muted)]"
            />
          )}

          {/* Compact quantity stepper */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={addQty <= 1}
              onClick={() => setAddQty((q) => Math.max(1, q - 1))}
              className={STEPPER_BTN_CLS}
              aria-label="Reducir cantidad"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="w-5 text-center text-sm font-medium text-[var(--color-text-primary)]">
              {addQty}
            </span>
            <button
              type="button"
              disabled={addQty >= 10}
              onClick={() => setAddQty((q) => Math.min(10, q + 1))}
              className={STEPPER_BTN_CLS}
              aria-label="Aumentar cantidad"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>

          <button
            type="submit"
            disabled={addPending || !selectedType || (selectedType === "bt.other" && !customBedLabel.trim())}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 py-1.5 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] disabled:opacity-50"
          >
            {addPending ? "…" : "Añadir"}
          </button>
        </div>

        {addState?.fieldErrors?.bedType && (
          <p className="mt-1 text-xs text-[var(--color-status-error-text)]">
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
  const [, updateAction] = useActionState<ActionResult | null, FormData>(
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

  // Auto-save: quantity changes persist via a hidden mirror form; the config
  // panel persists as you edit (configJson is mirrored into a hidden input, so
  // the FormData diff catches every control). `flushConfig()` runs on collapse.
  const qtyFormRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(qtyFormRef);
  const configFormRef = useRef<HTMLFormElement>(null);
  const flushConfig = useFormAutoSave(configFormRef);

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

  const configSerialized = useMemo(
    () =>
      JSON.stringify({
        mattressType,
        mattressFirmness,
        pillowTypes,
        linenIncluded,
        extraBlanket,
        mattressProtector,
        ...(isCustom ? { customLabel: customLabelEdit, customCapacity } : {}),
      }),
    [
      mattressType,
      mattressFirmness,
      pillowTypes,
      linenIncluded,
      extraBlanket,
      mattressProtector,
      isCustom,
      customLabelEdit,
      customCapacity,
    ],
  );

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
          <span className="text-sm text-[var(--color-text-primary)]">
            {isCustom
              ? ((cfg.customLabel as string) || "Cama personalizada")
              : (typeInfo?.label ?? bed.bedType)}
          </span>
          {cap > 0 && (
            <span className="ml-1.5 text-xs text-[var(--color-text-muted)]">
              · {cap * quantity} {cap * quantity === 1 ? "pers." : "pers."}
            </span>
          )}
        </div>

        {/* Config toggle */}
        <Tooltip text="Configurar colchón, almohada y ropa de cama">
          <button
            type="button"
            onClick={() => { if (expanded) flushConfig(); setExpanded((v) => !v); }}
            className={`inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-md)] border px-2 py-1 text-xs font-medium transition-colors ${
              hasConfig
                ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary-subtle-fg)] hover:bg-[var(--color-interactive-hover)]"
                : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:bg-[var(--color-interactive-hover)]"
            }`}
          >
            <Settings2 size={14} aria-hidden="true" className="h-3.5 w-3.5" />
            {expanded ? "Cerrar" : "Configurar"}
          </button>
        </Tooltip>

        {/* Inline quantity stepper */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className={STEPPER_BTN_SM_CLS}
            aria-label={`Reducir cantidad de ${typeInfo?.label ?? bed.bedType}`}
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <span className="w-5 text-center text-sm font-medium text-[var(--color-text-primary)]">
            {quantity}
          </span>
          <button
            type="button"
            disabled={quantity >= 10}
            onClick={() => setQuantity((q) => Math.min(10, q + 1))}
            className={STEPPER_BTN_SM_CLS}
            aria-label={`Aumentar cantidad de ${typeInfo?.label ?? bed.bedType}`}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Quantity auto-saves on change via this hidden mirror form
            (display:contents so it adds no layout box). */}
        <form ref={qtyFormRef} action={updateAction} className="contents">
          <input type="hidden" name="bedId" value={bed.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="spaceId" value={spaceId} />
          <input type="hidden" name="bedType" value={bed.bedType} />
          <input type="hidden" name="quantity" value={quantity} />
        </form>

        {/* Delete */}
        <form action={deleteAction}>
          <input type="hidden" name="bedId" value={bed.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="spaceId" value={spaceId} />
          <Tooltip text="Eliminar cama">
            <button
              type="submit"
              disabled={deletePending}
              aria-label="Eliminar cama"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-status-error-bg)] hover:text-[var(--color-status-error-text)] disabled:opacity-40"
            >
              <Trash2 size={14} aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </form>
      </div>

      {/* Expandable config panel */}
      {expanded && (
        <form ref={configFormRef} action={configAction} className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] px-4 py-3 space-y-4">
          <input type="hidden" name="bedId" value={bed.id} />
          <input type="hidden" name="spaceId" value={spaceId} />
          <input type="hidden" name="configJson" value={configSerialized} />

          {/* Custom bed: name + capacity */}
          {isCustom && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Identificación</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] mb-1 block">Nombre</span>
                  <input
                    type="text"
                    value={customLabelEdit}
                    onChange={(e) => setCustomLabelEdit(e.target.value)}
                    placeholder="Ej. Futón, Hammock, Tatami…"
                    className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] px-2 py-1.5 text-sm focus:border-[var(--color-border-focus)] focus:outline-none placeholder:text-[var(--color-text-muted)]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] mb-1 block">Capacidad (personas)</span>
                  <div className="flex items-center gap-1 mt-1">
                    <button type="button" onClick={() => setCustomCapacity(Math.max(1, customCapacity - 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border-default)] text-sm hover:bg-[var(--color-interactive-hover)] disabled:opacity-40" disabled={customCapacity <= 1} aria-label="Reducir capacidad"><Minus size={14} aria-hidden="true" /></button>
                    <span className="w-6 text-center text-sm font-medium">{customCapacity}</span>
                    <button type="button" onClick={() => setCustomCapacity(Math.min(20, customCapacity + 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border-default)] text-sm hover:bg-[var(--color-interactive-hover)]" aria-label="Aumentar capacidad"><Plus size={14} aria-hidden="true" /></button>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Mattress type */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Colchón</p>
            <div className="flex flex-wrap gap-2">
              {mattressTypeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMattressType(mattressType === opt.id ? "" : opt.id)}
                  className={`inline-flex min-h-[44px] items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${mattressType === opt.id ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary-subtle-fg)]" : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)]"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {mattressType && (
              <div className="mt-2 flex flex-wrap gap-2">
                {mattressFirmnessOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMattressFirmness(mattressFirmness === opt.id ? "" : opt.id)}
                    className={`inline-flex min-h-[44px] items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${mattressFirmness === opt.id ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary-subtle-fg)]" : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)]"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pillows */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Almohadas</p>
            <div className="flex flex-wrap gap-2">
              {pillowTypeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => togglePillow(opt.id)}
                  className={`inline-flex min-h-[44px] items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${pillowTypes.includes(opt.id) ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] text-[var(--color-action-primary-subtle-fg)]" : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-interactive-hover)]"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Linen */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Ropa de cama</p>
            <div className="space-y-1.5">
              {[
                { key: "linenIncluded", label: "Ropa de cama incluida", val: linenIncluded, set: setLinenIncluded },
                { key: "extraBlanket", label: "Manta extra disponible", val: extraBlanket, set: setExtraBlanket },
                { key: "mattressProtector", label: "Protector de colchón", val: mattressProtector, set: setMattressProtector },
              ].map(({ key, label, val, set }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-action-primary)]" checked={val} onChange={(e) => set(e.target.checked)} />
                  <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <AutoSaveStatus pending={configPending} />
            {configState?.error && (
              <span className="text-xs text-[var(--color-status-error-text)]">{configState.error}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
