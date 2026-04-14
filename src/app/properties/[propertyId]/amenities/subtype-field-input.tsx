"use client";

import type { SubtypeField } from "@/lib/types/taxonomy";

const inputClass =
  "mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

interface SubtypeFieldInputProps {
  field: SubtypeField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
}

export function SubtypeFieldInput({ field, value, onChange }: SubtypeFieldInputProps) {
  const strValue = value != null ? String(value) : "";

  // shown_if logic handled by parent — this component just renders

  if ((field.type === "enum" || field.type === "enum_optional") && field.options) {
    return (
      <select
        value={strValue}
        onChange={(e) => onChange(field.id, e.target.value || null)}
        className={inputClass}
      >
        {field.type === "enum_optional" && <option value="">— Seleccionar —</option>}
        {field.options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
            {opt.recommended ? " ★" : ""}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "boolean") {
    const checked = value === true || value === "true";
    return (
      <label className="mt-1 flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(field.id, e.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)] text-[var(--color-primary-500)]"
        />
        <span className="text-sm text-[var(--foreground)]">{field.label}</span>
      </label>
    );
  }

  if (field.type === "number_optional") {
    return (
      <input
        type="number"
        value={strValue}
        onChange={(e) => onChange(field.id, e.target.value ? Number(e.target.value) : null)}
        placeholder={field.description}
        className={inputClass}
      />
    );
  }

  if (field.type === "sensitive_text") {
    return (
      <input
        type="password"
        value={strValue}
        onChange={(e) => onChange(field.id, e.target.value || null)}
        placeholder={field.description}
        autoComplete="off"
        className={inputClass}
      />
    );
  }

  if (field.type === "markdown_short") {
    return (
      <textarea
        value={strValue}
        onChange={(e) => onChange(field.id, e.target.value || null)}
        placeholder={field.description}
        rows={2}
        className={inputClass}
      />
    );
  }

  if (field.type === "time_range_optional") {
    // Store as "HH:MM-HH:MM" string
    const parts = strValue.split("-");
    const from = parts[0] ?? "";
    const to = parts[1] ?? "";
    return (
      <div className="mt-1 flex items-center gap-2">
        <input
          type="time"
          value={from}
          onChange={(e) => {
            const newVal = e.target.value && to ? `${e.target.value}-${to}` : null;
            onChange(field.id, newVal);
          }}
          className={inputClass + " flex-1"}
        />
        <span className="text-xs text-[var(--color-neutral-400)]">a</span>
        <input
          type="time"
          value={to}
          onChange={(e) => {
            const newVal = from && e.target.value ? `${from}-${e.target.value}` : null;
            onChange(field.id, newVal);
          }}
          className={inputClass + " flex-1"}
        />
      </div>
    );
  }

  if (field.type === "number_list_optional") {
    // Comma-separated numbers, stored as string
    return (
      <input
        type="text"
        value={strValue}
        onChange={(e) => onChange(field.id, e.target.value || null)}
        placeholder={field.description}
        className={inputClass}
      />
    );
  }

  // text, text_optional — default text input
  return (
    <input
      type="text"
      value={strValue}
      onChange={(e) => onChange(field.id, e.target.value || null)}
      placeholder={field.description}
      className={inputClass}
    />
  );
}
