"use client";

import { useActionState } from "react";
import { savePoliciesAction, type ActionResult } from "@/lib/actions/editor.actions";
import { InlineSaveStatus } from "@/components/ui/inline-save-status";
import { policyTaxonomy, getPolicyGroups } from "@/lib/taxonomy-loader";
import type { TaxonomyItem } from "@/lib/types/taxonomy";

const groups = getPolicyGroups(policyTaxonomy);

interface PoliciesFormProps {
  propertyId: string;
  savedPolicies: Record<string, string>;
  propertyDefaults: {
    maxGuests: number | null;
    checkInStart: string | null;
    checkInEnd: string | null;
    checkOutTime: string | null;
  };
}

function getDefaultValue(
  item: TaxonomyItem,
  saved: Record<string, string>,
  propertyDefaults: PoliciesFormProps["propertyDefaults"],
): string {
  // Check saved first
  if (saved[item.id] !== undefined) return saved[item.id];

  // Check default_from_field
  if (item.default_from_field) {
    const fieldMap: Record<string, string | null | undefined> = {
      "basics.max_guests": propertyDefaults.maxGuests?.toString(),
    };
    const val = fieldMap[item.default_from_field];
    if (val) return val;
  }

  return "";
}

function PolicyField({
  item,
  defaultValue,
}: {
  item: TaxonomyItem;
  defaultValue: string;
}) {
  const fieldType = item.type ?? "text";
  const inputClass =
    "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  if (fieldType === "enum") {
    return (
      <select name={item.id} defaultValue={defaultValue} className={inputClass}>
        <option value="">— Seleccionar —</option>
        <option value="not_allowed">No permitido</option>
        <option value="allowed">Permitido</option>
        <option value="designated_areas">Áreas designadas</option>
      </select>
    );
  }

  if (fieldType === "number") {
    return (
      <input
        name={item.id}
        type="number"
        min={0}
        defaultValue={defaultValue}
        className={inputClass}
      />
    );
  }

  if (fieldType === "time_range_optional") {
    return (
      <input
        name={item.id}
        type="text"
        placeholder="22:00 — 08:00"
        defaultValue={defaultValue}
        className={inputClass}
      />
    );
  }

  if (fieldType === "money_optional") {
    return (
      <input
        name={item.id}
        type="text"
        placeholder="0.00 EUR"
        defaultValue={defaultValue}
        className={inputClass}
      />
    );
  }

  if (fieldType === "object_optional" || fieldType === "multi_select_optional") {
    return (
      <textarea
        name={item.id}
        rows={2}
        placeholder={item.description}
        defaultValue={defaultValue}
        className={inputClass}
      />
    );
  }

  if (fieldType === "ref") {
    return (
      <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
        Valor heredado de otra sección.
      </p>
    );
  }

  return (
    <input
      name={item.id}
      type="text"
      defaultValue={defaultValue}
      className={inputClass}
    />
  );
}

export function PoliciesForm({
  propertyId,
  savedPolicies,
  propertyDefaults,
}: PoliciesFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    savePoliciesAction,
    null,
  );

  const saveStatus = pending
    ? "saving"
    : state?.success
      ? "saved"
      : state?.error
        ? "error"
        : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="propertyId" value={propertyId} />

      <div className="flex items-center justify-between">
        <span />
        {saveStatus && <InlineSaveStatus status={saveStatus} />}
      </div>

      {state?.error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">
          {state.error}
        </p>
      )}

      {groups.map((group) => (
        <div
          key={group.id}
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
        >
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {group.label}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
            {group.description}
          </p>

          <div className="mt-4 space-y-4">
            {group.items.map((item) => {
              const defaultValue = getDefaultValue(
                item,
                savedPolicies,
                propertyDefaults,
              );
              return (
                <div key={item.id}>
                  <label className="block">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {item.label}
                      {item.required && (
                        <span className="ml-1 text-[var(--color-danger-500)]">*</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--color-neutral-500)]">
                      {item.description}
                    </span>
                    <PolicyField item={item} defaultValue={defaultValue} />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar normas"}
      </button>
    </form>
  );
}
