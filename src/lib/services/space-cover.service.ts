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
      mediaAsset: { mimeType: { startsWith: "image/" } },
    },
    select: {
      entityId: true,
      mediaAsset: { select: { storageKey: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // Group: first row per space is the cover; tally the count.
  const firstKeyBySpace = new Map<string, string>();
  for (const row of rows) {
    const prev = result.get(row.entityId);
    if (!prev) {
      result.set(row.entityId, { coverUrl: null, photoCount: 1 });
      firstKeyBySpace.set(row.entityId, row.mediaAsset.storageKey);
    } else {
      prev.photoCount += 1;
    }
  }

  // Sign the cover URLs in parallel (bounded by spaceIds.length).
  await Promise.all(
    [...firstKeyBySpace.entries()].map(async ([spaceId, storageKey]) => {
      try {
        const url = await getDownloadUrl(storageKey);
        const entry = result.get(spaceId);
        if (entry) entry.coverUrl = url;
      } catch {
        // Leave coverUrl null → card renders the placeholder.
      }
    }),
  );

  return result;
}
