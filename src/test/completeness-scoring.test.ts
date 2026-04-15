import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
    space: { findMany: vi.fn() },
    propertyAmenityInstance: { findMany: vi.fn() },
    propertySystem: { findMany: vi.fn() },
    mediaAssignment: { groupBy: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  computeArrivalCompleteness,
  computeSystemsCompleteness,
  computeAmenitiesCompleteness,
  computeSpacesCompleteness,
  computeOverallReadiness,
} from "@/lib/services/completeness.service";

const propFind = prisma.property.findUnique as ReturnType<typeof vi.fn>;
const spaceFind = prisma.space.findMany as ReturnType<typeof vi.fn>;
const amenityFind = prisma.propertyAmenityInstance.findMany as ReturnType<typeof vi.fn>;
const systemFind = prisma.propertySystem.findMany as ReturnType<typeof vi.fn>;
const mediaGroupBy = prisma.mediaAssignment.groupBy as ReturnType<typeof vi.fn>;

beforeEach(() => {
  propFind.mockReset();
  spaceFind.mockReset();
  amenityFind.mockReset();
  systemFind.mockReset();
  mediaGroupBy.mockReset();
  mediaGroupBy.mockResolvedValue([]);
});

describe("computeArrivalCompleteness", () => {
  it("returns 0 when nothing is configured", async () => {
    propFind.mockResolvedValue({
      checkInStart: null, checkInEnd: null, checkOutTime: null,
      primaryAccessMethod: null, accessMethodsJson: null,
    });
    expect(await computeArrivalCompleteness("p1")).toBe(0);
  });

  it("returns 100 when all four facets are present", async () => {
    propFind.mockResolvedValue({
      checkInStart: "16:00", checkInEnd: "20:00", checkOutTime: "11:00",
      primaryAccessMethod: "am.smart_lock",
      accessMethodsJson: { unit: { methods: ["am.smart_lock", "am.lockbox"] } },
    });
    expect(await computeArrivalCompleteness("p1")).toBe(100);
  });

  it("partial credit: only check-in/out times → 50", async () => {
    propFind.mockResolvedValue({
      checkInStart: "16:00", checkInEnd: "20:00", checkOutTime: "11:00",
      primaryAccessMethod: null, accessMethodsJson: null,
    });
    expect(await computeArrivalCompleteness("p1")).toBe(50);
  });
});

describe("computeSystemsCompleteness", () => {
  it("100 when all recommended systems are present with details", async () => {
    systemFind.mockResolvedValue([
      { systemKey: "sys.internet", detailsJson: { ssid: "x" } },
      { systemKey: "sys.heating", detailsJson: { type: "radiator" } },
      { systemKey: "sys.hot_water", detailsJson: { source: "boiler" } },
    ]);
    expect(await computeSystemsCompleteness("p1")).toBe(100);
  });

  it("60 when all recommended present but details empty", async () => {
    systemFind.mockResolvedValue([
      { systemKey: "sys.internet", detailsJson: {} },
      { systemKey: "sys.heating", detailsJson: null },
      { systemKey: "sys.hot_water", detailsJson: { foo: "" } },
    ]);
    expect(await computeSystemsCompleteness("p1")).toBe(60);
  });

  it("0 when no systems configured", async () => {
    systemFind.mockResolvedValue([]);
    expect(await computeSystemsCompleteness("p1")).toBe(0);
  });
});

