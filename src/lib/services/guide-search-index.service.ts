import { createHash } from "node:crypto";
import { getGuideSectionConfig } from "@/lib/taxonomy-loader";
import { filterRenderableItems } from "@/lib/renderers/_guide-display";
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

/** Aggregator sections clone items from other resolvers with a synthetic id
 * prefix — currently only `resolveEssentials` does this, stamping
 * `essentials.<resolverKey>.<originalId>` (see `guide-rendering.service.ts`).
 * To make "anchor goes home, not to hero" actually work we need to compare
 * against the canonical id, not the synthetic one. */
const ESSENTIALS_CLONE_ID = /^essentials\.[^.]+\.(.+)$/;
function canonicalItemId(item: GuideItem): string {
  const m = ESSENTIALS_CLONE_ID.exec(item.id);
  return m ? m[1] : item.id;
}

/** Builds the serializable search index from an already-normalized guest
 * tree. Must run AFTER `filterByAudience("guest")` +
 * `normalizeGuideForPresentation("guest")` — this builder reads the
 * presentation surface only (`displayValue` / `displayFields[].displayValue`).
 * Raw fallback to `value` / `fields` is intentionally NOT used here; if an
 * item reaches the builder without being normalized, we emit an empty
 * snippet rather than leak raw text into the index.
 *
 * Invariants:
 * - Sensitive / non-guest items never enter the index (they were filtered
 *   upstream; this builder refuses audiences other than `guest` to avoid
 *   a miswired call site).
 * - Items with `presentationType === "raw"` are dropped by
 *   `filterRenderableItems` (which we call with `suppressWarnings` so
 *   we don't log the same missing-presenter twice — the renderer already
 *   logs it in the same request).
 * - Aggregator sections (`isAggregator = true`) clone items with a synthetic
 *   id (`essentials.<key>.<origId>`). We dedupe against the CANONICAL id
 *   and point the anchor at the canonical DOM node so a search hit that
 *   only lives in the hero still scrolls to the canonical section.
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
    const renderable = filterRenderableItems(section.items, "guest", {
      suppressWarnings: true,
    });
    const keywords = getSectionKeywords(section);
    const push = (entry: GuideSearchEntry | null) => {
      if (!entry) return;
      if (section.isAggregator) aggregatorEntries.push(entry);
      else if (!canonicalEntries.has(entry.id))
        canonicalEntries.set(entry.id, entry);
    };

    for (const item of renderable) {
      const baseId = canonicalItemId(item);
      push(
        buildEntry(item, section, keywords, {
          id: `item-${baseId}`,
          anchor: `item-${baseId}`,
        }),
      );
      let childIdx = 0;
      for (const child of item.children) {
        if (child.presentationType === "raw") continue;
        push(
          buildEntry(child, section, keywords, {
            id: `child-${baseId}-${childIdx}`,
            anchor: `item-${baseId}--child-${childIdx}`,
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
  // Strict: read the presentation surface only. If normalize didn't run on
  // this item (shouldn't happen for audience=guest, guarded above) we emit
  // empty content rather than fall back to raw value/fields.
  const displayValue = (item.displayValue ?? "").trim();
  const fieldValues = (item.displayFields ?? [])
    .map((f) => f.displayValue.trim())
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
  if (displayValue) parts.push(displayValue);
  for (const v of fieldValues) parts.push(v);
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
  // Hash must turn over when content changes, not only when id set changes —
  // otherwise 10I's PWA keeps a stale index whenever a label/snippet/keyword
  // edit leaves ids intact.
  const hash = createHash("sha1");
  hash.update(`${tree.propertyId}|${tree.generatedAt}|${entries.length}`);
  for (const e of entries) {
    hash.update(`\x1f${e.id}\x1f${e.label}\x1f${e.snippet}\x1f${e.keywords}`);
  }
  return hash.digest("hex").slice(0, 12);
}

