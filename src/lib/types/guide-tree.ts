// GuideTree — typed output of GuideRenderingService.composeGuide().
// Intentionally structural (no discriminated unions per section). Each
// resolver returns items with the same shape so the renderer (9B) and any
// downstream consumer can walk the tree uniformly.

import type {
  GuideAudience,
  GuideJourneyStage,
  GuideResolverKey,
  GuideSortBy,
} from "@/lib/taxonomy-loader";

export type { GuideAudience, GuideJourneyStage, GuideResolverKey, GuideSortBy };

/** Current schema version written into freshly composed / published trees.
 * Bump when the shape changes in a way the React renderer can detect and
 * log (see `app/g/[slug]/page.tsx`). Old snapshots without this field still
 * render; they just log once per request as "snapshot pre-v2". */
export const GUIDE_TREE_SCHEMA_VERSION = 2 as const;

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
  /** Guest journey stage inherited from the source taxonomy (10E). */
  journeyStage?: GuideJourneyStage;
  /** Cross-cutting tags from the source taxonomy (e.g. `essential`). */
  journeyTags?: string[];
  /** Pre-rendered HTML safe string of runbook/troubleshooting notes (amenity instances). */
  runbookHtml?: string;
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
  /** Guest journey stage — drives progress rail / section grouping (10E). */
  journeyStage?: GuideJourneyStage;
  /** True for the lead/hero section (rendered with larger layout). Only one per tree. */
  isHero?: boolean;
  /** True for sections that clone items from other sections (e.g. gs.essentials).
   * Excluded from TOC to avoid duplicate navigation entries. */
  isAggregator?: boolean;
  /** Resolver keys whose items this aggregator pulls from (required when isAggregator). */
  sourceResolverKeys?: GuideResolverKey[];
  /** Human-readable empty-state copy (preferred over generic fallback). */
  emptyCopy?: string;
}

export interface GuideTree {
  /** Snapshot shape version. Absent = legacy pre-v2 snapshot. */
  schemaVersion?: number;
  propertyId: string;
  audience: GuideAudience;
  generatedAt: string;
  sections: GuideSection[];
  /** Brand palette key (curated set in `src/config/brand-palette.ts`). */
  brandPaletteKey?: string | null;
  /** Content-addressable URL of the host logo (proxied via /g/:slug/media/...). */
  brandLogoUrl?: string | null;
}
