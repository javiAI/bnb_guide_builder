/**
 * Batch media loader for `composeGuide`. One query per compose, regardless
 * of how many entities the guide references — resolvers look up a map
 * keyed by `{entityType}:{entityId}` instead of hitting the DB per item.
 *
 * Every URL emitted flows through `buildMediaProxyUrl` (10D), never an R2
 * presigned URL. `src/test/guide-rendering-proxy-urls.test.ts` is the hard
 * guard; this service is the only code path that composes `GuideMedia`.
 *
 * Audience filter: `MediaAsset.visibility` must be compatible with the
 * requested audience. `sensitive` media never enters the tree (sensitive
 * audience returns an empty tree at `filterByAudience`, so even if this
 * loader returned sensitive entries they'd be dropped downstream — we still
 * exclude them here to avoid wasted work and to keep the map honest).
 */

import { prisma } from "@/lib/db";
import type { GuideAudience, GuideMedia } from "@/lib/types/guide-tree";
import { MEDIA_VARIANT_KEYS } from "@/lib/types/media-variant";
import { buildMediaProxyUrl } from "@/lib/services/media-proxy.service";
import { isVisibleForAudience } from "@/lib/taxonomy-loader";

export type MediaEntityType =
  | "property"
  | "space"
  | "access_method"
  | "amenity_instance";

export interface EntityMediaRef {
  entityType: MediaEntityType;
  entityId: string;
  /** Used for derived alt text when `caption` is empty. */
  entityLabel: string;
}

function mediaKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function deriveAlt(
  caption: string | null,
  entityLabel: string,
  assetRoleKey: string,
): string {
  if (caption && caption.trim().length > 0) return caption;
  const role = assetRoleKey.replace(/[_-]+/g, " ").trim();
  return role ? `${role} — ${entityLabel}` : entityLabel;
}

function buildVariants(
  slug: string,
  assetId: string,
  contentHash: string | null,
): GuideMedia["variants"] {
  const out = {} as GuideMedia["variants"];
  for (const v of MEDIA_VARIANT_KEYS) {
    out[v] = buildMediaProxyUrl(slug, assetId, contentHash, v);
  }
  return out;
}

/**
 * Loads all media assignments for the given entity refs in a single query,
 * returns a map keyed by `entityType:entityId` so resolvers can look up
 * `GuideMedia[]` without hitting the DB again.
 *
 * Returns an empty map when `publicSlug` is null — without a slug we can't
 * build proxy URLs, and the composed tree never emits media for preview /
 * internal-only flows.
 */
export async function loadEntityMedia(
  publicSlug: string | null,
  audience: GuideAudience,
  refs: ReadonlyArray<EntityMediaRef>,
): Promise<Map<string, GuideMedia[]>> {
  const out = new Map<string, GuideMedia[]>();
  if (!publicSlug || refs.length === 0 || audience === "sensitive") return out;

  // Group entityIds per entityType so the WHERE clause stays indexable
  // (MediaAssignment has @@index([entityType, entityId])).
  const byType = new Map<MediaEntityType, Set<string>>();
  const labels = new Map<string, string>();
  for (const ref of refs) {
    let set = byType.get(ref.entityType);
    if (!set) {
      set = new Set();
      byType.set(ref.entityType, set);
    }
    set.add(ref.entityId);
    labels.set(mediaKey(ref.entityType, ref.entityId), ref.entityLabel);
  }

  const orClauses = Array.from(byType.entries()).map(([entityType, ids]) => ({
    entityType,
    entityId: { in: Array.from(ids) },
  }));

  const assignments = await prisma.mediaAssignment.findMany({
    where: {
      OR: orClauses,
      mediaAsset: { status: "ready" },
    },
    orderBy: [
      // Cover first, then sortOrder. Prisma translates null → "last" for asc;
      // "cover" sorts before null alphabetically, so ascending order naturally
      // places cover assignments ahead of uncategorised ones.
      { usageKey: "asc" },
      { sortOrder: "asc" },
    ],
    select: {
      entityType: true,
      entityId: true,
      usageKey: true,
      mediaAsset: {
        select: {
          id: true,
          assetRoleKey: true,
          mimeType: true,
          caption: true,
          visibility: true,
          contentHash: true,
        },
      },
    },
  });

  for (const row of assignments) {
    const asset = row.mediaAsset;
    if (!isVisibleForAudience(asset.visibility, audience)) continue;
    const key = mediaKey(row.entityType, row.entityId);
    const entityLabel = labels.get(key) ?? "";
    const caption = asset.caption;
    const media: GuideMedia = {
      assetId: asset.id,
      variants: buildVariants(publicSlug, asset.id, asset.contentHash),
      mimeType: asset.mimeType,
      alt: deriveAlt(caption, entityLabel, asset.assetRoleKey),
      role: row.usageKey ?? asset.assetRoleKey,
      caption: caption ?? undefined,
    };
    const bucket = out.get(key);
    if (bucket) bucket.push(media);
    else out.set(key, [media]);
  }

  return out;
}

export const __test__ = {
  mediaKey,
  deriveAlt,
  buildVariants,
};
