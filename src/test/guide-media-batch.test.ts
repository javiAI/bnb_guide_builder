/**
 * Performance invariant: `composeGuide` MUST load media for all entities
 * in a single `mediaAssignment.findMany` call — no N+1 per space / amenity.
 * The test asserts that, given N spaces + M amenities + 1 property cover,
 * the loader is still called exactly once.
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

  fn("mediaAssignment", "findMany").mockResolvedValue([]);
});

describe("composeGuide — media batch query", () => {
  it("loads media for N spaces + M amenities in a single query", async () => {
    fn("property", "findUnique").mockResolvedValue({
      id: "p1",
      checkInStart: null,
      checkInEnd: null,
      checkOutTime: null,
      primaryAccessMethod: null,
      accessMethodsJson: null,
      policiesJson: null,
    });
    // 10 spaces
    fn("space", "findMany").mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `s${i}`,
        spaceType: "sp.bedroom",
        name: `Habitación ${i}`,
        visibility: "guest",
        guestNotes: null,
        aiNotes: null,
        internalNotes: null,
        featuresJson: null,
        sortOrder: i,
        beds: [],
      })),
    );
    // 5 amenity instances
    fn("propertyAmenityInstance", "findMany").mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `a${i}`,
        amenityKey: "am.wifi",
        subtypeKey: null,
        detailsJson: null,
        guestInstructions: null,
        aiInstructions: null,
        internalNotes: null,
        visibility: "guest",
        placements: [],
      })),
    );
    fn("contact", "findMany").mockResolvedValue([]);
    fn("localPlace", "findMany").mockResolvedValue([]);

    await composeGuide("p1", "guest", "mi-casa");

    const findMany = fn("mediaAssignment", "findMany");
    expect(findMany).toHaveBeenCalledTimes(1);

    // Every space, every amenity, and the property id must appear in the OR
    // clause of the single call — proves batching.
    const callArg = findMany.mock.calls[0][0] as {
      where: { OR: Array<{ entityType: string; entityId: { in: string[] } }> };
    };
    const byType = new Map<string, Set<string>>();
    for (const clause of callArg.where.OR) {
      byType.set(clause.entityType, new Set(clause.entityId.in));
    }
    expect(byType.get("property")?.has("p1")).toBe(true);
    // All 10 space ids present
    for (let i = 0; i < 10; i++) {
      expect(byType.get("space")?.has(`s${i}`)).toBe(true);
    }
    // All 5 amenity ids present
    for (let i = 0; i < 5; i++) {
      expect(byType.get("amenity_instance")?.has(`a${i}`)).toBe(true);
    }
  });

  it("skips the media query entirely when publicSlug is null", async () => {
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

    await composeGuide("p1", "guest", null);
    expect(fn("mediaAssignment", "findMany")).not.toHaveBeenCalled();
  });

  it("skips the media query for sensitive audience (short-circuits the loader)", async () => {
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
        name: "Dormitorio",
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

    await composeGuide("p1", "sensitive", "mi-casa");
    expect(fn("mediaAssignment", "findMany")).not.toHaveBeenCalled();
  });
});
