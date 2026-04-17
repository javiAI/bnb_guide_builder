/**
 * Public media proxy resolution. Builds and validates
 * `/g/:slug/media/:assetIdHash/:variant` URLs so the public guide can cite
 * stable paths without embedding R2 presigned URLs (which expire in 1h and
 * would break CDN-cached HTML).
 *
 * Authorization: an asset is public iff its property has `publicSlug != null`,
 * the slug in the URL matches that publicSlug, and the property has at least
 * one `GuideVersion.status = "published"`. Every other failure path returns
 * `null` so the caller can emit a 404 without leaking which check failed.
 */

import type { MediaAsset } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  HASH_PREFIX_LENGTH,
  type MediaVariantKey,
} from "@/lib/types/media-variant";

const CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_CONTROL_TRANSITIONAL = "public, max-age=3600, must-revalidate";

// ── URL shape ──────────────────────────────────────────

/**
 * Stable hash prefix for a given asset. Falls back to the assetId prefix
 * when `contentHash` has not been backfilled yet (transitional — the route
 * handler tolerates this by relaxing ETag strength).
 */
export function assetHashPrefix(
  assetId: string,
  contentHash: string | null,
): string {
  const source = contentHash ?? assetId;
  return source.slice(0, HASH_PREFIX_LENGTH);
}

/**
 * Parses the `:assetIdHash` segment as produced by `buildMediaProxyUrl`.
 * Cuid-generated assetIds contain no hyphens, so the last hyphen splits
 * id from hash unambiguously. Returns `null` on malformed input.
 */
export function parseAssetIdHash(
  segment: string,
): { assetId: string; hashPrefix: string } | null {
  const idx = segment.lastIndexOf("-");
  if (idx <= 0 || idx >= segment.length - 1) return null;
  const assetId = segment.slice(0, idx);
  const hashPrefix = segment.slice(idx + 1);
  if (!/^[a-zA-Z0-9]+$/.test(assetId) || !/^[a-zA-Z0-9]+$/.test(hashPrefix)) {
    return null;
  }
  return { assetId, hashPrefix };
}

/**
 * Public URL for a media asset. Always relative (`/g/...`) so HTML cached by
 * ISR/CDN never embeds absolute R2/presigned URLs.
 */
export function buildMediaProxyUrl(
  slug: string,
  assetId: string,
  contentHash: string | null,
  variant: MediaVariantKey,
): string {
  const hashPrefix = assetHashPrefix(assetId, contentHash);
  return `/g/${slug}/media/${assetId}-${hashPrefix}/${variant}`;
}

// ── Authorization + resolution ─────────────────────────

export interface ResolvedPublicAsset {
  asset: MediaAsset;
  /**
   * True when the URL's hashPrefix matches `contentHash`. When the asset has
   * no contentHash yet (pre-backfill) this is `null` — the route handler
   * must emit weak ETag + shorter cache in that case.
   */
  hashMatch: boolean | null;
}

/**
 * Loads an asset and validates it is publishable under `slug`. Returns `null`
 * for every failure mode — callers translate that to a 404 without leaking
 * which condition failed.
 */
export async function resolvePublicAsset(
  slug: string,
  assetId: string,
  hashPrefix: string,
): Promise<ResolvedPublicAsset | null> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    include: {
      property: {
        select: {
          publicSlug: true,
          _count: {
            select: {
              guideVersions: { where: { status: "published" } },
            },
          },
        },
      },
    },
  });

  if (!asset) return null;
  if (!asset.property.publicSlug) return null;
  if (asset.property.publicSlug !== slug) return null;
  if (asset.property._count.guideVersions === 0) return null;

  const expected = assetHashPrefix(asset.id, asset.contentHash);
  const hashMatch = asset.contentHash == null ? null : hashPrefix === expected;
  if (hashMatch === false) return null;

  // Drop the auth-scoped relation so callers get a plain MediaAsset back.
  const { property, ...plain } = asset;
  void property;
  return { asset: plain as MediaAsset, hashMatch };
}

// ── Cache headers ──────────────────────────────────────

/**
 * Cache policy:
 *   - contentHash present → immutable, 1 year, strong ETag.
 *   - contentHash missing → 1h + must-revalidate, no ETag (transitional,
 *     until `scripts/backfill-media-content-hash.ts` runs).
 *
 * The ETag scopes the hash to the variant because bytes differ across
 * variants once real transformation lands — without this, a CDN that
 * cached `full` would serve stale bytes for `thumb`.
 */
export function buildCacheHeaders(
  contentHash: string | null,
  variant: MediaVariantKey,
  mimeType: string,
  contentLength: number | null,
): Headers {
  const h = new Headers();
  h.set("Content-Type", mimeType);
  if (contentLength !== null && contentLength >= 0) {
    h.set("Content-Length", String(contentLength));
  }
  if (contentHash) {
    h.set("Cache-Control", CACHE_CONTROL_IMMUTABLE);
    h.set("ETag", `"${contentHash}-${variant}"`);
  } else {
    h.set("Cache-Control", CACHE_CONTROL_TRANSITIONAL);
  }
  return h;
}
