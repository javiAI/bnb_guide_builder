"use client";

import type { SubtypeField } from "@/lib/types/taxonomy";
import { renderFieldInput } from "@/config/registries/field-type-renderers";

interface SubtypeFieldInputProps {
  field: SubtypeField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
}

export function SubtypeFieldInput({ field, value, onChange }: SubtypeFieldInputProps) {
  // The amenity detail panel auto-saves each field on its own, so HTML
  // `required` (all-or-nothing submit gating, incompatible with incremental
  // save) is stripped — the panel never shows a required asterisk and the
  // action persists partial JSON.
  return renderFieldInput({
    field: { ...field, required: false },
    value,
    onChange: (val) => onChange(field.id, val),
  });
}
