/**
 * Batch media loader for `composeGuide`. Resolves every entity's media in a
 * single indexed query so resolvers can read from an in-memory map instead
 * of hitting the DB per item.
 *
 * Every URL routes through `buildMediaProxyUrl`; presigned R2 URLs never
 * reach `GuideTree`. `guide-rendering-proxy-urls.test.ts` is the hard guard.
 *
 * Sensitive media is excluded at the query result — sensitive audiences
 * already get an empty tree downstream, but keeping the map honest avoids
 * accidental leakage if that downstream gate is ever refactored.
 */

import { prisma } from "@/lib/db";
import type { GuideAudience, GuideMedia } from "@/lib/types/guide-tree";
import { MEDIA_VARIANT_KEYS } from "@/lib/types/media-variant";
import { buildMediaProxyUrl } from "@/lib/services/media-proxy.service";
import { isVisibleForAudience } from "@/lib/taxonomy-loader";
import type { MediaEntityType } from "@/lib/schemas/editor.schema";

export interface EntityMediaRef {
  entityType: MediaEntityType;
  entityId: string;
  /** Used for derived alt text when `caption` is empty. */
  entityLabel: string;
}

export function mediaKey(
  entityType: MediaEntityType,
  entityId: string,
): string {
  return `${entityType}:${entityId}`;
}

function deriveAlt(
  caption: string | null,
  entityLabel: string,
  roleKey: string,
): string {
  if (caption && caption.trim().length > 0) return caption;
  const role = roleKey.replace(/[_-]+/g, " ").trim();
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
  // against @@index([entityType, entityId]).
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

  // Renderers emit media as <img>/markdown image syntax only. Videos would
  // produce a broken <img src="…mp4">, so filter them out at the query.
  // Extending GuideMedia + renderers to handle video is tracked for a later
  // rama; until then images are the only supported payload.
  const assignments = await prisma.mediaAssignment.findMany({
    where: {
      OR: orClauses,
      mediaAsset: { status: "ready", mimeType: { startsWith: "image/" } },
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
    const key = mediaKey(row.entityType as MediaEntityType, row.entityId);
    const entityLabel = labels.get(key) ?? "";
    // Normalise whitespace-only captions once so `alt` derivation and the
    // emitted `caption` stay in sync (renderers would otherwise emit an empty
    // <figcaption> while alt falls back to the role).
    const trimmedCaption = asset.caption?.trim() ?? "";
    const caption = trimmedCaption.length > 0 ? trimmedCaption : null;
    const role = row.usageKey ?? asset.assetRoleKey;
    const media: GuideMedia = {
      assetId: asset.id,
      variants: buildVariants(publicSlug, asset.id, asset.contentHash),
      mimeType: asset.mimeType,
      alt: deriveAlt(caption, entityLabel, role),
      role,
      caption: caption ?? undefined,
    };
    const bucket = out.get(key);
    if (bucket) bucket.push(media);
    else out.set(key, [media]);
  }

  return out;
}

export const __test__ = {
  deriveAlt,
  buildVariants,
};
