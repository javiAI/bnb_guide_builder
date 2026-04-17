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
import { composeGuide, __test__ } from "@/lib/services/guide-rendering.service";
const { filterByAudience } = __test__;
import type { GuideItem } from "@/lib/types/guide-tree";

const fn = <K extends keyof typeof prisma>(table: K, method: "findUnique" | "findMany") =>
  (prisma[table] as unknown as Record<string, ReturnType<typeof vi.fn>>)[method];

beforeEach(() => {
  fn("property", "findUnique").mockReset();
  fn("space", "findMany").mockReset();
  fn("propertyAmenityInstance", "findMany").mockReset();
  fn("contact", "findMany").mockReset();
  fn("localPlace", "findMany").mockReset();
  // Default: empty property with no entities.
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

describe("composeGuide — basic shape", () => {
  it("returns all 7 sections declared in guide_sections.json in order", async () => {
    const tree = await composeGuide("p1", "guest", null);
    const ids = tree.sections.map((s) => s.id);
    expect(ids).toEqual([
      "gs.arrival",
      "gs.spaces",
      "gs.amenities",
      "gs.rules",
      "gs.contacts",
      "gs.local",
      "gs.emergency",
    ]);
    expect(tree.propertyId).toBe("p1");
    expect(tree.audience).toBe("guest");
  });

  it("empty property emits all sections with items: [] + null deep-link for guest", async () => {
    const tree = await composeGuide("p1", "guest", null);
    for (const section of tree.sections) {
      expect(section.items).toHaveLength(0);
      expect(section.emptyCtaDeepLink).toBeNull();
    }
  });

  it("internal audience emits resolved emptyCtaDeepLink with propertyId", async () => {
    const tree = await composeGuide("p1", "internal", null);
    for (const section of tree.sections) {
      expect(section.emptyCtaDeepLink).toContain("p1");
    }
  });
});

describe("composeGuide — audience filtering", () => {
  it("filters sensitive fields out of every audience", async () => {
    fn("space", "findMany").mockResolvedValue([
      {
        id: "s1",
        spaceType: "sp.bedroom",
        name: "Dormitorio",
        visibility: "guest",
        guestNotes: "guest note",
        aiNotes: "ai note",
        internalNotes: "internal note",
        featuresJson: null,
        sortOrder: 0,
        beds: [],
      },
    ]);
    for (const audience of ["guest", "ai", "internal"] as const) {
      const tree = await composeGuide("p1", audience, null);
      const space = tree.sections.find((s) => s.id === "gs.spaces")!.items[0];
      expect(space).toBeDefined();
      // sensitive is never in the tree; every remaining field must be visible
      // to the audience.
      for (const f of space.fields) {
        expect(f.visibility).not.toBe("sensitive");
      }
    }
  });

  it("guest sees guest-only fields; internal sees all non-sensitive fields", async () => {
    fn("space", "findMany").mockResolvedValue([
      {
        id: "s1",
        spaceType: "sp.bedroom",
        name: "Dormitorio",
        visibility: "guest",
        guestNotes: "guest note",
        aiNotes: "ai note",
        internalNotes: "internal note",
        featuresJson: null,
        sortOrder: 0,
        beds: [],
      },
    ]);
    const guest = await composeGuide("p1", "guest", null);
    const internal = await composeGuide("p1", "internal", null);
    const guestFields = guest.sections.find((s) => s.id === "gs.spaces")!.items[0].fields;
    const internalFields = internal.sections.find((s) => s.id === "gs.spaces")!.items[0].fields;
    expect(guestFields.every((f) => f.visibility === "guest")).toBe(true);
    expect(internalFields.length).toBeGreaterThan(guestFields.length);
  });

  it("hides entire items whose own visibility is higher than audience tier", async () => {
    fn("contact", "findMany").mockResolvedValue([
      {
        id: "c1",
        roleKey: "contact.host",
        displayName: "Internal-only",
        phone: "123",
        email: null,
        guestVisibleNotes: null,
        internalNotes: null,
        emergencyAvailable: false,
        sortOrder: 0,
        visibility: "internal",
      },
    ]);
    const guest = await composeGuide("p1", "guest", null);
    expect(guest.sections.find((s) => s.id === "gs.contacts")!.items).toHaveLength(0);
    const internal = await composeGuide("p1", "internal", null);
    expect(internal.sections.find((s) => s.id === "gs.contacts")!.items).toHaveLength(1);
  });
});

describe("filterByAudience", () => {
  const mkItem = (visibility: "guest" | "ai" | "internal" | "sensitive"): GuideItem => ({
    id: "i",
    taxonomyKey: null,
    label: "l",
    value: null,
    visibility,
    deprecated: false,
    warnings: [],
    fields: [],
    media: [],
    children: [],
  });

  it("drops sensitive items and returns an empty array for audience=sensitive", () => {
    const items = [mkItem("guest"), mkItem("internal"), mkItem("sensitive")];
    expect(filterByAudience(items, "sensitive")).toEqual([]);
    expect(filterByAudience(items, "internal")).toHaveLength(2);
    expect(filterByAudience(items, "ai")).toHaveLength(1);
    expect(filterByAudience(items, "guest")).toHaveLength(1);
  });
});

describe("composeGuide — emergency split", () => {
  it("emergency-flagged contacts go to emergency, others to contacts", async () => {
    fn("contact", "findMany").mockResolvedValue([
      {
        id: "c1",
        roleKey: "contact.host",
        displayName: "Host",
        phone: "1",
        email: null,
        guestVisibleNotes: null,
        internalNotes: null,
        emergencyAvailable: false,
        sortOrder: 0,
        visibility: "guest",
      },
      {
        id: "c2",
        roleKey: "contact.emergency",
        displayName: "Emergency",
        phone: "112",
        email: null,
        guestVisibleNotes: null,
        internalNotes: null,
        emergencyAvailable: true,
        sortOrder: 1,
        visibility: "guest",
      },
    ]);
    const tree = await composeGuide("p1", "guest", null);
    const contacts = tree.sections.find((s) => s.id === "gs.contacts")!;
    const emergency = tree.sections.find((s) => s.id === "gs.emergency")!;
    expect(contacts.items.map((i) => i.id)).toEqual(["c1"]);
    expect(emergency.items.map((i) => i.id)).toEqual(["c2"]);
  });
});
