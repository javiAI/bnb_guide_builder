import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    space: { findMany: vi.fn() },
    property: { findUnique: vi.fn() },
    propertySystemCoverage: { findMany: vi.fn() },
    propertyAmenityInstance: { findMany: vi.fn() },
    propertySystem: { findMany: vi.fn() },
    propertyDerived: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  computeSleepingCapacity,
  computeActualCounts,
  computeSystemCoverageBySpace,
  computeAmenitiesEffectiveBySpace,
} from "@/lib/services/property-derived.service";

const spaceFindMany = prisma.space.findMany as ReturnType<typeof vi.fn>;
const coverageFindMany = prisma.propertySystemCoverage.findMany as ReturnType<typeof vi.fn>;
const instanceFindMany = prisma.propertyAmenityInstance.findMany as ReturnType<typeof vi.fn>;
const systemFindMany = prisma.propertySystem.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  spaceFindMany.mockReset();
  coverageFindMany.mockReset();
  instanceFindMany.mockReset();
  systemFindMany.mockReset();
});

describe("computeSleepingCapacity", () => {
  it("sums bed capacities across spaces and ignores zero-capacity beds", async () => {
    spaceFindMany.mockResolvedValue([
      {
        id: "s1",
        spaceType: "sp.bedroom",
        name: "Dormitorio 1",
        beds: [
          { bedType: "bt.double", quantity: 1, configJson: null },
          { bedType: "bt.crib", quantity: 1, configJson: null },
        ],
      },
      {
        id: "s2",
        spaceType: "sp.bedroom",
        name: "Dormitorio 2",
        beds: [{ bedType: "bt.single", quantity: 2, configJson: null }],
      },
    ]);
    const out = await computeSleepingCapacity("prop-1");
    expect(out.bySpace).toHaveLength(2);
    // double=2 + crib=0, single*2=2 → total 4
    expect(out.total).toBe(4);
    expect(out.bySpace[0].sleepingCapacity).toBe(2);
    expect(out.bySpace[1].sleepingCapacity).toBe(2);
  });
});

describe("computeActualCounts", () => {
  it("counts only sp.bedroom / sp.bathroom and sums bed quantities", async () => {
    spaceFindMany.mockResolvedValue([
      { spaceType: "sp.bedroom", beds: [{ quantity: 2 }] },
      { spaceType: "sp.bedroom", beds: [{ quantity: 1 }] },
      { spaceType: "sp.bathroom", beds: [] },
      { spaceType: "sp.kitchen", beds: [] },
    ]);
    const out = await computeActualCounts("prop-1");
    expect(out.actualBedroomsCount).toBe(2);
    expect(out.actualBathroomsCount).toBe(1);
    expect(out.actualBedsCount).toBe(3);
  });
});

describe("computeSystemCoverageBySpace", () => {
  it("groups system keys by space and excludes inherited + override_no rows", async () => {
    coverageFindMany.mockResolvedValue([
      { spaceId: "s1", mode: "override_yes", system: { systemKey: "sys.heating" } },
      { spaceId: "s1", mode: "override_yes", system: { systemKey: "sys.ac" } },
      { spaceId: "s1", mode: "override_no", system: { systemKey: "sys.fan" } },
      { spaceId: "s2", mode: "inherited", system: { systemKey: "sys.heating" } },
      { spaceId: "s2", mode: "override_yes", system: { systemKey: "sys.internet" } },
    ]);
    const out = await computeSystemCoverageBySpace("prop-1");
    expect(out.bySpace.s1).toEqual(["sys.heating", "sys.ac"]);
    expect(out.bySpace.s1).not.toContain("sys.fan");
    expect(out.bySpace.s2).toEqual(["sys.internet"]);
  });
});

describe("computeAmenitiesEffectiveBySpace", () => {
  it("merges configurable placements and derived-from-system globals", async () => {
    instanceFindMany.mockResolvedValue([
      { amenityKey: "am.tv", placements: [{ spaceId: "s1" }] },
      { amenityKey: "am.coffee_maker", placements: [] }, // global
    ]);
    systemFindMany.mockResolvedValue([{ systemKey: "sys.internet" }]);
    spaceFindMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

    const out = await computeAmenitiesEffectiveBySpace("prop-1");

    expect(out.global).toContain("am.coffee_maker");
    // am.wifi is derived_from_system of sys.internet → should be global + per-space
    expect(out.global).toContain("am.wifi");
    expect(out.bySpace.s1).toContain("am.tv");
    expect(out.bySpace.s1).toContain("am.wifi");
    expect(out.bySpace.s2).toContain("am.wifi");
    expect(out.bySpace.s2 ?? []).not.toContain("am.tv");
  });

  it("does not add derived-from-system amenities when the source system is absent", async () => {
    instanceFindMany.mockResolvedValue([]);
    systemFindMany.mockResolvedValue([]); // no sys.internet
    spaceFindMany.mockResolvedValue([{ id: "s1" }]);

    const out = await computeAmenitiesEffectiveBySpace("prop-1");
    expect(out.global).not.toContain("am.wifi");
    expect(out.bySpace.s1 ?? []).not.toContain("am.wifi");
  });
});
