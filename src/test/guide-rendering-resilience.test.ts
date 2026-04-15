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
import {
  composeGuide,
  formatFieldValue,
} from "@/lib/services/guide-rendering.service";

const fn = <K extends keyof typeof prisma>(table: K, method: "findUnique" | "findMany") =>
  (prisma[table] as unknown as Record<string, ReturnType<typeof vi.fn>>)[method];

beforeEach(() => {
  fn("property", "findUnique").mockResolvedValue({
    id: "p1",
    checkInStart: null,
    checkInEnd: null,
    checkOutTime: null,
    primaryAccessMethod: "ax.does_not_exist",
    accessMethodsJson: null,
    policiesJson: null,
  });
  fn("space", "findMany").mockResolvedValue([]);
  fn("propertyAmenityInstance", "findMany").mockResolvedValue([]);
  fn("contact", "findMany").mockResolvedValue([]);
  fn("localPlace", "findMany").mockResolvedValue([]);
});

describe("resilience — deprecated taxonomy keys", () => {
  it("amenity with unknown amenityKey renders as deprecated, no throw", async () => {
    fn("propertyAmenityInstance", "findMany").mockResolvedValue([
      {
        id: "ai1",
        amenityKey: "am.does_not_exist",
        subtypeKey: null,
        detailsJson: null,
        guestInstructions: null,
        aiInstructions: null,
        internalNotes: null,
        visibility: "guest",
        placements: [],
      },
    ]);
    const tree = await composeGuide("p1", "internal");
    const amenities = tree.sections.find((s) => s.id === "gs.amenities")!;
    expect(amenities.items).toHaveLength(1);
    expect(amenities.items[0].deprecated).toBe(true);
    expect(amenities.items[0].label).toBe("am.does_not_exist");
  });

  it("space with unknown spaceType renders as deprecated, no throw", async () => {
    fn("space", "findMany").mockResolvedValue([
      {
        id: "s1",
        spaceType: "sp.does_not_exist",
        name: "Sala rara",
        visibility: "guest",
        guestNotes: null,
        aiNotes: null,
        internalNotes: null,
        featuresJson: null,
        sortOrder: 0,
        beds: [],
      },
    ]);
    const tree = await composeGuide("p1", "internal");
    const spaces = tree.sections.find((s) => s.id === "gs.spaces")!;
    expect(spaces.items).toHaveLength(1);
    expect(spaces.items[0].deprecated).toBe(true);
  });

  it("primaryAccessMethod with unknown key renders as deprecated, no throw", async () => {
    const tree = await composeGuide("p1", "internal");
    const arrival = tree.sections.find((s) => s.id === "gs.arrival")!;
    const accessItem = arrival.items.find((i) => i.id === "arrival.access");
    expect(accessItem).toBeDefined();
    expect(accessItem!.deprecated).toBe(true);
    expect(accessItem!.label).toBe("ax.does_not_exist");
  });

  it("policy key not in policy_taxonomy renders as deprecated", async () => {
    fn("property", "findUnique").mockResolvedValue({
      id: "p1",
      checkInStart: null,
      checkInEnd: null,
      checkOutTime: null,
      primaryAccessMethod: null,
      accessMethodsJson: null,
      policiesJson: { "pol.legacy_thing": "some value" },
    });
    const tree = await composeGuide("p1", "internal");
    const rules = tree.sections.find((s) => s.id === "gs.rules")!;
    const deprecatedPolicy = rules.items.find((i) => i.taxonomyKey === "pol.legacy_thing");
    expect(deprecatedPolicy).toBeDefined();
    expect(deprecatedPolicy!.deprecated).toBe(true);
    expect(deprecatedPolicy!.warnings).toContain("deprecated_policy_key");
  });
});

describe("resilience — unknown field types", () => {
  it("formatFieldValue emits a warning and falls back to String(value) for unknown types", () => {
    const { value, warning } = formatFieldValue(
      { id: "f1", label: "Field", type: "future_type_not_in_registry" },
      42,
    );
    expect(value).toBe("42");
    expect(warning).toBe("unknown_field_type:future_type_not_in_registry");
  });

  it("empty values never produce a warning", () => {
    const { value, warning } = formatFieldValue(
      { id: "f1", label: "Field", type: "future_type" },
      null,
    );
    expect(value).toBe("");
    expect(warning).toBe(null);
  });
});

describe("resilience — composeGuide never throws on missing property", () => {
  it("returns all sections with items: [] when property.findUnique returns null", async () => {
    fn("property", "findUnique").mockResolvedValue(null);
    const tree = await composeGuide("does-not-exist", "guest");
    expect(tree.sections.every((s) => s.items.length === 0)).toBe(true);
  });
});
