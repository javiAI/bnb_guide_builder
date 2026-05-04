"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { updateSystemAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import type { SystemSubtype, SystemSubtypeField } from "@/lib/types/taxonomy";
import { stripNulls } from "@/lib/utils";
import {
  renderFieldInput,
  fieldTypeWrapsOwnLabel,
} from "@/config/registries/field-type-renderers";

interface Props {
  systemId: string;
  propertyId: string;
  subtype: SystemSubtype | null;
  detailsJson: Record<string, unknown>;
  opsJson: Record<string, unknown>;
  internalNotes: string | null;
  visibility: string;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SystemSubtypeField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const primitive = renderFieldInput({ field, value, onChange });

  // `boolean` (and any future wrapsOwnLabel type) emits its own <label>
  // inline — don't wrap again. For sensitive booleans we append the tag
  // as a sibling inside a shared flex row.
  if (fieldTypeWrapsOwnLabel(field.type)) {
    if (field.visibility === "sensitive") {
      return (
        <div className="flex items-center gap-2">
          {primitive}
          <span className="text-xs text-[var(--color-neutral-400)]">(sensible)</span>
        </div>
      );
    }
    return primitive;
  }

  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--foreground)]">
        {field.label}
        {field.required && <span className="ml-0.5 text-[var(--color-status-error-solid)]">*</span>}
        {field.visibility === "sensitive" && (
          <span className="ml-1 text-xs font-normal text-[var(--color-neutral-400)]">(sensible)</span>
        )}
      </span>
      {primitive}
    </label>
  );
}

export function SystemDetailForm({
  systemId,
  propertyId,
  subtype,
  detailsJson,
  opsJson,
  internalNotes,
  visibility,
}: Props) {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    updateSystemAction,
    null,
  );
  const [isPending, startTransition] = useTransition();

  const [details, setDetails] = useState<Record<string, unknown>>({ ...detailsJson });
  const [ops, setOps] = useState<Record<string, unknown>>({ ...opsJson });
  const [notes, setNotes] = useState(internalNotes ?? "");
  const [vis, setVis] = useState(visibility);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("systemId", systemId);
    fd.append("propertyId", propertyId);
    fd.append("detailsJson", JSON.stringify(stripNulls(details)));
    fd.append("opsJson", JSON.stringify(stripNulls(ops)));
    fd.append("internalNotes", notes);
    fd.append("visibility", vis);
    startTransition(() => action(fd));
  }

  const hasFields = subtype && (subtype.detailsFields.length > 0 || subtype.opsFields.length > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasFields && subtype.detailsFields.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Información para huéspedes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {subtype.detailsFields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                value={details[field.id]}
                onChange={(val) => setDetails((prev) => ({ ...prev, [field.id]: val }))}
              />
            ))}
          </div>
        </div>
      )}

      {hasFields && subtype.opsFields.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Operaciones e incidencias</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {subtype.opsFields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                value={ops[field.id]}
                onChange={(val) => setOps((prev) => ({ ...prev, [field.id]: val }))}
              />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Ajustes</h2>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">Notas internas</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas para el equipo, no visibles para huéspedes…"
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none resize-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--foreground)]">Visibilidad</span>
            <select
              value={vis}
              onChange={(e) => setVis(e.target.value)}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
            >
              <option value="guest">Huésped</option>
              <option value="internal">Solo interno</option>
            </select>
          </label>
        </div>
      </div>

      {result && !result.success && result.error && (
        <p className="text-xs text-[var(--color-status-error-icon)]">{result.error}</p>
      )}
      {result?.success && (
        <p className="text-xs text-[var(--color-status-success-icon)]">Guardado correctamente</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-50 transition-colors"
      >
        {isPending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
