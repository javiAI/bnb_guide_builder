"use client";

import { useActionState, useState, useTransition, useRef, type FormEvent, type ReactNode } from "react";
import { updateSystemAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import type { SystemSubtype, SystemSubtypeField } from "@/lib/types/taxonomy";
import { stripNulls } from "@/lib/utils";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";
import { useFormAutoSave } from "@/lib/use-form-auto-save";
import { Card } from "@/components/ui/card";
import { NumberedSection } from "@/components/ui/numbered-section";
import { Switch } from "@/components/ui/switch";
import { FieldTextarea } from "@/components/ui/field";
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
  /** Section numbers assigned by the page so the detail form's cards align with
   * the page's dynamic NumberedSection sequence (01 details · 02 ops · 03 settings). */
  detailsNumber?: string;
  opsNumber: string | null;
  settingsNumber: string;
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
  // Auto-save persists each field on its own → `gateRequired: false` drops the
  // HTML `required` (incompatible with incremental save); the asterisk below
  // stays as a soft hint and `updateSystemAction` persists partial JSON.
  const primitive = renderFieldInput({ field, value, onChange, gateRequired: false });

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

function FieldsCard({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <NumberedSection number={number} title={title} className="mb-0">
      <Card variant="overview">{children}</Card>
    </NumberedSection>
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
  detailsNumber,
  opsNumber,
  settingsNumber,
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
  // `handleSubmit` — so `watch` is the authoritative change signal;
  // `requestSubmit()` fires the submit below.
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

  const showDetails = Boolean(subtype && subtype.detailsFields.length > 0 && detailsNumber);
  const showOps = Boolean(subtype && subtype.opsFields.length > 0 && opsNumber);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <AutoSaveStatus pending={isPending} />

      {showDetails && subtype && detailsNumber && (
        <FieldsCard number={detailsNumber} title="Información para huéspedes">
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
        </FieldsCard>
      )}

      {showOps && subtype && opsNumber && (
        <FieldsCard number={opsNumber} title="Operaciones e incidencias">
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
        </FieldsCard>
      )}

      <FieldsCard number={settingsNumber} title="Ajustes">
        <div className="flex flex-col gap-4">
          <div className="flex min-h-[44px] items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                Visible en la guía del huésped
              </span>
              <span className="text-[12px] text-[var(--color-text-muted)]">
                Desactívalo para usar este sistema solo como referencia interna.
              </span>
            </div>
            <Switch
              checked={vis === "guest"}
              onChange={(next) => setVis(next ? "guest" : "internal")}
              ariaLabel="Visible en la guía del huésped"
            />
          </div>
          <FieldTextarea
            label="Notas internas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notas para el equipo, no visibles para huéspedes…"
            help="Solo visibles para el operador."
            className="resize-none"
          />
        </div>
      </FieldsCard>

      {result && !result.success && result.error && (
        <p className="text-[12px] text-[var(--color-status-error-text)]">{result.error}</p>
      )}
    </form>
  );
}
