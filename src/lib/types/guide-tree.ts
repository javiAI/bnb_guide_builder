// GuideTree — typed output of GuideRenderingService.composeGuide().
// Intentionally structural (no discriminated unions per section). Each
// resolver returns items with the same shape so the renderer (9B) and any
// downstream consumer can walk the tree uniformly.

import type { GuideAudience, GuideResolverKey, GuideSortBy } from "@/lib/taxonomy-loader";

export type { GuideAudience, GuideResolverKey, GuideSortBy };

export interface GuideMediaVariants {
  thumb: string;
  md: string;
  full: string;
}

export interface GuideMedia {
  assetId: string;
  variants: GuideMediaVariants;
  mimeType: string;
  alt: string;
  role?: string;
  caption?: string;
}

export interface GuideItemField {
  label: string;
  value: string;
  visibility: GuideAudience;
}

export interface GuideItem {
  /** Stable id — DB row id for entity-backed items, synthetic for derived ones. */
  id: string;
  /** Taxonomy key this item represents (e.g. amenityKey, spaceType, categoryKey). */
  taxonomyKey: string | null;
  /** Display label — taxonomy label, or raw key for deprecated entries. */
  label: string;
  /** Short primary value (when not a full structured entity). */
  value: string | null;
  /** Visibility as emitted by the resolver (never `sensitive` — sensitive is hard-gated). */
  visibility: GuideAudience;
  /** True when `taxonomyKey` is no longer present in the current taxonomy. */
  deprecated: boolean;
  /** Optional warnings surfaced during composition (unknown field types, etc). */
  warnings: string[];
  /** Structured fields (subtype details, policy fields, contact rows). */
  fields: GuideItemField[];
  /** Media attached to this item. Empty array when none. */
  media: GuideMedia[];
  /** Nested items (e.g. amenities inside a space). Empty array when none. */
  children: GuideItem[];
}

export interface GuideSection {
  id: string;
  label: string;
  order: number;
  resolverKey: GuideResolverKey;
  sortBy: GuideSortBy;
  /**
   * Empty-state CTA deep-link to the host panel, resolved with propertyId.
   * `null` when the audience is `guest` — host-panel links are never exposed
   * to guests (see docs/MASTER_PLAN_V2.md §9A).
   */
  emptyCtaDeepLink: string | null;
  /**
   * Visibility metadata describing the highest-visibility content this
   * section can carry. Sections always appear in the tree; the real
   * filtering happens per item/field in `filterByAudience`.
   */
  maxVisibility: GuideAudience;
  items: GuideItem[];
}

export interface GuideTree {
  propertyId: string;
  audience: GuideAudience;
  generatedAt: string;
  sections: GuideSection[];
}
