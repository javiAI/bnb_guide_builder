import { describe, it, expect } from "vitest";
import { ENTITY_TYPES } from "@/lib/types/knowledge";
import {
  getSectionIdForEntity,
  getGuideSectionConfigs,
} from "@/lib/taxonomy-loader";

describe("entityType → sectionId mapping (rama 11F)", () => {
  it("is exhaustive — every KnowledgeItem.entityType resolves to a section", () => {
    for (const type of ENTITY_TYPES) {
      const sid = getSectionIdForEntity(type, null);
      expect(sid, `entityType="${type}" must map to a section`).not.toBeNull();
    }
  });

  it("never resolves a hit to an aggregator section (essentials is a facade)", () => {
    const aggregatorIds = new Set(
      getGuideSectionConfigs()
        .filter((s) => s.isAggregator)
        .map((s) => s.id),
    );
    expect(aggregatorIds.size).toBeGreaterThan(0);
    for (const type of ENTITY_TYPES) {
      const sid = getSectionIdForEntity(type, null);
      expect(sid).not.toBeNull();
      expect(aggregatorIds.has(sid as string)).toBe(false);
    }
  });

  it("policy defaults to gs.rules", () => {
    expect(getSectionIdForEntity("policy", null)).toBe("gs.rules");
    expect(getSectionIdForEntity("policy", "stay")).toBe("gs.rules");
  });

  it("policy with journeyStage='checkout' is re-homed to gs.checkout", () => {
    expect(getSectionIdForEntity("policy", "checkout")).toBe("gs.checkout");
  });

  it("maps the canonical types to their intuitive sections", () => {
    expect(getSectionIdForEntity("access", null)).toBe("gs.arrival");
    expect(getSectionIdForEntity("space", null)).toBe("gs.spaces");
    expect(getSectionIdForEntity("system", null)).toBe("gs.howto");
    expect(getSectionIdForEntity("amenity", null)).toBe("gs.amenities");
    expect(getSectionIdForEntity("property", null)).toBe("gs.amenities");
    expect(getSectionIdForEntity("contact", null)).toBe("gs.emergency");
  });
});