describe("computeAmenitiesCompleteness", () => {
  it("100 when all core amenities are present, details complete, and placed", async () => {
    amenityFind.mockResolvedValue([
      { amenityKey: "am.wifi", subtypeKey: "am.wifi",
        detailsJson: { "wifi.ssid": "R", "wifi.password": "p" },
        placements: [{ id: "pl1" }] },
      { amenityKey: "am.heating", subtypeKey: null, detailsJson: null, placements: [{ id: "pl2" }] },
      { amenityKey: "am.tv", subtypeKey: null, detailsJson: null, placements: [{ id: "pl3" }] },
      { amenityKey: "am.coffee_maker", subtypeKey: null, detailsJson: null, placements: [{ id: "pl4" }] },
      { amenityKey: "am.kitchen_basics", subtypeKey: null, detailsJson: null, placements: [{ id: "pl5" }] },
    ]);
    expect(await computeAmenitiesCompleteness("p1")).toBe(100);
  });

  it("0 when no instances exist", async () => {
    amenityFind.mockResolvedValue([]);
    expect(await computeAmenitiesCompleteness("p1")).toBe(0);
  });

  it("penalises missing required subtype fields (am.wifi.password missing)", async () => {
    amenityFind.mockResolvedValue([
      { amenityKey: "am.wifi", subtypeKey: "am.wifi",
        detailsJson: { "wifi.ssid": "R" }, // password missing
        placements: [{ id: "pl1" }] },
    ]);
    // 1/5 core present (40 * 0.2 = 8) + 0/1 details (0) + 1/1 placed (30) = 38
    expect(await computeAmenitiesCompleteness("p1")).toBe(38);
  });
});

describe("computeOverallReadiness", () => {
  it("composes scores, marks usable when all sections ≥ 70", async () => {
    propFind.mockResolvedValue({
      roomType: "rt.entire_place", layoutKey: null,
      checkInStart: "16:00", checkInEnd: "20:00", checkOutTime: "11:00",
      primaryAccessMethod: "am.smart_lock",
      accessMethodsJson: { unit: { methods: ["am.smart_lock", "am.lockbox"] } },
    });
    spaceFind.mockResolvedValue([
      { id: "s1", spaceType: "sp.bedroom",
        beds: [{ id: "b1" }], amenityPlacements: [{ id: "pl1" }] },
      { id: "s2", spaceType: "sp.bathroom",
        beds: [], amenityPlacements: [{ id: "pl2" }] },
      { id: "s3", spaceType: "sp.kitchen",
        beds: [], amenityPlacements: [{ id: "pl3" }] },
      { id: "s4", spaceType: "sp.living_room",
        beds: [], amenityPlacements: [{ id: "pl4" }] },
    ]);
    mediaGroupBy.mockResolvedValue([
      { entityId: "s1" }, { entityId: "s2" }, { entityId: "s3" }, { entityId: "s4" },
    ]);
    amenityFind.mockResolvedValue([
      { amenityKey: "am.wifi", subtypeKey: null, detailsJson: null, placements: [{ id: "pl" }] },
      { amenityKey: "am.heating", subtypeKey: null, detailsJson: null, placements: [{ id: "pl" }] },
      { amenityKey: "am.tv", subtypeKey: null, detailsJson: null, placements: [{ id: "pl" }] },
      { amenityKey: "am.coffee_maker", subtypeKey: null, detailsJson: null, placements: [{ id: "pl" }] },
      { amenityKey: "am.kitchen_basics", subtypeKey: null, detailsJson: null, placements: [{ id: "pl" }] },
    ]);
    systemFind.mockResolvedValue([
      { systemKey: "sys.internet", detailsJson: { ssid: "x" } },
      { systemKey: "sys.heating", detailsJson: { type: "x" } },
      { systemKey: "sys.hot_water", detailsJson: { src: "x" } },
    ]);

    const out = await computeOverallReadiness("p1");
    expect(out.scores.arrival).toBe(100);
    expect(out.scores.amenities).toBe(100);
    expect(out.scores.systems).toBe(100);
    expect(out.usable).toBe(true);
    expect(out.publishable).toBe(true);
  });

  it("not publishable when any section below 85", async () => {
    propFind.mockResolvedValue({
      roomType: null, layoutKey: null,
      checkInStart: null, checkInEnd: null, checkOutTime: null,
      primaryAccessMethod: null, accessMethodsJson: null,
    });
    spaceFind.mockResolvedValue([]);
    amenityFind.mockResolvedValue([]);
    systemFind.mockResolvedValue([]);

    const out = await computeOverallReadiness("p1");
    expect(out.publishable).toBe(false);
    expect(out.usable).toBe(false);
    expect(out.overall).toBe(0);
  });
});

describe("computeSpacesCompleteness", () => {
  it("returns 0 when property has no roomType", async () => {
    propFind.mockResolvedValue({ roomType: null, layoutKey: null });
    expect(await computeSpacesCompleteness("p1")).toBe(0);
  });
});
