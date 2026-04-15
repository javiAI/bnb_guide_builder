"use client";

// Client-side renderers paired with field-type-registry.ts. Each renderer
// returns the interactive primitive only (bare input / select / textarea /
// checkbox-label). Form-level wrappers (outer <label>, required marker,
// sensitive tag) are the caller's job — except for `boolean`, whose
// checkbox renders its own inline label (marked by `wrapsOwnLabel` in the
// validator registry).

import type { ReactNode } from "react";
import { checkboxClass, inputClass, textareaClass } from "./field-styles";
import {
  FIELD_TYPES,
  getFieldType,
  type FieldTypeMeta,
  type SubtypeFieldType,
} from "./field-type-registry";

export interface FieldInputProps<TMeta extends FieldTypeMeta = FieldTypeMeta> {
  field: TMeta;
  value: unknown;
  onChange: (value: unknown) => void;
}

function strOf(value: unknown): string {
  return value !== undefined && value !== null ? String(value) : "";
}

type Renderer = (props: FieldInputProps) => ReactNode;

const RENDERERS: Record<SubtypeFieldType, Renderer> = {
  boolean: ({ field, value, onChange }) => {
    const checked = value === true || value === "true";
    return (
      <label className="mt-1 flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={checkboxClass}
        />
        <span className="text-sm text-[var(--foreground)]">{field.label}</span>
      </label>
    );
  },

  text: ({ field, value, onChange }) => (
    <input
      type="text"
      value={strOf(value)}
      required={field.required}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={field.description}
      className={inputClass}
    />
  ),

  text_optional: ({ field, value, onChange }) => (
    <input
      type="text"
      value={strOf(value)}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={field.description}
      className={inputClass}
    />
  ),

  sensitive_text: ({ field, value, onChange }) => (
    <input
      type="password"
      value={strOf(value)}
      required={field.required}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={field.description}
      autoComplete="off"
      className={inputClass}
    />
  ),

  password: ({ field, value, onChange }) => (
    <input
      type="password"
      value={strOf(value)}
      required={field.required}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={field.description}
      autoComplete="new-password"
      className={inputClass}
    />
  ),

  markdown_short: ({ field, value, onChange }) => (
    <textarea
      value={strOf(value)}
      required={field.required}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={field.description}
      rows={2}
      className={textareaClass}
    />
  ),

  textarea: ({ field, value, onChange }) => (
    <textarea
      value={strOf(value)}
      required={field.required}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={field.description}
      rows={3}
      className={textareaClass}
    />
  ),

  enum: ({ field, value, onChange }) => (
    <select
      value={strOf(value)}
      required={field.required}
      onChange={(e) => onChange(e.target.value || null)}
      className={inputClass}
    >
      <option value="">—</option>
      {(field.options ?? []).map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
          {opt.recommended ? " ★" : ""}
        </option>
      ))}
    </select>
  ),

  enum_optional: ({ field, value, onChange }) => (
    <select
      value={strOf(value)}
      onChange={(e) => onChange(e.target.value || null)}
      className={inputClass}
    >
      <option value="">— Seleccionar —</option>
      {(field.options ?? []).map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
          {opt.recommended ? " ★" : ""}
        </option>
      ))}
    </select>
  ),

  number: ({ field, value, onChange }) => (
    <input
      type="number"
      value={strOf(value)}
      required={field.required}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      placeholder={field.description}
      className={inputClass}
    />
  ),

  number_optional: ({ field, value, onChange }) => (
    <input
      type="number"
      value={strOf(value)}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      placeholder={field.description}
      className={inputClass}
    />
  ),

  date: ({ field, value, onChange }) => (
    <input
      type="date"
      value={strOf(value)}
      required={field.required}
      onChange={(e) => onChange(e.target.value || null)}
      className={inputClass}
    />
  ),

  time_range_optional: ({ field, value, onChange }) => {
    const parts = strOf(value).split("-");
    const from = parts[0] ?? "";
    const to = parts[1] ?? "";
    return (
      <div className="mt-1 flex items-center gap-2">
        <input
          type="time"
          value={from}
          onChange={(e) => {
            const newVal = e.target.value && to ? `${e.target.value}-${to}` : null;
            onChange(newVal);
          }}
          className={inputClass + " flex-1"}
        />
        <span className="text-xs text-[var(--color-neutral-400)]">a</span>
        <input
          type="time"
          value={to}
          onChange={(e) => {
            const newVal = from && e.target.value ? `${from}-${e.target.value}` : null;
            onChange(newVal);
          }}
          className={inputClass + " flex-1"}
        />
      </div>
    );
  },

  number_list_optional: ({ field, value, onChange }) => (
    <input
      type="text"
      value={strOf(value)}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={field.description}
      className={inputClass}
    />
  ),
};

/**
 * Render the input primitive for a field's type. Throws the same loud error
 * as the validator registry if the type is unknown — extension test enforces
 * that every key in FIELD_TYPES has a RENDERERS entry.
 */
export function renderFieldInput(props: FieldInputProps): ReactNode {
  getFieldType(props.field.type); // validate the type string, throws on miss
  return RENDERERS[props.field.type as SubtypeFieldType](props);
}

export function fieldTypeWrapsOwnLabel(type: string): boolean {
  const entry = FIELD_TYPES[type as SubtypeFieldType] as
    | { wrapsOwnLabel?: boolean }
    | undefined;
  return entry?.wrapsOwnLabel === true;
}

/** Exported for the extension/coverage test. */
export const FIELD_RENDERER_KEYS = Object.keys(RENDERERS) as SubtypeFieldType[];
