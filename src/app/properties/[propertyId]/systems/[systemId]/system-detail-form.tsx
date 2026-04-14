"use client";

import { useActionState, useState, type FormEvent } from "react";
import { updateSystemAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/actions/editor.actions";
import type { SystemSubtype, SystemSubtypeField } from "@/lib/types/taxonomy";

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
  const strVal = value !== undefined && value !== null ? String(value) : "";
  const boolVal = typeof value === "boolean" ? value : false;

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={boolVal}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)] text-[var(--color-primary-500)]"
        />
        <span className="text-sm text-[var(--foreground)]">{field.label}</span>
        {field.visibility === "sensitive" && (
          <span className="text-xs text-[var(--color-neutral-400)]">(sensible)</span>
        )}
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {field.label}
          {field.required && <span className="ml-0.5 text-[var(--color-error-500)]">*</span>}
          {field.visibility === "sensitive" && (
            <span className="ml-1 text-xs font-normal text-[var(--color-neutral-400)]">(sensible)</span>
          )}
        </span>
        <textarea
          value={strVal}
          required={field.required}
          onChange={(e) => onChange(e.target.value || null)}
          rows={3}
          className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none resize-none"
        />
      </label>
    );
  }

  if (field.type === "number") {
    return (
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {field.label}
          {field.required && <span className="ml-0.5 text-[var(--color-error-500)]">*</span>}
        </span>
        <input
          type="number"
          value={strVal}
          required={field.required}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
        />
      </label>
    );
  }

  if ((field.type === "select" || field.type === "enum") && field.options) {
    return (
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {field.label}
          {field.required && <span className="ml-0.5 text-[var(--color-error-500)]">*</span>}
        </span>
        <select
          value={strVal}
          required={field.required}
          onChange={(e) => onChange(e.target.value || null)}
          className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "date") {
    return (
      <label className="block">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {field.label}
          {field.required && <span className="ml-0.5 text-[var(--color-error-500)]">*</span>}
        </span>
        <input
          type="date"
          value={strVal}
          required={field.required}
          onChange={(e) => onChange(e.target.value || null)}
          className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none"
        />
      </label>
    );
  }

  // text / password (fallback)
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--foreground)]">
        {field.label}
        {field.required && <span className="ml-0.5 text-[var(--color-error-500)]">*</span>}
        {field.visibility === "sensitive" && (
          <span className="ml-1 text-xs font-normal text-[var(--color-neutral-400)]">(sensible)</span>
        )}
      </span>
      <input
        type={field.type === "password" ? "password" : "text"}
        autoComplete={field.type === "password" ? "new-password" : undefined}
        value={strVal}
        required={field.required}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-400)] focus:outline-none"
      />
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
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    updateSystemAction,
    null,
  );

  const [details, setDetails] = useState<Record<string, unknown>>({ ...detailsJson });
  const [ops, setOps] = useState<Record<string, unknown>>({ ...opsJson });
  const [notes, setNotes] = useState(internalNotes ?? "");
  const [vis, setVis] = useState(visibility);

  function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== ""));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("systemId", systemId);
    fd.append("propertyId", propertyId);
    fd.append("detailsJson", JSON.stringify(stripNulls(details)));
    fd.append("opsJson", JSON.stringify(stripNulls(ops)));
    fd.append("internalNotes", notes);
    fd.append("visibility", vis);
    action(fd);
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
              <option value="public">Público</option>
              <option value="internal">Solo interno</option>
            </select>
          </label>
        </div>
      </div>

      {result && !result.success && result.error && (
        <p className="text-xs text-[var(--color-error-600)]">{result.error}</p>
      )}
      {result?.success && (
        <p className="text-xs text-[var(--color-success-600)]">Guardado correctamente</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-600)] disabled:opacity-50 transition-colors"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
