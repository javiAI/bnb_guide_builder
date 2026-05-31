/**
 * Contract test for the operator spaces cover loader (`loadSpaceCovers`).
 * Pins the behavior the spaces grid relies on so future changes can't silently
 * regress it:
 *   - ONE batched `mediaAssignment.findMany` for all spaceIds (no N+1),
 *   - scoped to ready images (`status: "ready"` + `mimeType startsWith image/`),
 *   - first row per space (DB order) becomes the cover; the rest tally count,
 *   - a signing failure degrades that space to a null cover, count preserved.
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
import { loadSpaceCovers } from "@/lib/services/space-cover.service";

const findMany = prisma.mediaAssignment.findMany as unknown as ReturnType<typeof vi.fn>;
const getUrl = getDownloadUrl as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  findMany.mockReset();
  getUrl.mockReset();
  getUrl.mockImplementation(async (key: string) => `signed:${key}`);
});

describe("loadSpaceCovers", () => {
  it("returns an empty map and issues no query for empty spaceIds", async () => {
    const res = await loadSpaceCovers([]);
    expect(res.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("loads every space in a single query scoped to ready images (no N+1)", async () => {
    findMany.mockResolvedValue([]);
    await loadSpaceCovers(["s1", "s2", "s3"]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      entityType: "space",
      entityId: { in: ["s1", "s2", "s3"] },
      mediaAsset: { status: "ready", mimeType: { startsWith: "image/" } },
    });
  });

  it("uses the first row per space as the cover and counts the rest", async () => {
    findMany.mockResolvedValue([
      { entityId: "s1", mediaAsset: { storageKey: "k1a" } },
      { entityId: "s1", mediaAsset: { storageKey: "k1b" } },
      { entityId: "s1", mediaAsset: { storageKey: "k1c" } },
      { entityId: "s2", mediaAsset: { storageKey: "k2a" } },
    ]);
    const res = await loadSpaceCovers(["s1", "s2"]);
    expect(res.get("s1")).toEqual({ coverUrl: "signed:k1a", photoCount: 3 });
    expect(res.get("s2")).toEqual({ coverUrl: "signed:k2a", photoCount: 1 });
    // Only the cover (first) key per space is signed — not every photo.
    expect(getUrl).toHaveBeenCalledTimes(2);
    expect(getUrl).toHaveBeenCalledWith("k1a");
    expect(getUrl).toHaveBeenCalledWith("k2a");
  });

  it("degrades to a null cover when signing fails, preserving the count", async () => {
    findMany.mockResolvedValue([
      { entityId: "s1", mediaAsset: { storageKey: "k1a" } },
      { entityId: "s1", mediaAsset: { storageKey: "k1b" } },
    ]);
    getUrl.mockRejectedValueOnce(new Error("missing R2 env"));
    const res = await loadSpaceCovers(["s1"]);
    expect(res.get("s1")).toEqual({ coverUrl: null, photoCount: 2 });
  });

  it("omits spaces that have no ready images", async () => {
    findMany.mockResolvedValue([{ entityId: "s1", mediaAsset: { storageKey: "k1" } }]);
    const res = await loadSpaceCovers(["s1", "s2"]);
    expect(res.has("s2")).toBe(false);
    expect(res.get("s1")?.photoCount).toBe(1);
  });
});
