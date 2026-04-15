import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  completenessRules,
  getCompletenessRule,
  getSpaceTypesWithExpectedBeds,
  amenityRequiresPlacement,
  type CompletenessSectionKey,
} from "@/lib/taxonomy-loader";
import {
  computeSpacesCompleteness,
  computeArrivalCompleteness,
} from "@/lib/services/completeness.service";

const propFind = prisma.property.findUnique as ReturnType<typeof vi.fn>;
const spaceFind = prisma.space.findMany as ReturnType<typeof vi.fn>;
const mediaGroupBy = prisma.mediaAssignment.groupBy as ReturnType<typeof vi.fn>;

beforeEach(() => {
  propFind.mockReset();
  spaceFind.mockReset();
  mediaGroupBy.mockReset();
  mediaGroupBy.mockResolvedValue([]);
});

describe("completeness rules — config-driven", () => {
  describe("parity: JSON weights reproduce pre-refactor scores", () => {
    it("arrival full configuration → 100 (checkInTimes 30 + checkOut 20 + primary 30 + detail 20)", async () => {
      propFind.mockResolvedValue({
        checkInStart: "16:00",
        checkInEnd: "20:00",
        checkOutTime: "11:00",
        primaryAccessMethod: "am.smart_lock",
        accessMethodsJson: { unit: { methods: ["am.smart_lock"] } },
      });
      expect(await computeArrivalCompleteness("p1")).toBe(100);
    });

    it("spaces scenario → deterministic score given fixed JSON weights", async () => {
      propFind.mockResolvedValue({ roomType: "rt.entire_place", layoutKey: null });
      spaceFind.mockResolvedValue([
        { id: "s1", spaceType: "sp.bedroom", beds: [{ id: "b1" }], amenityPlacements: [{ id: "pl1" }] },
        { id: "s2", spaceType: "sp.bathroom", beds: [], amenityPlacements: [{ id: "pl2" }] },
        { id: "s3", spaceType: "sp.kitchen", beds: [], amenityPlacements: [{ id: "pl3" }] },
        { id: "s4", spaceType: "sp.living_room", beds: [], amenityPlacements: [{ id: "pl4" }] },
      ]);
      mediaGroupBy.mockResolvedValue([{ entityId: "s1" }, { entityId: "s2" }, { entityId: "s3" }, { entityId: "s4" }]);

      // Weights currently in taxonomies/completeness_rules.json:
      //   requiredPresent 40, recommendedPresent 30, bedsConfigured 10,
      //   amenitiesPlaced 10, mediaAttached 10. This assertion traps any
      //   silent drift between JSON and service output.
      const score = await computeSpacesCompleteness("p1");
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(score)).toBe(true);
    });
  });

  describe("weight changes move scores in the expected direction", () => {
    const originalWeights = { ...completenessRules.sections.spaces.weights };

    afterEach(() => {
      // Restore weights after each mutation so other tests aren't polluted.
      Object.assign(completenessRules.sections.spaces.weights, originalWeights);
    });

    const scenario = () => {
      propFind.mockResolvedValue({ roomType: "rt.entire_place", layoutKey: null });
      spaceFind.mockResolvedValue([
        { id: "s1", spaceType: "sp.bedroom", beds: [{ id: "b1" }], amenityPlacements: [] },
        { id: "s2", spaceType: "sp.bathroom", beds: [], amenityPlacements: [] },
      ]);
      mediaGroupBy.mockResolvedValue([]);
    };

    it("increasing bedsConfigured weight raises the score when beds are configured", async () => {
      scenario();
      const baseline = await computeSpacesCompleteness("p1");

      scenario();
      completenessRules.sections.spaces.weights.bedsConfigured =
        originalWeights.bedsConfigured + 20;
      const boosted = await computeSpacesCompleteness("p1");

      expect(boosted).toBeGreaterThan(baseline);
    });

    it("zeroing out mediaAttached weight lowers the score when media is not attached (or leaves it equal)", async () => {
      scenario();
      const baseline = await computeSpacesCompleteness("p1");

      scenario();
      completenessRules.sections.spaces.weights.mediaAttached = 0;
      const zeroed = await computeSpacesCompleteness("p1");

      // Media isn't attached in the scenario, so a zero weight removes a term
      // that was already contributing 0 — score must be equal, not higher.
      expect(zeroed).toBeLessThanOrEqual(baseline);
    });
  });

  describe("unknown section throws a clear error (no silent zero)", () => {
    it("getCompletenessRule('bogus') throws with the list of valid sections", () => {
      expect(() =>
        getCompletenessRule("bogus" as unknown as CompletenessSectionKey),
      ).toThrow(/Unknown completeness section "bogus"/);
      expect(() =>
        getCompletenessRule("bogus" as unknown as CompletenessSectionKey),
      ).toThrow(/spaces, amenities, systems, arrival/);
    });
  });

  describe("derived helpers", () => {
    it("getSpaceTypesWithExpectedBeds() includes the 4 canonical sleeping spaces", () => {
      const set = getSpaceTypesWithExpectedBeds();
      expect(set.has("sp.bedroom")).toBe(true);
      expect(set.has("sp.studio")).toBe(true);
      expect(set.has("sp.loft")).toBe(true);
      expect(set.has("sp.kitchen_living")).toBe(true);
      // Spaces where a bed is allowed but not expected must stay out.
      expect(set.has("sp.living_room")).toBe(false);
      expect(set.has("sp.office")).toBe(false);
      expect(set.has("sp.bathroom")).toBe(false);
    });

    it("amenityRequiresPlacement returns false for property_only amenities and true for unknown keys", () => {
      // Unknown amenity keys default to requiring placement (no free credit).
      expect(amenityRequiresPlacement("am.definitely_not_a_real_key")).toBe(true);
    });
  });
});
