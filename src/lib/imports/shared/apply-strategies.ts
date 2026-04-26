import type {
  AmenitiesDiff,
  DiffEntry,
  ImportDiff,
  ImportWarning,
} from "./types";

export type ResolutionStrategy = "take_import" | "keep_current" | "skip";

export type ApplyCategory =
  | "scalar"
  | "policies"
  | "amenities.add"
  | "amenities.remove";

export interface AppliedMutation {
  field: string;
  category: ApplyCategory;
  value: unknown;
}

export interface SkippedMutation {
  field: string;
  category: ApplyCategory;
  reason: "client_skip" | "client_keep_current" | "identical" | "server_unactionable";
  message?: string;
}

export interface ApplyPlan {
  applied: AppliedMutation[];
  skipped: SkippedMutation[];
  warnings: ImportWarning[];
}

/** Resolutions targeting categories the applier never mutates. */
export class InvalidResolutionError extends Error {
  readonly field: string;
  readonly reasonCode: "non_actionable_category" | "unknown_strategy";
  constructor(
    field: string,
    reasonCode: "non_actionable_category" | "unknown_strategy",
    message: string,
  ) {
    super(message);
    this.field = field;
    this.reasonCode = reasonCode;
    this.name = "InvalidResolutionError";
  }
}

/** Client sent a resolution for a field absent from the server-recomputed diff. */
export class StaleResolutionError extends Error {
  readonly missingFields: string[];
  constructor(missingFields: string[]) {
    super(
      `Resolutions reference fields not in current server diff: ${missingFields.join(", ")}`,
    );
    this.missingFields = missingFields;
    this.name = "StaleResolutionError";
  }
}

const SCALAR_PREFIX = "scalar.";
const AMENITIES_ADD_PREFIX = "amenities.add.";
const AMENITIES_REMOVE_PREFIX = "amenities.remove.";

const NON_ACTIONABLE_PREFIXES = ["presence.", "freeText.", "customs."] as const;

function scalarFieldId(entry: DiffEntry): string {
  return `${SCALAR_PREFIX}${entry.field}`;
}

function policiesFieldId(entry: DiffEntry): string {
  return entry.field;
}

function amenityAddFieldId(taxonomyId: string): string {
  return `${AMENITIES_ADD_PREFIX}${taxonomyId}`;
}

function amenityRemoveFieldId(taxonomyId: string): string {
  return `${AMENITIES_REMOVE_PREFIX}${taxonomyId}`;
}

/** Field IDs the applier exposes for client-driven resolution. */
export function actionableFieldsFromDiff(diff: ImportDiff): Set<string> {
  const out = new Set<string>();
  for (const entry of diff.scalar) out.add(scalarFieldId(entry));
  for (const entry of diff.policies) out.add(policiesFieldId(entry));
  for (const a of diff.amenities.add) out.add(amenityAddFieldId(a.taxonomyId));
  for (const r of diff.amenities.remove) out.add(amenityRemoveFieldId(r.taxonomyId));
  return out;
}

/** Default resolution per entry, surfaced to the UI as a starting point. */
export function defaultResolutionForEntry(entry: DiffEntry): ResolutionStrategy {
  if (entry.status === "unactionable") return "skip";
  if (entry.status === "identical") return "keep_current";
  return entry.suggestedAction === "take_import" ? "take_import" : "keep_current";
}

export function defaultResolutionForAmenityAdd(): ResolutionStrategy {
  return "take_import";
}

export function defaultResolutionForAmenityRemove(): ResolutionStrategy {
  return "keep_current";
}

/**
 * Reconcile a server-recomputed diff with client resolutions.
 *
 * Throws `InvalidResolutionError` when the client targets a non-actionable
 * category (`presence` / `freeText` / `customs`) or sends an unknown strategy.
 * Throws `StaleResolutionError` when the client targets a field absent from
 * the current server diff (state changed since the preview).
 *
 * Server-forced behaviour:
 *   - `policies` entries with `status: "unactionable"` are always skipped
 *     with a `server_unactionable` reason — the client's strategy is ignored.
 *   - Identical scalar entries collapse to a `client_keep_current` skip even
 *     when the client picked `take_import`, to keep `applied[]` semantically
 *     meaningful (only real value changes).
 */
