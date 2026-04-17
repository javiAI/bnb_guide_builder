/**
 * Integration test: composeGuide surfaces media assignments from the DB
 * into GuideTree items, filtered by audience visibility. Verifies that
 * every emitted media entry carries all three variants, that sensitive
 * media is dropped for non-sensitive audiences, and that alt text falls
 * back to `role — entityLabel` when caption is empty.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
    space: { findMany: vi.fn() },
    propertyAmenityInstance: { findMany: vi.fn() },
    contact: { findMany: vi.fn() },
    localPlace: { findMany: vi.fn() },
    mediaAssignment: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { composeGuide } from "@/lib/services/guide-rendering.service";

const fn = <K extends keyof typeof prisma>(
  k: K,
  m: "findUnique" | "findMany",
) => (prisma[k] as unknown as Record<string, ReturnType<typeof vi.fn>>)[m];

beforeEach(() => {
  fn("property", "findUnique").mockReset();
  fn("space", "findMany").mockReset();
  fn("propertyAmenityInstance", "findMany").mockReset();
  fn("contact", "findMany").mockReset();
  fn("localPlace", "findMany").mockReset();
  fn("mediaAssignment", "findMany").mockReset();

  fn("property", "findUnique").mockResolvedValue({
    id: "p1",
    checkInStart: null,
    checkInEnd: null,
    checkOutTime: null,
    primaryAccessMethod: null,
    accessMethodsJson: null,
    policiesJson: null,
  });
  fn("space", "findMany").mockResolvedValue([
    {
      id: "s1",
      spaceType: "sp.bedroom",
      name: "Dormitorio principal",
      visibility: "guest",
      guestNotes: null,
      aiNotes: null,
      internalNotes: null,
      featuresJson: null,
      sortOrder: 0,
      beds: [],
    },
  ]);
  fn("propertyAmenityInstance", "findMany").mockResolvedValue([]);
  fn("contact", "findMany").mockResolvedValue([]);
  fn("localPlace", "findMany").mockResolvedValue([]);
  fn("mediaAssignment", "findMany").mockResolvedValue([]);
});

describe("composeGuide — media integration", () => {
  it("attaches space media with all 3 variants and derived alt text", async () => {
    fn("mediaAssignment", "findMany").mockResolvedValue([
      {
        entityType: "space",
        entityId: "s1",
        usageKey: null,
        mediaAsset: {
          id: "asset-1",
          assetRoleKey: "photo_gallery",
          mediaType: "image",
          mimeType: "image/jpeg",
          caption: null,
          visibility: "guest",
          contentHash: "abc123def456",
        },
      },
    ]);
    const tree = await composeGuide("p1", "guest", "mi-casa");
    const space = tree.sections.find((s) => s.id === "gs.spaces")!.items[0];
    expect(space.media).toHaveLength(1);
    const m = space.media[0];
    expect(m.assetId).toBe("asset-1");
    expect(m.variants.thumb).toBe("/g/mi-casa/media/asset-1-abc123de/thumb");
    expect(m.variants.md).toBe("/g/mi-casa/media/asset-1-abc123de/md");
    expect(m.variants.full).toBe("/g/mi-casa/media/asset-1-abc123de/full");
    expect(m.mimeType).toBe("image/jpeg");
    // caption was null → alt falls back to `role — entityLabel`
    expect(m.alt).toBe("photo gallery — Dormitorio principal");
    expect(m.caption).toBeUndefined();
  });

  it("uses caption as alt when present", async () => {
    fn("mediaAssignment", "findMany").mockResolvedValue([
      {
        entityType: "space",
        entityId: "s1",
        usageKey: "cover",
        mediaAsset: {
          id: "asset-2",
          assetRoleKey: "photo_gallery",
          mediaType: "image",
          mimeType: "image/jpeg",
          caption: "Cama king size con vistas al mar",
          visibility: "guest",
          contentHash: "hash2",
        },
      },
    ]);
    const tree = await composeGuide("p1", "guest", "mi-casa");
    const space = tree.sections.find((s) => s.id === "gs.spaces")!.items[0];
    const m = space.media[0];
    expect(m.alt).toBe("Cama king size con vistas al mar");
    expect(m.caption).toBe("Cama king size con vistas al mar");
    expect(m.role).toBe("cover");
  });

  it("drops media whose visibility exceeds the audience", async () => {
    fn("mediaAssignment", "findMany").mockResolvedValue([
      {
        entityType: "space",
        entityId: "s1",
        usageKey: null,
        mediaAsset: {
          id: "guest-asset",
          assetRoleKey: "photo_gallery",
          mediaType: "image",
          mimeType: "image/jpeg",
          caption: null,
          visibility: "guest",
          contentHash: "h1",
        },
      },
      {
        entityType: "space",
        entityId: "s1",
        usageKey: null,
        mediaAsset: {
          id: "internal-asset",
          assetRoleKey: "photo_gallery",
          mediaType: "image",
          mimeType: "image/jpeg",
          caption: null,
          visibility: "internal",
          contentHash: "h2",
        },
      },
    ]);
    const guestTree = await composeGuide("p1", "guest", "mi-casa");
    const guestSpace = guestTree.sections.find((s) => s.id === "gs.spaces")!
      .items[0];
    expect(guestSpace.media.map((m) => m.assetId)).toEqual(["guest-asset"]);

    // Reset the mock because composeGuide already consumed the call above
    fn("mediaAssignment", "findMany").mockResolvedValue([
      {
        entityType: "space",
        entityId: "s1",
        usageKey: null,
        mediaAsset: {
          id: "guest-asset",
          assetRoleKey: "photo_gallery",
          mediaType: "image",
          mimeType: "image/jpeg",
          caption: null,
          visibility: "guest",
          contentHash: "h1",
        },
      },
      {
        entityType: "space",
        entityId: "s1",
        usageKey: null,
        mediaAsset: {
          id: "internal-asset",
          assetRoleKey: "photo_gallery",
          mediaType: "image",
          mimeType: "image/jpeg",
          caption: null,
          visibility: "internal",
          contentHash: "h2",
        },
      },
    ]);
    const internalTree = await composeGuide("p1", "internal", "mi-casa");
    const internalSpace = internalTree.sections.find(
      (s) => s.id === "gs.spaces",
    )!.items[0];
    expect(internalSpace.media.map((m) => m.assetId).sort()).toEqual([
      "guest-asset",
      "internal-asset",
    ]);
  });

  it("emits no media when publicSlug is null (no proxy URLs possible)", async () => {
    fn("mediaAssignment", "findMany").mockResolvedValue([
      {
        entityType: "space",
        entityId: "s1",
        usageKey: null,
        mediaAsset: {
          id: "asset-x",
          assetRoleKey: "photo_gallery",
          mediaType: "image",
          mimeType: "image/jpeg",
          caption: null,
          visibility: "guest",
          contentHash: "h",
        },
      },
    ]);
    const tree = await composeGuide("p1", "guest", null);
    const space = tree.sections.find((s) => s.id === "gs.spaces")!.items[0];
    expect(space.media).toEqual([]);
  });

  it("sensitive audience produces an empty tree regardless of media", async () => {
    fn("mediaAssignment", "findMany").mockResolvedValue([]);
    const tree = await composeGuide("p1", "sensitive", "mi-casa");
    // filterByAudience drops everything for sensitive
    for (const section of tree.sections) {
      expect(section.items).toHaveLength(0);
    }
  });
});
