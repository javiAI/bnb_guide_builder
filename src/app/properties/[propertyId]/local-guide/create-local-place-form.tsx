"use client";

import { useActionState, useState } from "react";
import { createLocalPlaceAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { formatDistance, type PoiSuggestion } from "@/lib/services/places";
import { findLocalPlaceCategory } from "@/lib/taxonomies/local-place-categories";
import { PlaceAutocomplete } from "@/components/local-guide/place-autocomplete";

interface CreateLocalPlaceFormProps {
  propertyId: string;
  categories: ReadonlyArray<{ value: string; label: string }>;
}

export function CreateLocalPlaceForm({
  propertyId,
  categories,
}: CreateLocalPlaceFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createLocalPlaceAction,
    null,
  );
  const [manual, setManual] = useState(false);
  const [picked, setPicked] = useState<PoiSuggestion | null>(null);

  const fieldError = (field: string) => state?.fieldErrors?.[field]?.[0];

  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
    >
      <input type="hidden" name="propertyId" value={propertyId} />

      {state?.error && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      {!manual && !picked && (
        <>
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">
              Buscar lugar
            </span>
            <div className="mt-1">
              <PlaceAutocomplete
                propertyId={propertyId}
                onSelect={setPicked}
                onManualFallback={() => setManual(true)}
              />
            </div>
          </label>
          <p className="mt-2 text-xs text-[var(--color-neutral-500)]">
            ¿No lo encuentras?{" "}
            <button
              type="button"
              onClick={() => setManual(true)}
              className="underline"
            >
              Añadir manualmente
            </button>
          </p>
        </>
      )}

      {picked && (
        <PickedPreview picked={picked} onReset={() => setPicked(null)} />
      )}

      {(manual || picked) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">
              Categoría *
            </span>
            <select
              name="categoryKey"
              required
              defaultValue={picked?.categoryKey ?? ""}
              className={inputClass}
            >
              <option value="">— Seleccionar —</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {fieldError("categoryKey") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">
                {fieldError("categoryKey")}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">
              Nombre *
            </span>
            <input
              name="name"
              type="text"
              required
              defaultValue={picked?.name ?? ""}
              placeholder="Ej: Bar El Rincón"
              className={inputClass}
            />
            {fieldError("name") && (
              <p className="mt-1 text-xs text-[var(--color-danger-500)]">
                {fieldError("name")}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">
              Nota rápida
            </span>
            <input
              name="shortNote"
              type="text"
              placeholder="Ej: Mejor paella de la zona"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs text-[var(--color-neutral-500)]">
              Distancia (metros)
            </span>
            <input
              name="distanceMeters"
              type="number"
              min="0"
              defaultValue={picked?.distanceMeters ?? ""}
              placeholder="200"
              className={inputClass}
            />
          </label>

          {picked && (
            <>
              <input
                type="hidden"
                name="latitude"
                value={String(picked.latitude)}
              />
              <input
                type="hidden"
                name="longitude"
                value={String(picked.longitude)}
              />
              <input
                type="hidden"
                name="provider"
                value={picked.provider}
              />
              <input
                type="hidden"
                name="providerPlaceId"
                value={picked.providerPlaceId}
              />
              {picked.address && (
                <input
                  type="hidden"
                  name="address"
                  value={picked.address}
                />
              )}
              {picked.website && (
                <input
                  type="hidden"
                  name="website"
                  value={picked.website}
                />
              )}
              <input
                type="hidden"
                name="providerMetadata"
                value={JSON.stringify(picked.providerMetadata)}
              />
            </>
          )}
        </div>
      )}

      {(manual || picked) && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
          >
            {pending ? "Añadiendo…" : "Añadir lugar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setManual(false);
              setPicked(null);
            }}
            className="text-xs text-[var(--color-neutral-500)] underline"
          >
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}

function PickedPreview({
  picked,
  onReset,
}: {
  picked: PoiSuggestion;
  onReset: () => void;
}) {
  const categoryLabel =
    findLocalPlaceCategory(picked.categoryKey)?.label ?? picked.categoryKey;
  return (
    <div className="mb-2 flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[var(--foreground)]">
          {picked.name}
        </div>
        <div className="text-xs text-[var(--color-neutral-500)]">
          {categoryLabel}
          {picked.address ? ` · ${picked.address}` : ""}
          {typeof picked.distanceMeters === "number"
            ? ` · ${formatDistance(picked.distanceMeters)}`
            : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="shrink-0 text-xs text-[var(--color-neutral-500)] underline"
      >
        Cambiar
      </button>
    </div>
  );
}
