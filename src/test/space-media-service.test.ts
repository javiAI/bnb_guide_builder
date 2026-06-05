/**
 * Contract test for the operator spaces media loader (`loadSpaceMedia`).
 * Pins the behavior the spaces grid relies on so future changes can't silently
 * regress it:
 *   - ONE batched `mediaAssignment.findMany` for all spaceIds (no N+1),
 *   - scoped to ready images OR videos,
 *   - per space: ordered slides (images first, then videos), photo/video counts,
 *   - image URLs signed; a signing failure drops that slide, count preserved.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { mediaAssignment: { findMany: vi.fn() } },
}));
vi.mock("@/lib/services/media-storage.service", () => ({
  getDownloadUrl: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/services/media-storage.service";
import { loadSpaceMedia } from "@/lib/services/space-media.service";

const findMany = prisma.mediaAssignment.findMany as unknown as ReturnType<typeof vi.fn>;
const getUrl = getDownloadUrl as unknown as ReturnType<typeof vi.fn>;

function img(id: string, entityId: string, storageKey: string, caption: string | null = null) {
  return { id, entityId, mediaAsset: { id: `a-${id}`, storageKey, mimeType: "image/jpeg", caption } };
}
function vid(id: string, entityId: string, storageKey: string) {
  return { id, entityId, mediaAsset: { id: `a-${id}`, storageKey, mimeType: "video/mp4", caption: null } };
}

beforeEach(() => {
  findMany.mockReset();
  getUrl.mockReset();
  getUrl.mockImplementation(async (key: string) => `signed:${key}`);
});

describe("loadSpaceMedia", () => {
  it("returns an empty map and issues no query for empty spaceIds", async () => {
    const res = await loadSpaceMedia([]);
    expect(res.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("loads every space in a single query scoped to ready image/video (no N+1)", async () => {
    findMany.mockResolvedValue([]);
    await loadSpaceMedia(["s1", "s2", "s3"]);
    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      entityType: "space",
      entityId: { in: ["s1", "s2", "s3"] },
      mediaAsset: { status: "ready" },
    });
    expect(where.mediaAsset.OR).toEqual([
      { mimeType: { startsWith: "image/" } },
      { mimeType: { startsWith: "video/" } },
    ]);
  });

  it("builds ordered slides (images first, then videos) with signed image urls + counts", async () => {
    findMany.mockResolvedValue([
      img("s1i1", "s1", "k1a", "Vista"),
      img("s1i2", "s1", "k1b"),
      vid("s1v1", "s1", "k1v"),
      img("s2i1", "s2", "k2a"),
    ]);
    const res = await loadSpaceMedia(["s1", "s2"]);

    const s1 = res.get("s1")!;
    expect(s1.photoCount).toBe(2);
    expect(s1.videoCount).toBe(1);
    expect(s1.slides).toEqual([
      { id: "s1i1", kind: "image", url: "signed:k1a", alt: "Vista", title: "Vista" },
      { id: "s1i2", kind: "image", url: "signed:k1b", alt: "", title: "" },
      { id: "s1v1", kind: "video", alt: "", title: "" },
    ]);

    const s2 = res.get("s2")!;
    expect(s2.photoCount).toBe(1);
    expect(s2.slides[0]).toMatchObject({ id: "s2i1", kind: "image", url: "signed:k2a" });

    // Only image keys are signed (videos carry no URL).
    expect(getUrl).toHaveBeenCalledTimes(3);
  });

  it("drops a slide when signing fails but preserves photoCount", async () => {
    findMany.mockResolvedValue([img("s1i1", "s1", "k1a"), img("s1i2", "s1", "k1b")]);
    getUrl.mockImplementation(async (key: string) => {
      if (key === "k1a") throw new Error("missing R2 env");
      return `signed:${key}`;
    });
    const res = await loadSpaceMedia(["s1"]);
    const s1 = res.get("s1")!;
    expect(s1.photoCount).toBe(2);
    expect(s1.slides).toEqual([{ id: "s1i2", kind: "image", url: "signed:k1b", alt: "", title: "" }]);
  });

  it("omits spaces that have no ready media", async () => {
    findMany.mockResolvedValue([img("s1i1", "s1", "k1")]);
    const res = await loadSpaceMedia(["s1", "s2"]);
    expect(res.has("s2")).toBe(false);
    expect(res.get("s1")?.photoCount).toBe(1);
  });
});
