import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/services/media-storage.service";

/**
 * Plain (server-safe) slide shape for a space's cover carousel. Mapped to the
 * client `MediaCarouselSlide` in `space-card.tsx`. Spaces only carry images and
 * videos (no maps / live-maps like the access cockpit), so the union is small.
 */
export type SpaceMediaSlide =
  | { id: string; kind: "image"; url: string; alt: string; title: string }
  | { id: string; kind: "video"; alt: string; title: string };

export interface SpaceMedia {
  /** Ordered slides (images first, then videos) for the cover carousel. */
  slides: SpaceMediaSlide[];
  /** Image count (cover badge / page chip). */
  photoCount: number;
  /** Video count. */
  videoCount: number;
}

const EMPTY: SpaceMedia = { slides: [], photoCount: 0, videoCount: 0 };

/**
 * Batched media loader for the operator spaces grid — replaces the single-
 * thumbnail `loadSpaceCovers`. ONE `mediaAssignment.findMany` for all spaceIds
 * (no N+1) returning the full ordered slide set per space so each card cover is
 * a `<MediaCarousel>` (swipe + dots + inline upload + lightbox), mirroring the
 * access cockpit.
 *
 * Image URLs are signed via `getDownloadUrl` (presigned — internal dashboard
 * only, never baked into a cacheable public surface). A signing failure (e.g.
 * missing R2 env in dev) drops that slide rather than crashing the render;
 * `photoCount` still reflects the true asset count for the badge. Videos carry
 * no URL (the carousel renders a poster/placeholder).
 */
export async function loadSpaceMedia(
  spaceIds: string[],
): Promise<Map<string, SpaceMedia>> {
  const result = new Map<string, SpaceMedia>();
  if (spaceIds.length === 0) return result;

  const rows = await prisma.mediaAssignment.findMany({
    where: {
      entityType: "space",
      entityId: { in: spaceIds },
      mediaAsset: {
        status: "ready",
        OR: [
          { mimeType: { startsWith: "image/" } },
          { mimeType: { startsWith: "video/" } },
        ],
      },
    },
    select: {
      id: true,
      entityId: true,
      mediaAsset: {
        select: { id: true, storageKey: true, mimeType: true, caption: true },
      },
    },
    // DB order = display order. Images-before-videos is applied per group below.
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.entityId);
    if (list) list.push(row);
    else grouped.set(row.entityId, [row]);
  }

  await Promise.all(
    [...grouped.entries()].map(async ([spaceId, group]) => {
      const images = group.filter((r) => r.mediaAsset.mimeType.startsWith("image/"));
      const videos = group.filter((r) => r.mediaAsset.mimeType.startsWith("video/"));

      const imageSlides = (
        await Promise.all(
          images.map(async (r): Promise<SpaceMediaSlide | null> => {
            try {
              const url = await getDownloadUrl(r.mediaAsset.storageKey);
              return {
                id: r.id,
                kind: "image",
                url,
                alt: r.mediaAsset.caption ?? "",
                title: r.mediaAsset.caption ?? "",
              };
            } catch {
              // Drop unsigned slide; photoCount below still counts the asset.
              return null;
            }
          }),
        )
      ).filter((s): s is SpaceMediaSlide => s !== null);

      const videoSlides: SpaceMediaSlide[] = videos.map((r) => ({
        id: r.id,
        kind: "video",
        alt: r.mediaAsset.caption ?? "",
        title: r.mediaAsset.caption ?? "",
      }));

      result.set(spaceId, {
        slides: [...imageSlides, ...videoSlides],
        photoCount: images.length,
        videoCount: videos.length,
      });
    }),
  );

  return result;
}

/** Read a space's media (or an empty payload) from a loaded map. */
export function spaceMediaOf(
  map: Map<string, SpaceMedia>,
  spaceId: string,
): SpaceMedia {
  return map.get(spaceId) ?? EMPTY;
}
