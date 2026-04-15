// Field-type registry — single source of truth for how each `type` string in
// taxonomy subtype fields (amenity_subtypes.json, system_subtypes.json) is
// validated. Renderers live in field-type-renderers.tsx and are wired to the
// same keys; the extension test enforces parity between both halves.
//
// Adding a new field type = add an entry here, an entry in field-type-renderers,
// and (if the type should appear in taxonomies) reference it in JSON. No edits
// to amenity/system forms or server schemas.

import { z } from "zod";
import type { TaxonomyOption } from "@/lib/types/taxonomy";

// Field shape understood by the registry. Superset of SubtypeField and
// SystemSubtypeField so both can delegate here.
export interface FieldTypeMeta {
  id: string;
  label: string;
  description?: string;
  type: string;
  required?: boolean;
  options?: TaxonomyOption[];
}

export interface FieldTypeEntry<TMeta extends FieldTypeMeta = FieldTypeMeta> {
  /** Returns a Zod schema for the field. Handles `required` per-type. */
  validate: (field: TMeta) => z.ZodTypeAny;
  /** When true, the renderer emits its own <label> (checkbox). Callers
   * should skip their outer label wrapper for these types. */
  wrapsOwnLabel?: boolean;
}

// Helpers ---------------------------------------------------------------

function enumSchema(field: FieldTypeMeta): z.ZodTypeAny {
  const values = (field.options ?? []).map((o) => o.id);
  return values.length > 0
    ? z.enum(values as [string, ...string[]])
    : z.string();
}

function freeTextSchema(field: FieldTypeMeta): z.ZodTypeAny {
  if (field.required === true) {
    return z.string().min(1, `${field.label} es obligatorio`);
  }
  return z.string().nullish();
}

// Registry --------------------------------------------------------------

export const FIELD_TYPES = {
  boolean: {
    wrapsOwnLabel: true,
    validate: () => z.boolean(),
  },

  text: {
    validate: freeTextSchema,
  },

  text_optional: {
    validate: () => z.string().nullish(),
  },

  sensitive_text: {
    validate: freeTextSchema,
  },

  password: {
    validate: freeTextSchema,
  },

  markdown_short: {
    validate: freeTextSchema,
  },

  textarea: {
    validate: freeTextSchema,
  },

  enum: {
    validate: (f) => (f.required === true ? enumSchema(f) : enumSchema(f).nullish()),
  },

  enum_optional: {
    validate: (f) => enumSchema(f).nullish(),
  },

  number: {
    validate: (f) =>
      f.required === true ? z.number().finite() : z.number().finite().nullish(),
  },

  number_optional: {
    validate: () => z.number().finite().nullish(),
  },

  date: {
    validate: (f) => {
      const base = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");
      return f.required === true ? base : base.nullish();
    },
  },

  time_range_optional: {
    validate: () =>
      z
        .string()
        .regex(
          /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/,
          "Formato horario inválido (HH:MM-HH:MM)",
        )
        .nullish(),
  },

  number_list_optional: {
    validate: () =>
      z
        .string()
        .regex(
          /^\s*\d+(\s*,\s*\d+)*\s*$/,
          "Debe ser una lista de números separados por comas",
        )
        .nullish(),
  },
} satisfies Record<string, FieldTypeEntry>;

export type SubtypeFieldType = keyof typeof FIELD_TYPES;

/**
 * Lookup entry by type string. Throws loudly with the full list of valid
 * types so a stale/typo'd taxonomy entry fails fast rather than silently
 * falling back to text (the pre-registry behavior).
 */
export function getFieldType(type: string): FieldTypeEntry {
  if (!Object.prototype.hasOwnProperty.call(FIELD_TYPES, type)) {
    throw new Error(
      `Unknown field type "${type}". Expected one of: ${Object.keys(FIELD_TYPES).join(", ")}.`,
    );
  }
  return FIELD_TYPES[type as SubtypeFieldType];
}

export function isKnownFieldType(type: string): type is SubtypeFieldType {
  return Object.prototype.hasOwnProperty.call(FIELD_TYPES, type);
}
