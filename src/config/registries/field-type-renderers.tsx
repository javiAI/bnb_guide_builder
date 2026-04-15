"use client";

// Client-side renderers paired with field-type-registry.ts. Each renderer
// returns the interactive primitive only (bare input / select / textarea /
// checkbox-label). Form-level wrappers (outer <label>, required marker,
// sensitive tag) are the caller's job — except for `boolean`, whose
// checkbox renders its own inline label (marked by `wrapsOwnLabel` in the
// validator registry).

import { useEffect, useState, type ReactNode } from "react";
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

/**
 * Stateful time-range input. Holds `from`/`to` locally so a user can enter
 * one side before the other without the unentered side (empty string)
 * triggering `onChange(null)` and wiping the first pick mid-interaction.
 * Only emits "HH:MM-HH:MM" once both sides are set; emits null when both
 * are cleared. External `value` updates resync the local state so a reset
 * from the parent is still honored.
 */
function TimeRangeInput({ field, value, onChange }: FieldInputProps) {
  const parseValue = (v: unknown): [string, string] => {
    const parts = strOf(v).split("-");
    return [parts[0] ?? "", parts[1] ?? ""];
  };

  const [externalFrom, externalTo] = parseValue(value);
  const [from, setFrom] = useState(externalFrom);
  const [to, setTo] = useState(externalTo);

  // Resync when the parent swaps in a new value (different field render
  // or a reset) — compare against the derived pair, not the raw string,
  // so that local edits that haven't emitted yet don't get clobbered
  // by a re-render with the same underlying value.
  useEffect(() => {
    if (externalFrom !== from && (externalFrom !== "" || externalTo !== "")) {
      setFrom(externalFrom);
    }
    if (externalTo !== to && (externalFrom !== "" || externalTo !== "")) {
      setTo(externalTo);
    }
    // Intentionally exclude from/to from deps: we only resync on external changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFrom, externalTo]);

  const emit = (nextFrom: string, nextTo: string) => {
    if (nextFrom && nextTo) onChange(`${nextFrom}-${nextTo}`);
    else if (!nextFrom && !nextTo) onChange(null);
    // Partial (only one side filled) — don't emit; local state preserves the pick.
  };

  return (
    <div className="mt-1 flex items-center gap-2">
      <input
        type="time"
        value={from}
        required={field.required}
        onChange={(e) => {
          const v = e.target.value;
          setFrom(v);
          emit(v, to);
        }}
        className={inputClass + " flex-1"}
      />
      <span className="text-xs text-[var(--color-neutral-400)]">a</span>
      <input
        type="time"
        value={to}
        required={field.required}
        onChange={(e) => {
          const v = e.target.value;
          setTo(v);
          emit(from, v);
        }}
        className={inputClass + " flex-1"}
      />
    </div>
  );
}

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

  time_range_optional: (props) => <TimeRangeInput {...props} />,

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
