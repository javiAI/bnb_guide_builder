"use client";

import { useActionState, useState, useTransition, useRef, type FormEvent } from "react";
import { Settings2, Users, Wrench } from "lucide-react";
import { updateSystemAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import type { SystemSubtype, SystemSubtypeField } from "@/lib/types/taxonomy";
import { stripNulls } from "@/lib/utils";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { useFormAutoSave } from "@/lib/use-form-auto-save";
import { Card } from "@/components/ui/card";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
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
  // Auto-save persists each field on its own, so HTML `required` (all-or-nothing
  // submit gating, incompatible with incremental save) is stripped — the
  // asterisk below stays as a soft hint and `updateSystemAction` persists
  // partial JSON.
  const primitive = renderFieldInput({ field: { ...field, required: false }, value, onChange });

  // `boolean` (and any future wrapsOwnLabel type) emits its own <label>
  // inline — don't wrap again. For sensitive booleans we append the tag
  // as a sibling inside a shared flex row.
  if (fieldTypeWrapsOwnLabel(field.type)) {
    if (field.visibility === "sensitive") {
      return (
        <div className="flex items-center gap-2">
          {primitive}
          <span className="text-[12px] text-[var(--color-text-muted)]">(sensible)</span>
        </div>
      );
    }
    return primitive;
  }

  return (
    <label className="block">
      <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
        {field.label}
        {field.required && <span className="ml-0.5 text-[var(--color-status-error-text)]">*</span>}
        {field.visibility === "sensitive" && (
          <span className="ml-1 text-[12px] font-normal text-[var(--color-text-muted)]">(sensible)</span>
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

  // Auto-save: edits persist as you make them (no "Guardar" button). The form
  // has no `name`-bearing inputs — the payload is built from state in
  // `handleSubmit` — so `watch` is the change signal; `requestSubmit()` fires
  // the submit below.
  const formRef = useRef<HTMLFormElement>(null);
  useFormAutoSave(formRef, 700, () => JSON.stringify({ details, ops, notes, vis }));

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
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <AutoSaveStatus pending={isPending} />
      {hasFields && subtype.detailsFields.length > 0 && (
        <Card variant="overview">
          <SectionEyebrow icon={Users} className="mb-4">
            Información para huéspedes
          </SectionEyebrow>
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
        </Card>
      )}

      {hasFields && subtype.opsFields.length > 0 && (
        <Card variant="overview">
          <SectionEyebrow icon={Wrench} className="mb-4">
            Operaciones e incidencias
          </SectionEyebrow>
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
        </Card>
      )}

      <Card variant="overview">
        <SectionEyebrow icon={Settings2} className="mb-4">
          Ajustes
        </SectionEyebrow>
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
              Notas internas
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas para el equipo, no visibles para huéspedes…"
              className="mt-1 block w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
              Visibilidad
            </span>
            <select
              value={vis}
              onChange={(e) => setVis(e.target.value)}
              aria-label="Visibilidad del sistema"
              className="mt-1 block min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
            >
              <option value="guest">Huésped</option>
              <option value="internal">Solo interno</option>
            </select>
          </label>
        </div>
      </Card>

      {result && !result.success && result.error && (
        <p className="text-[12px] text-[var(--color-status-error-text)]">{result.error}</p>
      )}
    </form>
  );
}
