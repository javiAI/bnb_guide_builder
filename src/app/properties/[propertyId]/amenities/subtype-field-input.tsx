"use client";

import type { SubtypeField } from "@/lib/types/taxonomy";
import { renderFieldInput } from "@/config/registries/field-type-renderers";

interface SubtypeFieldInputProps {
  field: SubtypeField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
}

export function SubtypeFieldInput({ field, value, onChange }: SubtypeFieldInputProps) {
  return renderFieldInput({
    field,
    value,
    onChange: (val) => onChange(field.id, val),
  });
}
