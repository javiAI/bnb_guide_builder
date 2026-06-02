"use client";

import type { SubtypeField } from "@/lib/types/taxonomy";
import { renderFieldInput } from "@/config/registries/field-type-renderers";

interface SubtypeFieldInputProps {
  field: SubtypeField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
}

export function SubtypeFieldInput({ field, value, onChange }: SubtypeFieldInputProps) {
  // The amenity detail panel auto-saves each field on its own → `gateRequired:
  // false` drops the HTML `required` (incompatible with incremental save); the
  // panel shows no asterisk and the action persists partial JSON.
  return renderFieldInput({
    field,
    value,
    onChange: (val) => onChange(field.id, val),
    gateRequired: false,
  });
}
