/**
 * Invariant: composeGuide MUST NEVER emit presigned R2 URLs in GuideTree.
 * All media URLs must be relative `/g/<slug>/media/...` proxy paths.
 *
 * Resolvers currently emit `media: []`; this test is forward-looking — it
 * walks whatever `GuideItem.media[]` produces and asserts the URL shape, so
 * future media-emitting resolvers can't accidentally leak presigned URLs
 * into cached HTML.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
    space: { findMany: vi.fn() },
    propertyAmenityInstance: { findMany: vi.fn() },
    contact: { findMany: vi.fn() },
    localPlace: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { composeGuide } from "@/lib/services/guide-rendering.service";
import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";
import { buildMediaProxyUrl } from "@/lib/services/media-proxy.service";

const fn = <K extends keyof typeof prisma>(k: K, m: "findUnique" | "findMany") =>
  (prisma[k] as unknown as Record<string, ReturnType<typeof vi.fn>>)[m];

function walkUrls(items: GuideItem[], acc: string[]): void {
  for (const it of items) {
    for (const m of it.media) acc.push(m.url);
    walkUrls(it.children, acc);
  }
}

function collectMediaUrls(tree: GuideTree): string[] {
  const urls: string[] = [];
  for (const s of tree.sections) walkUrls(s.items, urls);
  return urls;
}

beforeEach(() => {
  fn("property", "findUnique").mockReset();
  fn("space", "findMany").mockReset();
  fn("propertyAmenityInstance", "findMany").mockReset();
  fn("contact", "findMany").mockReset();
  fn("localPlace", "findMany").mockReset();
  fn("property", "findUnique").mockResolvedValue({
    id: "p1",
    checkInStart: null,
    checkInEnd: null,
    checkOutTime: null,
    primaryAccessMethod: null,
    accessMethodsJson: null,
    policiesJson: null,
  });
  fn("space", "findMany").mockResolvedValue([]);
  fn("propertyAmenityInstance", "findMany").mockResolvedValue([]);
  fn("contact", "findMany").mockResolvedValue([]);
  fn("localPlace", "findMany").mockResolvedValue([]);
});

describe("composeGuide — media URL invariants", () => {
  it("never emits r2.cloudflarestorage.com URLs", async () => {
    const tree = await composeGuide("p1", "internal", "mi-casa");
    const urls = collectMediaUrls(tree);
    for (const url of urls) {
      expect(url).not.toContain("r2.cloudflarestorage.com");
    }
  });

  it("never emits X-Amz-* query parameters (presigned URL markers)", async () => {
    const tree = await composeGuide("p1", "internal", "mi-casa");
    const urls = collectMediaUrls(tree);
    for (const url of urls) {
      expect(url).not.toMatch(/X-Amz-/i);
    }
  });

  it("all media URLs (if any) start with /g/<slug>/media/", async () => {
    const tree = await composeGuide("p1", "internal", "mi-casa");
    const urls = collectMediaUrls(tree);
    for (const url of urls) {
      expect(url).toMatch(/^\/g\/[^/]+\/media\//);
    }
  });

  it("composeGuide accepts null slug — callers without a published slug", async () => {
    // Internal previews and API callers for unpublished properties pass null.
    const tree = await composeGuide("p1", "internal", null);
    expect(tree.sections).toHaveLength(7);
  });
});

describe("buildMediaProxyUrl — integration shape", () => {
  it("produces /g/<slug>/media/<id>-<hashPrefix>/<variant>", () => {
    const url = buildMediaProxyUrl("mi-casa", "assetA", "abcdef1234", "md");
    expect(url).toBe("/g/mi-casa/media/assetA-abcdef12/md");
  });

  it("variant must be one of thumb/md/full", () => {
    for (const v of ["thumb", "md", "full"] as const) {
      expect(buildMediaProxyUrl("s", "a", "h", v)).toContain(`/${v}`);
    }
  });
});
