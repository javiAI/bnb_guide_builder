"use client";

import { useActionState, useState, useRef, useTransition } from "react";
import {
  addBedAction,
  updateBedAction,
  deleteBedAction,
  updateBedConfigAction,
} from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { autoSaveSubmit, useFormAutoSave, usePortalFormRef } from "@/lib/use-form-auto-save";
import { Tooltip } from "@/components/ui/tooltip";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { InlineStepper } from "@/components/ui/inline-stepper";
import { fieldControlClass } from "@/components/ui/field";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings2, Trash2, TriangleAlert, X } from "lucide-react";
import { bedTypes, bedPlaces } from "@/lib/taxonomies/bed-types";
import {
  mattressTypes as mattressTypeOptions,
  mattressFirmness as mattressFirmnessOptions,
  pillowTypes as pillowTypeOptions,
} from "@/lib/taxonomies/bedding-options";
import { getItems, findItem } from "@/lib/taxonomies/_helpers";

const bedTypeOptions = getItems(bedTypes);

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
  /** Allowed guests + total bed places across ALL spaces — drives the
   * non-blocking over-capacity hint under the bed list. */
  maxGuests?: number | null;
  propertyBedCapacity?: number;
}

export function BedManager({ propertyId, spaceId, beds, maxGuests, propertyBedCapacity = 0 }: BedManagerProps) {
  const [addState, addAction] = useActionState<ActionResult | null, FormData>(
    addBedAction,
    null,
  );
  const [, startTransition] = useTransition();

  // Direct add — selecting a type from the dropdown adds that bed (qty 1) at
  // once. Custom beds get a placeholder name the operator renames in the modal.
  // The useActionState dispatch must run inside a transition (imperative call).
  function quickAddBed(typeId: string) {
    const fd = new FormData();
    fd.append("spaceId", spaceId);
    fd.append("propertyId", propertyId);
    fd.append("bedType", typeId);
    fd.append("quantity", "1");
    if (typeId === "bt.other") fd.append("customLabel", "Cama personalizada");
    startTransition(() => { addAction(fd); });
  }

  const totalCapacity = bedPlaces(beds);

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

      {/* Add bed — a discreet inline dropdown right after the beds: pick a type
          and it's added at once (no panel, no extra section). */}
      <div>
        <select
          aria-label="Añadir cama"
          value=""
          onChange={(e) => { if (e.target.value) quickAddBed(e.target.value); e.target.value = ""; }}
          className="inline-flex h-7 items-center rounded-full border border-dashed border-[var(--color-border-default)] bg-transparent px-3 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] focus:border-[var(--color-border-focus)] focus:outline-none"
        >
          <option value="">+ Añadir cama…</option>
          {bedTypeOptions.map((bt) => (
            <option key={bt.id} value={bt.id}>{bt.label}</option>
          ))}
        </select>
        {addState?.error && (
          <p className="mt-1 text-xs text-[var(--color-status-error-text)]">{addState.error}</p>
        )}
      </div>

      {totalCapacity > 0 && (
        <p className="text-xs font-medium text-[var(--color-text-secondary)]">
          Plazas en esta estancia: {totalCapacity} {totalCapacity === 1 ? "persona" : "personas"}
        </p>
      )}

      {/* Property-wide over-capacity hint, shown right where beds are edited.
         Non-blocking — sum of all spaces' bed places exceeds the allowed guests. */}
      {maxGuests != null && propertyBedCapacity > maxGuests && (
        <div className="flex items-start gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-2.5 py-2">
          <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--color-status-warning-icon)]" />
          <p className="text-xs text-[var(--color-status-warning-text)]">
            Entre todas las estancias hay camas para {propertyBedCapacity} personas, más que el máximo de {maxGuests}. No bloquea nada; revísalo si no es intencionado.
          </p>
        </div>
      )}
    </div>
  );
}

