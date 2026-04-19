import { createHash } from "node:crypto";
import { getGuideSectionConfig } from "@/lib/taxonomy-loader";
import {
  filterRenderableItems,
  resolveDisplayFields,
  resolveDisplayValue,
} from "@/lib/renderers/_guide-display";
import type {
  GuideItem,
  GuideSection,
  GuideTree,
} from "@/lib/types/guide-tree";
import type {
  GuideSearchEntry,
  GuideSearchIndex,
} from "@/lib/types/guide-search-hit";

const SNIPPET_MAX_LENGTH = 160;

/** Builds the serializable search index from an already-normalized guest
 * tree. Must run AFTER `filterByAudience("guest")` +
 * `normalizeGuideForPresentation("guest")` — this builder reads the
 * presentation surface only (`displayValue` / `displayFields[].displayValue`).
 *
 * Invariants:
 * - Sensitive / non-guest items never enter the index (they were filtered
 *   upstream; this builder refuses audiences other than `guest` to avoid
 *   a miswired call site).
 * - Items with `presentationType === "raw"` are dropped by
 *   `filterRenderableItems`.
 * - Aggregator sections (`isAggregator = true`) clone items from other
 *   sections; we deduplicate by item id and keep the canonical
 *   (non-aggregator) section as the anchor target.
 * - Children are flattened into their own entries with an anchor pointing
 *   at `item-<parentId>--child-<idx>` (matches the `id` stamped by
 *   `GuideItem` on each `<li>`). */
export function buildGuideSearchIndex(tree: GuideTree): GuideSearchIndex {
  if (tree.audience !== "guest") {
    throw new Error(
      `buildGuideSearchIndex: expected audience="guest", received "${tree.audience}"`,
    );
  }

  const canonicalEntries = new Map<string, GuideSearchEntry>();
  const aggregatorEntries: GuideSearchEntry[] = [];

  for (const section of tree.sections) {
    const renderable = filterRenderableItems(section.items, "guest");
    const keywords = getSectionKeywords(section);
    const push = (entry: GuideSearchEntry | null) => {
      if (!entry) return;
      if (section.isAggregator) aggregatorEntries.push(entry);
      else if (!canonicalEntries.has(entry.id))
        canonicalEntries.set(entry.id, entry);
    };

    for (const item of renderable) {
      push(
        buildEntry(item, section, keywords, {
          id: `item-${item.id}`,
          anchor: `item-${item.id}`,
        }),
      );
      let childIdx = 0;
      for (const child of item.children) {
        if (child.presentationType === "raw") continue;
        push(
          buildEntry(child, section, keywords, {
            id: `child-${item.id}-${childIdx}`,
            anchor: `item-${item.id}--child-${childIdx}`,
          }),
        );
        childIdx += 1;
      }
    }
  }

  // Merge aggregator entries only when the item didn't already land under
  // its canonical section — preserves "anchor goes home, not to hero".
  for (const entry of aggregatorEntries) {
    if (!canonicalEntries.has(entry.id)) {
      canonicalEntries.set(entry.id, entry);
    }
  }

  const entries = Array.from(canonicalEntries.values());
  return { buildVersion: computeBuildVersion(tree, entries), entries };
}

function buildEntry(
  item: GuideItem,
  section: GuideSection,
  sectionKeywords: readonly string[],
  anchor: { id: string; anchor: string },
): GuideSearchEntry | null {
  const label = item.label.trim();
  if (!label) return null;
  const displayValue = resolveDisplayValue(item) ?? "";
  const fieldValues = resolveDisplayFields(item)
    .map((f) => f.value)
    .filter((v) => v.length > 0);
  const snippet = buildSnippet(displayValue, fieldValues);
  return {
    id: anchor.id,
    anchor: anchor.anchor,
    sectionId: section.id,
    sectionLabel: section.label,
    label,
    snippet,
    keywords: buildKeywordCorpus(label, snippet, sectionKeywords),
  };
}

function buildSnippet(
  displayValue: string,
  fieldValues: readonly string[],
): string {
  const parts: string[] = [];
  if (displayValue.trim()) parts.push(displayValue.trim());
  for (const v of fieldValues) parts.push(v.trim());
  const joined = parts.join(" · ");
  if (joined.length <= SNIPPET_MAX_LENGTH) return joined;
  return `${joined.slice(0, SNIPPET_MAX_LENGTH - 1).trimEnd()}…`;
}

function buildKeywordCorpus(
  label: string,
  snippet: string,
  sectionKeywords: readonly string[],
): string {
  return [label, snippet, ...sectionKeywords].join(" ").trim();
}

function getSectionKeywords(section: GuideSection): readonly string[] {
  const config = getGuideSectionConfig(section.id);
  return config?.searchableKeywords ?? [];
}

function computeBuildVersion(
  tree: GuideTree,
  entries: readonly GuideSearchEntry[],
): string {
  const seed = `${tree.propertyId}|${tree.generatedAt}|${entries.length}|${entries
    .map((e) => e.id)
    .join(",")}`;
  return createHash("sha1").update(seed).digest("hex").slice(0, 12);
}