export function planApply(
  diff: ImportDiff,
  resolutions: Record<string, ResolutionStrategy>,
): ApplyPlan {
  for (const [field, strategy] of Object.entries(resolutions)) {
    if (NON_ACTIONABLE_PREFIXES.some((p) => field.startsWith(p))) {
      throw new InvalidResolutionError(
        field,
        "non_actionable_category",
        `Field "${field}" belongs to a non-actionable category (presence/freeText/customs); the server never mutates these from import.`,
      );
    }
    if (
      strategy !== "take_import" &&
      strategy !== "keep_current" &&
      strategy !== "skip"
    ) {
      throw new InvalidResolutionError(
        field,
        "unknown_strategy",
        `Field "${field}" has unknown strategy "${strategy}". Allowed: take_import | keep_current | skip.`,
      );
    }
  }

  const validFields = actionableFieldsFromDiff(diff);
  const missing: string[] = [];
  for (const field of Object.keys(resolutions)) {
    if (!validFields.has(field)) missing.push(field);
  }
  if (missing.length > 0) throw new StaleResolutionError(missing);

  const applied: AppliedMutation[] = [];
  const skipped: SkippedMutation[] = [];
  const warnings: ImportWarning[] = [];

  for (const entry of diff.scalar) {
    planScalar(entry, resolutions, applied, skipped);
  }
  for (const entry of diff.policies) {
    planPolicy(entry, resolutions, applied, skipped, warnings);
  }
  planAmenities(diff.amenities, resolutions, applied, skipped);

  return { applied, skipped, warnings };
}

function planScalar(
  entry: DiffEntry,
  resolutions: Record<string, ResolutionStrategy>,
  applied: AppliedMutation[],
  skipped: SkippedMutation[],
): void {
  const fieldId = scalarFieldId(entry);
  if (entry.status === "unactionable") {
    skipped.push({
      field: fieldId,
      category: "scalar",
      reason: "server_unactionable",
      message: entry.message,
    });
    return;
  }
  const strategy = resolutions[fieldId] ?? defaultResolutionForEntry(entry);
  if (entry.status === "identical") {
    skipped.push({
      field: fieldId,
      category: "scalar",
      reason: "identical",
    });
    return;
  }
  if (strategy === "take_import") {
    applied.push({
      field: fieldId,
      category: "scalar",
      value: entry.incoming,
    });
  } else if (strategy === "skip") {
    skipped.push({
      field: fieldId,
      category: "scalar",
      reason: "client_skip",
    });
  } else {
    skipped.push({
      field: fieldId,
      category: "scalar",
      reason: "client_keep_current",
    });
  }
}

function planPolicy(
  entry: DiffEntry,
  resolutions: Record<string, ResolutionStrategy>,
  applied: AppliedMutation[],
  skipped: SkippedMutation[],
  warnings: ImportWarning[],
): void {
  const fieldId = policiesFieldId(entry);
  if (entry.status === "unactionable") {
    skipped.push({
      field: fieldId,
      category: "policies",
      reason: "server_unactionable",
      message: entry.message,
    });
    warnings.push({
      code:
        entry.reason === "requires_currency_decision"
          ? "requires_currency_for_fees"
          : "free_text_not_reconciled",
      field: fieldId,
      message: `Skipped ${fieldId}: ${entry.message}`,
    });
    return;
  }
  const strategy = resolutions[fieldId] ?? defaultResolutionForEntry(entry);
  if (entry.status === "identical") {
    skipped.push({
      field: fieldId,
      category: "policies",
      reason: "identical",
    });
    return;
  }
  if (strategy === "take_import") {
    applied.push({
      field: fieldId,
      category: "policies",
      value: entry.incoming,
    });
  } else if (strategy === "skip") {
    skipped.push({
      field: fieldId,
      category: "policies",
      reason: "client_skip",
    });
  } else {
    skipped.push({
      field: fieldId,
      category: "policies",
      reason: "client_keep_current",
    });
  }
}

function planAmenities(
  amenities: AmenitiesDiff,
  resolutions: Record<string, ResolutionStrategy>,
  applied: AppliedMutation[],
  skipped: SkippedMutation[],
): void {
  for (const a of amenities.add) {
    const fieldId = amenityAddFieldId(a.taxonomyId);
    const strategy = resolutions[fieldId] ?? defaultResolutionForAmenityAdd();
    if (strategy === "take_import") {
      applied.push({
        field: fieldId,
        category: "amenities.add",
        value: a.taxonomyId,
      });
    } else if (strategy === "skip") {
      skipped.push({
        field: fieldId,
        category: "amenities.add",
        reason: "client_skip",
      });
    } else {
      skipped.push({
        field: fieldId,
        category: "amenities.add",
        reason: "client_keep_current",
      });
    }
  }
  for (const r of amenities.remove) {
    const fieldId = amenityRemoveFieldId(r.taxonomyId);
    const strategy = resolutions[fieldId] ?? defaultResolutionForAmenityRemove();
    if (strategy === "take_import") {
      applied.push({
        field: fieldId,
        category: "amenities.remove",
        value: r.taxonomyId,
      });
    } else if (strategy === "skip") {
      skipped.push({
        field: fieldId,
        category: "amenities.remove",
        reason: "client_skip",
      });
    } else {
      skipped.push({
        field: fieldId,
        category: "amenities.remove",
        reason: "client_keep_current",
      });
    }
  }
}