// Modal checkbox lists (crib options, linen) share one scaffold.
function CheckboxList({
  items,
  value,
  onToggle,
}: {
  items: ReadonlyArray<{ key: string; label: string }>;
  value: (key: string) => boolean;
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      {items.map(({ key, label }) => (
        <label key={key} className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-action-primary)]"
            checked={value(key)}
            onChange={(e) => onToggle(key, e.target.checked)}
          />
          <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
        </label>
      ))}
    </div>
  );
}

const CRIB_ITEMS = [
  { key: "cribMattress", label: "Colchón incluido" },
  { key: "cribMattressExtra", label: "Colchón extra disponible" },
  { key: "cribLinen", label: "Ropa de cuna incluida" },
  { key: "cribMobile", label: "Movible (con ruedas)" },
  { key: "cribFoldable", label: "Plegable / de viaje" },
] as const;

const LINEN_ITEMS = [
  { key: "linenIncluded", label: "Ropa de cama incluida" },
  { key: "extraBlanket", label: "Manta extra disponible" },
  { key: "mattressProtector", label: "Protector de colchón" },
] as const;

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
  // The config form lives in a Radix Portal → portal-aware ref (see hook docs).
  const qtyFormRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(qtyFormRef);
  const configFormRef = useRef<HTMLFormElement | null>(null);
  const flushConfig = useFormAutoSave(configFormRef);
  const attachConfigForm = usePortalFormRef(configFormRef);

  const typeInfo = findItem(bedTypes, bed.bedType);
  const isCustom = bed.bedType === "bt.other";
  // A crib is not a regular bed — its config is about safety/portability, not
  // mattress firmness or pillows. It gets its own field set.
  const isCrib = bed.bedType === "bt.crib";

  // One state record for the whole config modal — every control reads/patches
  // this; the serializer below builds the persisted shape per bed kind. Every
  // key it emits must be declared in bedConfigSchema (Zod strips unknowns).
  const [cfg, setCfg] = useState<Record<string, unknown>>(bed.configJson ?? {});
  const patch = (key: string, value: unknown) => setCfg((prev) => ({ ...prev, [key]: value }));
  const bool = (key: string) => Boolean(cfg[key]);
  const str = (key: string) => (cfg[key] as string) ?? "";

  const mattressType = str("mattressType");
  const pillowTypes = (cfg.pillowTypes as string[]) ?? [];
  const customLabel = str("customLabel");
  const customCapacity = (cfg.customCapacity as number) ?? 1;
  const cap = isCustom ? customCapacity : (typeInfo?.sleepingCapacity ?? 1);

  const configSerialized = JSON.stringify(
    isCrib
      ? Object.fromEntries(CRIB_ITEMS.map(({ key }) => [key, bool(key)]))
      : {
          mattressType,
          mattressFirmness: str("mattressFirmness"),
          pillowTypes,
          linenIncluded: bool("linenIncluded"),
          extraBlanket: bool("extraBlanket"),
          mattressProtector: bool("mattressProtector"),
          ...(mattressType === "other" ? { mattressTypeCustom: str("mattressTypeCustom") } : {}),
          ...(isCustom ? { customLabel, customCapacity } : {}),
        },
  );

  function togglePillow(id: string) {
    patch("pillowTypes", pillowTypes.includes(id) ? pillowTypes.filter((v) => v !== id) : [...pillowTypes, id]);
  }

  return (
    <div className="py-2">
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Bed label */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-[var(--color-text-primary)]">
            {isCustom ? (customLabel || "Cama personalizada") : (typeInfo?.label ?? bed.bedType)}
          </span>
          {cap > 0 && (
            <span className="ml-1.5 text-xs text-[var(--color-text-muted)]">
              · {cap * quantity} pers.
            </span>
          )}
        </div>

        {/* Config — opens a focused modal. Cribs get a crib-specific field set
            (safety / portability), not mattress / pillows / linen. */}
        <Tooltip text={isCrib ? "Configurar la cuna" : "Configurar colchón, almohada y ropa de cama"}>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={isCrib ? "Configurar la cuna" : "Configurar colchón, almohada y ropa de cama"}
            className="recipe-icon-btn-32 grid h-8 w-8 flex-none place-items-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:bg-[var(--color-interactive-hover)]"
          >
            <Settings2 size={14} aria-hidden="true" />
          </button>
        </Tooltip>

        {/* Inline quantity stepper */}
        <InlineStepper
          value={quantity}
          min={1}
          max={10}
          onChange={setQuantity}
          label={`cantidad de ${typeInfo?.label ?? bed.bedType}`}
        />

        {/* Quantity auto-saves on change via this hidden mirror form
            (display:contents so it adds no layout box). */}
        <form ref={qtyFormRef} onSubmit={autoSaveSubmit(updateAction)} className="contents">
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

      {/* Config modal — focused popup for this bed (no inline gray panel). */}
      <Dialog.Root open={expanded} onOpenChange={(o) => { if (!o) flushConfig(); setExpanded(o); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-background-overlay)]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5 shadow-[var(--elevation-surface-lg)] focus:outline-none"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <Dialog.Title className="text-base font-semibold text-[var(--color-text-primary)]">
                {isCustom ? (customLabel || "Cama personalizada") : (typeInfo?.label ?? bed.bedType)}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Cerrar"
                  className="recipe-icon-btn-32 grid h-8 w-8 flex-none place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <form ref={attachConfigForm} onSubmit={autoSaveSubmit(configAction)} className="space-y-4">
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
                    value={customLabel}
                    onChange={(e) => patch("customLabel", e.target.value)}
                    placeholder="Ej. Futón, Hammock, Tatami…"
                    className={fieldControlClass}
                  />
                </label>
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] mb-1 block">Capacidad (personas)</span>
                  <InlineStepper
                    value={customCapacity}
                    min={1}
                    max={20}
                    onChange={(n) => patch("customCapacity", n)}
                    label="capacidad"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Crib — safety / portability config (not mattress firmness/pillows). */}
          {isCrib && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Cuna</p>
              <CheckboxList items={CRIB_ITEMS} value={bool} onToggle={patch} />
            </div>
          )}

          {/* Mattress type */}
          {!isCrib && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Colchón</p>
            <div className="flex flex-wrap gap-2">
              {mattressTypeOptions.map((opt) => (
                <ToggleChip
                  key={opt.id}
                  active={mattressType === opt.id}
                  hideCheck
                  onToggle={() => patch("mattressType", mattressType === opt.id ? "" : opt.id)}
                >
                  {opt.label}
                </ToggleChip>
              ))}
            </div>
            {mattressType === "other" && (
              <input
                type="text"
                value={str("mattressTypeCustom")}
                onChange={(e) => patch("mattressTypeCustom", e.target.value)}
                placeholder="Ej. Enrollable, Futón…"
                aria-label="Tipo de colchón personalizado"
                className={`mt-2 ${fieldControlClass}`}
              />
            )}
            {mattressType && (
              <div className="mt-2 flex flex-wrap gap-2">
                {mattressFirmnessOptions.map((opt) => (
                  <ToggleChip
                    key={opt.id}
                    active={str("mattressFirmness") === opt.id}
                    hideCheck
                    onToggle={() => patch("mattressFirmness", str("mattressFirmness") === opt.id ? "" : opt.id)}
                  >
                    {opt.label}
                  </ToggleChip>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Pillows */}
          {!isCrib && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Almohadas</p>
            <div className="flex flex-wrap gap-2">
              {pillowTypeOptions.map((opt) => (
                <ToggleChip
                  key={opt.id}
                  active={pillowTypes.includes(opt.id)}
                  onToggle={() => togglePillow(opt.id)}
                >
                  {opt.label}
                </ToggleChip>
              ))}
            </div>
          </div>
          )}

          {/* Linen */}
          {!isCrib && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Ropa de cama</p>
            <CheckboxList items={LINEN_ITEMS} value={bool} onToggle={patch} />
          </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <AutoSaveStatus pending={configPending} />
            {configState?.error && (
              <span className="text-xs text-[var(--color-status-error-text)]">{configState.error}</span>
            )}
          </div>
            </form>
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 text-sm font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)]"
                >
                  Listo
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
