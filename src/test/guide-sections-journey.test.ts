/**
 * Journey-first section structure (Rama 10E).
 *
 * The 10E restructure introduced:
 *   - `gs.essentials` as a hero aggregator that clones items tagged
 *     `journeyTags: ["essential"]` from other leaf sections.
 *   - `gs.howto` (stay stage) and `gs.checkout` (checkout stage) leaves.
 *   - `gs.emergency` fuses the old `gs.contacts` into the help block.
 *
 * These tests guard the invariants that the React renderer, TOC filter, and
 * snapshot diff depend on.
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
import { getGuideSectionConfigs } from "@/lib/taxonomy-loader";

const fn = <K extends keyof typeof prisma>(
  table: K,
  method: "findUnique" | "findMany",
) =>
  (prisma[table] as unknown as Record<string, ReturnType<typeof vi.fn>>)[method];

beforeEach(() => {
  fn("property", "findUnique").mockReset();
  fn("space", "findMany").mockReset();
  fn("propertyAmenityInstance", "findMany").mockReset();
  fn("contact", "findMany").mockReset();
  fn("localPlace", "findMany").mockReset();
  fn("property", "findUnique").mockResolvedValue({
    id: "p1",
    checkInStart: "15:00",
    checkInEnd: "20:00",
    checkOutTime: "11:00",
    primaryAccessMethod: null,
    accessMethodsJson: null,
    policiesJson: null,
  });
  fn("space", "findMany").mockResolvedValue([]);
  fn("propertyAmenityInstance", "findMany").mockResolvedValue([]);
  fn("contact", "findMany").mockResolvedValue([]);
  fn("localPlace", "findMany").mockResolvedValue([]);
});

describe("guide_sections — taxonomy structure invariants", () => {
  it("declares 9 sections in the expected journey order", () => {
    const ids = [...getGuideSectionConfigs()]
      .sort((a, b) => a.order - b.order)
      .map((s) => s.id);
    expect(ids).toEqual([
      "gs.essentials",
      "gs.arrival",
      "gs.spaces",
      "gs.howto",
      "gs.amenities",
      "gs.rules",
      "gs.checkout",
      "gs.local",
      "gs.emergency",
    ]);
  });

  it("gs.essentials is the only aggregator and declares sourceResolverKeys", () => {
    const aggregators = getGuideSectionConfigs().filter((s) => s.isAggregator);
    expect(aggregators).toHaveLength(1);
    expect(aggregators[0].id).toBe("gs.essentials");
    expect(aggregators[0].sourceResolverKeys?.length ?? 0).toBeGreaterThan(0);
  });

  it("gs.essentials is the only hero section (there can be only one)", () => {
    const heroes = getGuideSectionConfigs().filter((s) => s.isHero);
    expect(heroes).toHaveLength(1);
    expect(heroes[0].id).toBe("gs.essentials");
  });

  it("every section declares emptyCopy in Spanish (UX writing gate)", () => {
    for (const s of getGuideSectionConfigs()) {
      expect(s.emptyCopy, `${s.id}: emptyCopy missing`).toBeTruthy();
      expect(s.emptyCopy!.length, `${s.id}: emptyCopy too short`).toBeGreaterThan(10);
    }
  });

  it("aggregators never declare an emptyCtaDeepLink (CTAs live on the leaves)", () => {
    for (const s of getGuideSectionConfigs()) {
      if (!s.isAggregator) continue;
      expect(s.emptyCtaDeepLink, `${s.id}: aggregator must not carry a CTA`).toBeNull();
    }
  });
});

describe("composeGuide — gs.essentials aggregator semantics", () => {
  it("clones essential-tagged items from source sections (arrival check-in is essential)", async () => {
    const tree = await composeGuide("p1", "internal", null);
    const essentials = tree.sections.find((s) => s.id === "gs.essentials")!;
    const arrival = tree.sections.find((s) => s.id === "gs.arrival")!;
    // Original remains in its source section…
    expect(arrival.items.map((i) => i.id)).toContain("arrival.checkin");
    // …and a clone (with synthetic id prefix) shows in essentials.
    expect(essentials.items.some((i) => i.id.startsWith("essentials.arrival."))).toBe(true);
  });

  it("clones do not emit duplicate DOM ids (synthetic prefix)", async () => {
    const tree = await composeGuide("p1", "internal", null);
    const allIds = tree.sections.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(allIds).size, "item ids must be unique across sections").toBe(allIds.length);
  });

  it("aggregator only lifts items tagged `essential` — non-essential items stay in their leaf", async () => {
    // Add a local place (no essential tag on its taxonomy) to verify it's not cloned.
    fn("localPlace", "findMany").mockResolvedValue([
      {
        id: "lp1",
        categoryKey: "lp.cafe",
        name: "Café",
        guestDescription: null,
        aiNotes: null,
        distanceMeters: 100,
        hoursText: null,
        visibility: "guest",
      },
    ]);
    const tree = await composeGuide("p1", "internal", null);
    const essentials = tree.sections.find((s) => s.id === "gs.essentials")!;
    expect(essentials.items.some((i) => i.id.includes("lp1"))).toBe(false);
  });
});

describe("composeGuide — checkout leaf (Rama 10E)", () => {
  it("gs.checkout renders checkOutTime as its own item (no longer living in gs.arrival)", async () => {
    const tree = await composeGuide("p1", "guest", null);
    const arrival = tree.sections.find((s) => s.id === "gs.arrival")!;
    const checkout = tree.sections.find((s) => s.id === "gs.checkout")!;
    expect(arrival.items.map((i) => i.id)).not.toContain("arrival.checkout");
    expect(checkout.items.map((i) => i.id)).toContain("checkout.time");
  });
});

describe("composeGuide — brand + schema metadata", () => {
  it("emits schemaVersion on freshly composed trees (consumers can fall back on absence)", async () => {
    const tree = await composeGuide("p1", "guest", null);
    expect(tree.schemaVersion).toBeGreaterThanOrEqual(2);
  });

  it("reads brandPaletteKey / brandLogoUrl from property into the tree header", async () => {
    fn("property", "findUnique").mockResolvedValue({
      id: "p1",
      checkInStart: null,
      checkInEnd: null,
      checkOutTime: null,
      primaryAccessMethod: null,
      accessMethodsJson: null,
      policiesJson: null,
      brandPaletteKey: "teal",
      brandLogoUrl: "/g/mi-casa/media/logo-abc12345/md",
    });
    // null slug keeps the media loader out of the path — we're asserting
    // metadata pass-through, not URL rewriting.
    const tree = await composeGuide("p1", "guest", null);
    expect(tree.brandPaletteKey).toBe("teal");
    expect(tree.brandLogoUrl).toBe("/g/mi-casa/media/logo-abc12345/md");
  });

  it("brandPaletteKey/brandLogoUrl default to null when property leaves them unset", async () => {
    const tree = await composeGuide("p1", "guest", null);
    expect(tree.brandPaletteKey).toBeNull();
    expect(tree.brandLogoUrl).toBeNull();
  });
});
