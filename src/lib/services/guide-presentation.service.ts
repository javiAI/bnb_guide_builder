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
 * tree. Pure: no DB access, no mutation of the input tree. */
export function normalizeGuideForPresentation(
  tree: GuideTree,
  audience: GuideAudience,
): GuideTree {
  return {
    ...tree,
    sections: tree.sections.map((section) => normalizeSection(section, audience)),
  };
}

function normalizeSection(
  section: GuideSection,
  audience: GuideAudience,
): GuideSection {
  return {
    ...section,
    items: section.items.map((item) => normalizeItem(item, audience)),
  };
}

function normalizeItem(item: GuideItem, audience: GuideAudience): GuideItem {
  const presenter = getPresenter(item.taxonomyKey);
  const output = presenter(item, audience);
  const warnings = [...output.warnings];
  const displayFields =
    audience === "guest"
      ? sanitizeGuestFields(output.displayFields, warnings)
      : output.displayFields;
  return {
    ...item,
    presentationType: output.presentationType,
    displayValue: output.displayValue,
    displayFields,
    presentationWarnings: warnings.length > 0 ? warnings : undefined,
    children: item.children.map((child) => normalizeItem(child, audience)),
  };
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

