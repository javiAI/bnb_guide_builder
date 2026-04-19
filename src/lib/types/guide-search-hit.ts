// GuideSearchIndex — embedded payload emitted by
// `buildGuideSearchIndex()` and consumed by the `GuideSearch` client
// island. Every entry derives exclusively from the post-normalize
// display surface (`displayValue` / `displayFields[].displayValue`);
// the internal `value` / `fields` shape of `GuideItem` is never read
// here. Sensitive / raw-presenter items are dropped upstream by
// `filterByAudience` + `filterRenderableItems` before this builder
// runs, so no item in the index can leak non-guest data.

export interface GuideSearchEntry {
  /** Stable id — `item-<id>` for top-level items, `child-<parentId>-<idx>`
   * for flattened children. Used as the React key and as the dedupe key
   * when an aggregator section (hero) mirrors an item that also lives in
   * its canonical section. Distinct from `anchor` — see below. */
  id: string;
  /** DOM id the client island passes to `document.getElementById()` to
   * scroll-to. Top-level → `item-<id>`; flattened children →
   * `item-<parentId>--child-<idx>` (matches what `GuideItem` stamps). */
  anchor: string;
  /** Section id the entry resolves against for scrollspy context. */
  sectionId: string;
  /** Section display label — shown in the hit card as disambiguator. */
  sectionLabel: string;
  /** Item label (already humanized by the presentation layer). */
  label: string;
  /** Humanized value or concatenation of `displayFields[].displayValue`,
   * trimmed per-field and truncated to `SNIPPET_MAX_LENGTH` with ellipsis. */
  snippet: string;
  /** Flat corpus Fuse searches against — combines label + snippet +
   * section keywords. Kept as a single string to keep the index compact
   * and let Fuse's weighted keys drive relevance through the top-level
   * projection. */
  keywords: string;
}

export interface GuideSearchIndex {
  /** Deterministic hash of the tree state this index was built from.
   * Consumers (PWA cache in 10I) can use this to decide whether a
   * cached index is stale. */
  buildVersion: string;
  entries: GuideSearchEntry[];
}

export interface GuideSearchHit {
  entry: GuideSearchEntry;
  /** Fuse score. Lower is better; 0 means exact. */
  score: number;
}
