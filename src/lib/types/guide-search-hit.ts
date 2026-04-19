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
   * for flattened children. Matches the `data-search-anchor` attribute
   * that the renderer stamps on the DOM for scroll-to. */
  id: string;
  /** DOM anchor target. For top-level items this is `item-<id>`; for
   * flattened children it's the parent's item anchor plus a suffix. */
  anchor: string;
  /** Section id the entry resolves against for scrollspy context. */
  sectionId: string;
  /** Section display label — shown in the hit card as disambiguator. */
  sectionLabel: string;
  /** Item label (already humanized by the presentation layer). */
  label: string;
  /** Humanized value or concatenation of `displayFields[].value`, already
   * trimmed/truncated for snippet display. */
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
