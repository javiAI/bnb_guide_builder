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
 * render; they just log once per request as "snapshot pre-v3".
 *
 * v3 (rama 10F): introduces the terminal presentation layer. Normalized trees
 * carry `presentationType` / `displayValue` / `displayFields` on each item.
 * Pre-v3 snapshots are normalized at serve time. */
export const GUIDE_TREE_SCHEMA_VERSION = 3 as const;

/** Presentation type emitted by the normalizer. `raw` is a sentinel for items
 * that reached the renderer without a matching presenter — visible only to
 * internal audiences; the guest renderer hides items with presentationType
 * "raw" and logs `missing-presenter` (see QA_AND_RELEASE §3 invariant 5). */
export const GUIDE_PRESENTATION_TYPES = [
  "generic_text",
  "policy",
  "contact",
  "amenity",
  "raw",
] as const;
export type GuidePresentationType = (typeof GUIDE_PRESENTATION_TYPES)[number];

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

/** Presentation-layer field emitted by `normalizeGuideForPresentation`.
 * Renderers (md/html/pdf/React) consume these instead of `GuideItemField`
 * when normalized. The internal `value` is never surfaced. */
export interface GuideItemDisplayField {
  label: string;
  displayValue: string;
  visibility: GuideAudience;
  icon?: string;
}

/** Field labels for contact/emergency items. The resolver emits these as
 * GuideItemField labels and `GuideEmergencySection` matches on them to promote
 * phone/email to `tel:` / `mailto:` links. Keep in one place so the two sides
 * can't drift apart silently. */
export const EMERGENCY_FIELD_LABELS = {
  phone: "Teléfono",
  email: "Email",
  notes: "Notas",
} as const;

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
  /** Presentation classification — set by `normalizeGuideForPresentation`. */
  presentationType?: GuidePresentationType;
  /** Humanized primary value. Renderers use this instead of `value`. */
  displayValue?: string;
  /** Humanized fields. Renderers use these instead of `fields`. */
  displayFields?: GuideItemDisplayField[];
  /** Non-fatal issues surfaced during normalization (missing presenter, fallback used, etc). */
  presentationWarnings?: string[];
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
  /** Human-readable empty-state copy (internal audiences only — host-facing CTA). */
  emptyCopy?: string;
  /** Guest-neutral empty copy. When absent, the section may still be hidden via
   * `hideWhenEmptyForGuest`. Never falls back to `emptyCopy` for guest. */
  emptyCopyGuest?: string;
  /** When true, empty sections are omitted entirely from guest-facing output. */
  hideWhenEmptyForGuest?: boolean;
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
