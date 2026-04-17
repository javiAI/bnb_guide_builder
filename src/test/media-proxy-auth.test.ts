/**
 * Authorization matrix for resolvePublicAsset. Verifies every failure mode
 * returns `null` → caller emits 404 without leaking which condition failed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { mediaAsset: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}));

import { resolvePublicAsset } from "@/lib/services/media-proxy.service";

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset1",
    propertyId: "p1",
    storageKey: "p1/asset1/x.jpg",
    mimeType: "image/jpeg",
    contentHash: "hash123456",
    property: {
      publicSlug: "mi-casa",
      _count: { guideVersions: 1 },
    },
    ...overrides,
  };
}

beforeEach(() => mockFindUnique.mockReset());

describe("resolvePublicAsset", () => {
  it("resolves when slug + publicSlug + published version all match", async () => {
    mockFindUnique.mockResolvedValue(makeAsset());
    const result = await resolvePublicAsset("mi-casa", "asset1", "hash1234");
    expect(result).not.toBeNull();
    expect(result?.asset.id).toBe("asset1");
    expect(result?.hashMatch).toBe(true);
  });

  it("returns null when asset not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await resolvePublicAsset("mi-casa", "missing", "hash1234")).toBeNull();
  });

  it("returns null when property has no publicSlug", async () => {
    mockFindUnique.mockResolvedValue(
      makeAsset({ property: { publicSlug: null, _count: { guideVersions: 1 } } }),
    );
    expect(await resolvePublicAsset("mi-casa", "asset1", "hash1234")).toBeNull();
  });

  it("returns null when slug in URL ≠ property.publicSlug", async () => {
    mockFindUnique.mockResolvedValue(makeAsset());
    expect(await resolvePublicAsset("otra-casa", "asset1", "hash1234")).toBeNull();
  });

  it("returns null when property has zero published GuideVersions", async () => {
    mockFindUnique.mockResolvedValue(
      makeAsset({ property: { publicSlug: "mi-casa", _count: { guideVersions: 0 } } }),
    );
    expect(await resolvePublicAsset("mi-casa", "asset1", "hash1234")).toBeNull();
  });

  it("returns null when hashPrefix doesn't match contentHash", async () => {
    mockFindUnique.mockResolvedValue(makeAsset());
    expect(await resolvePublicAsset("mi-casa", "asset1", "deadbeef")).toBeNull();
  });

  it("tolerates any hashPrefix when contentHash is null (pre-backfill)", async () => {
    mockFindUnique.mockResolvedValue(makeAsset({ contentHash: null }));
    const result = await resolvePublicAsset("mi-casa", "asset1", "anything");
    expect(result).not.toBeNull();
    expect(result?.hashMatch).toBeNull();
  });

  it("queries with a filter for status=published via _count on guideVersions", async () => {
    mockFindUnique.mockResolvedValue(makeAsset());
    await resolvePublicAsset("mi-casa", "asset1", "hash1234");
    const call = mockFindUnique.mock.calls[0][0];
    const gv = call.include.property.select._count.select.guideVersions;
    expect(gv.where.status).toBe("published");
  });
});
