import type { SystemSubtype } from "@/lib/types/taxonomy";

/**
 * Completeness model for a property system (Liora 16E.5). Pure, no React —
 * shared by the list page (section grouping + header chips) and the row
 * component (status pill + ring). No schema or functional change: this only
 * derives display state from data already loaded.
 */
export type SystemStatus = "configured" | "incomplete" | "empty";

export interface SystemCompleteness {
  /** Number of subtype fields with a non-empty value. */
  filled: number;
  /** Total subtype fields (details + ops). 0 means the subtype has no fields. */
  total: number;
  /** Completion percentage 0–100, or null when there is nothing to configure. */
  pct: number | null;
  status: SystemStatus;
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function computeCompleteness(
  subtype: SystemSubtype | null | undefined,
  detailsJson: Record<string, unknown>,
  opsJson: Record<string, unknown>,
): SystemCompleteness {
  const detailFields = subtype?.detailsFields ?? [];
  const opsFields = subtype?.opsFields ?? [];
  const total = detailFields.length + opsFields.length;

  // Subtypeless system (or a subtype with no fields): nothing to configure, so
  // its mere existence in the DB means "Activo" → treated as configured (Q4).
  if (total === 0) {
    return { filled: 0, total: 0, pct: null, status: "configured" };
  }

  let filled = 0;
  for (const f of detailFields) if (isFilled(detailsJson[f.id])) filled += 1;
  for (const f of opsFields) if (isFilled(opsJson[f.id])) filled += 1;

  const pct = Math.round((filled / total) * 100);
  const status: SystemStatus =
    filled === 0 ? "empty" : filled === total ? "configured" : "incomplete";
  return { filled, total, pct, status };
}
