import type { SystemSubtype } from "@/lib/types/taxonomy";
import type { EntityCardStatus } from "@/components/ui/entity-media-card";

/**
 * Completeness model for a property system (Liora 16E.5 → 16I-5). Pure, no React
 * — shared by the list page (single section + header chips) and the row
 * component (status pill). No schema or functional change: this only derives
 * display state from data already loaded.
 */
export type SystemStatus = "configured" | "incomplete" | "empty";

export interface SystemCompleteness {
  /** Number of subtype fields with a non-empty value. */
  filled: number;
  /** Total subtype fields (details + ops). 0 means the subtype has no fields. */
  total: number;
  status: SystemStatus;
}

/** Domain status → canonical entity-card status vocabulary. */
export const SYSTEM_STATUS_KEY: Record<SystemStatus, EntityCardStatus> = {
  configured: "complete",
  incomplete: "partial",
  empty: "empty",
};

/** Domain status → Spanish pill label (canonical 16I vocabulary). */
export const SYSTEM_STATUS_LABEL: Record<SystemStatus, string> = {
  configured: "Configurado",
  incomplete: "En progreso",
  empty: "Sin empezar",
};

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
  // its mere existence in the DB means it's configured (Q4).
  if (total === 0) {
    return { filled: 0, total: 0, status: "configured" };
  }

  let filled = 0;
  for (const f of detailFields) if (isFilled(detailsJson[f.id])) filled += 1;
  for (const f of opsFields) if (isFilled(opsJson[f.id])) filled += 1;

  const status: SystemStatus =
    filled === 0 ? "empty" : filled === total ? "configured" : "incomplete";
  return { filled, total, status };
}

/**
 * Labels of the subtype fields still missing a value, in declaration order
 * (details first, then ops). Same `isFilled` predicate as `computeCompleteness`,
 * so the two never disagree. Returns an empty array for a subtypeless system or
 * a fully-configured one.
 */
export function missingSystemFieldLabels(
  subtype: SystemSubtype | null | undefined,
  detailsJson: Record<string, unknown>,
  opsJson: Record<string, unknown>,
): string[] {
  const labels: string[] = [];
  for (const f of subtype?.detailsFields ?? []) {
    if (!isFilled(detailsJson[f.id])) labels.push(f.label);
  }
  for (const f of subtype?.opsFields ?? []) {
    if (!isFilled(opsJson[f.id])) labels.push(f.label);
  }
  return labels;
}

/**
 * Hover detail for a row pill: `Falta: A, B, C` capped at 3 labels, with a
 * `y N más` tail when more remain. Returns undefined when nothing is missing.
 */
export function formatMissingDetail(labels: string[]): string | undefined {
  if (labels.length === 0) return undefined;
  const shown = labels.slice(0, 3);
  const rest = labels.length - shown.length;
  const tail = rest > 0 ? ` y ${rest} más` : "";
  return `Falta: ${shown.join(", ")}${tail}`;
}
