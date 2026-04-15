// GuideTree — typed output of GuideRenderingService.composeGuide().
// Intentionally structural (no discriminated unions per section). Each
// resolver returns items with the same shape so the renderer (9B) and any
// downstream consumer can walk the tree uniformly.

import type { GuideAudience, GuideResolverKey, GuideSortBy } from "@/lib/taxonomy-loader";

export type { GuideAudience, GuideResolverKey, GuideSortBy };

export interface GuideMedia {
  url: string;
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
  /** Most-restrictive visibility of the contents (never `sensitive` in the tree). */
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
  /** Empty-state CTA deep-link to the host panel, resolved with propertyId. */
  emptyCtaDeepLink: string;
  /** Never rendered for audience=guest (`internal`/`ai`/`sensitive` sections). */
  maxVisibility: GuideAudience;
  items: GuideItem[];
}

export interface GuideTree {
  propertyId: string;
  audience: GuideAudience;
  generatedAt: string;
  sections: GuideSection[];
}
