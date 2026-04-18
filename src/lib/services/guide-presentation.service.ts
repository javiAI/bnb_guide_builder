import { getPresenter } from "@/config/registries/presenter-registry";
import {
  TAXONOMY_KEY_PATTERN,
  looksLikeRawJson,
} from "@/lib/presenters/types";
import type {
  GuideAudience,
  GuideItem,
  GuideItemDisplayField,
  GuideSection,
  GuideTree,
} from "@/lib/types/guide-tree";

/** Labels that belong to the internal data model and must never reach the
 * guest. Defensive net — resolvers don't emit these today, but if a new one
 * does, the boundary stays sealed. Exported so the guest-leak invariant test
 * asserts against the same source of truth. */
export const INTERNAL_FIELD_LABEL_DENYLIST: ReadonlySet<string> = new Set([
  "Slot",
  "Config JSON",
  "Raw",
  "Propiedad",
]);

/** Terminal presentation layer.
 *
 * Pure, idempotent transformation applied after `filterByAudience` and before
 * any renderer. Walks the tree, resolves a presenter per item via
 * `presenter-registry`, and stamps `presentationType` / `displayValue` /
 * `displayFields` / `presentationWarnings`. The internal `value` / `fields`
 * survive on the tree (non-guest audiences still read them), but guest-facing
 * renderers must consume `displayValue` / `displayFields` exclusively.
 *
 * Idempotent: calling with an already-normalized tree returns an equivalent
 * tree. Pure: no DB access, no mutation of the input tree.
 *
 * Observability: when any item ends up with `presentationWarnings`, emits a
 * single aggregated `console.warn` at the end of the call (not per item) so
 * drops are visible in telemetry without spamming logs. */
export function normalizeGuideForPresentation(
  tree: GuideTree,
  audience: GuideAudience,
): GuideTree {
  const aggregator: WarningAggregator = { total: 0, byTaxonomyKey: {}, byCategory: {} };
  const normalized: GuideTree = {
    ...tree,
    sections: tree.sections.map((section) => normalizeSection(section, audience, aggregator)),
  };
  reportAggregatedWarnings(tree, audience, aggregator);
  return normalized;
}

interface WarningAggregator {
  total: number;
  /** items with warnings, grouped by taxonomyKey (or "<null>" for derived items). */
  byTaxonomyKey: Record<string, number>;
  /** drop reasons, grouped by a short category string derived from the warning. */
  byCategory: Record<string, number>;
}

function normalizeSection(
  section: GuideSection,
  audience: GuideAudience,
  aggregator: WarningAggregator,
): GuideSection {
  return {
    ...section,
    items: section.items.map((item) => normalizeItem(item, audience, aggregator)),
  };
}

function normalizeItem(
  item: GuideItem,
  audience: GuideAudience,
  aggregator: WarningAggregator,
): GuideItem {
  const presenter = getPresenter(item.taxonomyKey);
  const output = presenter(item, audience);
  const warnings = [...output.warnings];
  const displayFields =
    audience === "guest"
      ? sanitizeGuestFields(output.displayFields, warnings)
      : output.displayFields;
  if (warnings.length > 0) {
    aggregator.total += warnings.length;
    const keyBucket = item.taxonomyKey ?? "<null>";
    aggregator.byTaxonomyKey[keyBucket] = (aggregator.byTaxonomyKey[keyBucket] ?? 0) + warnings.length;
    for (const w of warnings) {
      const category = categorizeWarning(w);
      aggregator.byCategory[category] = (aggregator.byCategory[category] ?? 0) + 1;
    }
  }
  return {
    ...item,
    presentationType: output.presentationType,
    displayValue: output.displayValue,
    displayFields,
    presentationWarnings: warnings.length > 0 ? warnings : undefined,
    children: item.children.map((child) => normalizeItem(child, audience, aggregator)),
  };
}

/** Groups a raw warning string into a short category for the aggregated log.
 * Presenters / normalizer all emit warnings starting with `<source>:`; we use
 * the first colon-delimited token plus a hint of what was dropped. */
function categorizeWarning(warning: string): string {
  const source = warning.split(":", 1)[0] ?? "unknown";
  if (warning.includes("missing-presenter")) return `${source}:missing-presenter`;
  if (warning.includes("raw-json")) return `${source}:raw-json`;
  if (warning.includes("taxonomy-key") || warning.includes("taxonomy key")) {
    return `${source}:taxonomy-key`;
  }
  if (warning.includes("internal-label")) return `${source}:internal-label`;
  if (warning.includes("unparseable")) return `${source}:unparseable`;
  return source;
}

function reportAggregatedWarnings(
  tree: GuideTree,
  audience: GuideAudience,
  aggregator: WarningAggregator,
): void {
  if (aggregator.total === 0) return;
  console.warn(
    `[guide-presenter] ${aggregator.total} drops on ${tree.propertyId} audience=${audience}`,
    { byTaxonomyKey: aggregator.byTaxonomyKey, byCategory: aggregator.byCategory },
  );
}

/** Guest-only safety net applied after the presenter runs. Drops fields
 * whose label is internal-only or whose value still looks like raw JSON / an
 * unresolved taxonomy key. Emits warnings so drops surface in telemetry
 * rather than silently disappearing. */
function sanitizeGuestFields(
  fields: GuideItemDisplayField[],
  warnings: string[],
): GuideItemDisplayField[] {
  const out: GuideItemDisplayField[] = [];
  for (const f of fields) {
    if (INTERNAL_FIELD_LABEL_DENYLIST.has(f.label)) {
      warnings.push(`normalizer: dropped internal-label field ${f.label}`);
      continue;
    }
    if (!f.displayValue) continue;
    if (looksLikeRawJson(f.displayValue)) {
      warnings.push(`normalizer: dropped raw-json field ${f.label}`);
      continue;
    }
    if (TAXONOMY_KEY_PATTERN.test(f.displayValue.trim())) {
      warnings.push(`normalizer: dropped taxonomy-key field ${f.label}`);
      continue;
    }
    out.push(f);
  }
  return out;
}

