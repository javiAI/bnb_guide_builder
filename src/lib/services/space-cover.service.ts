import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/services/media-storage.service";

export interface SpaceCover {
  /** Signed URL of the first image assigned to the space, or null. */
  coverUrl: string | null;
  /** Total number of images assigned to the space. */
  photoCount: number;
}

/**
 * Batched cover loader for the operator spaces grid.
 *
 * ONE `mediaAssignment.findMany` for all spaceIds (no N+1). For each space we
 * keep the first image (DB order: sortOrder asc, createdAt asc) as the cover
 * and count the rest for the photo badge / page chip. The first cover URL is
 * signed via `getDownloadUrl` (presigned, internal dashboard only — never baked
 * into a cacheable public surface). A signing failure (e.g. missing R2 env in
 * dev) degrades that space to `coverUrl: null` so the card falls back to the
 * gradient placeholder instead of crashing the page.
 */
export async function loadSpaceCovers(
  spaceIds: string[],
): Promise<Map<string, SpaceCover>> {
  const result = new Map<string, SpaceCover>();
  if (spaceIds.length === 0) return result;

  const rows = await prisma.mediaAssignment.findMany({
    where: {
      entityType: "space",
      entityId: { in: spaceIds },
      mediaAsset: { status: "ready", mimeType: { startsWith: "image/" } },
    },
    select: {
      entityId: true,
      mediaAsset: { select: { storageKey: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // One pass: DB order (sortOrder asc, createdAt asc) puts the cover first per
  // space, so the first row seen is the cover key; later rows just bump count.
  const grouped = new Map<string, { storageKey: string; photoCount: number }>();
  for (const row of rows) {
    const entry = grouped.get(row.entityId);
    if (entry) {
      entry.photoCount += 1;
    } else {
      grouped.set(row.entityId, { storageKey: row.mediaAsset.storageKey, photoCount: 1 });
    }
  }

  // Sign cover URLs in parallel (bounded by spaceIds.length) and write each
  // result once. A signing failure (e.g. missing R2 env in dev) degrades that
  // space to a null cover → the card falls back to the gradient placeholder.
  await Promise.all(
    [...grouped.entries()].map(async ([spaceId, { storageKey, photoCount }]) => {
      let coverUrl: string | null = null;
      try {
        coverUrl = await getDownloadUrl(storageKey);
      } catch {
        // Leave coverUrl null → card renders the placeholder.
      }
      result.set(spaceId, { coverUrl, photoCount });
    }),
  );

  return result;
}
