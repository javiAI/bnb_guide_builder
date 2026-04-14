import { describe, it, expect } from "vitest";
import {
  systemTaxonomy,
  systemSubtypes,
  amenityTaxonomy,
  findSystemItem,
  findSystemSubtype,
} from "@/lib/taxonomy-loader";

// Branch 1C — the 4 safety systems migrated out of amenities.
const SAFETY_SYSTEM_KEYS = [
  "sys.smoke_detector",
  "sys.co_detector",
  "sys.fire_extinguisher",
  "sys.first_aid_kit",
] as const;

// Source amenities that declared these as their `moved_to_system` target.
const AMENITY_TO_SYSTEM: Record<string, string> = {
  "am.smoke_alarm": "sys.smoke_detector",
  "am.co_alarm": "sys.co_detector",
  "am.fire_extinguisher": "sys.fire_extinguisher",
  "am.first_aid_kit": "sys.first_aid_kit",
};

describe("Systems — safety infrastructure (1C)", () => {
  it("registers the 4 safety systems in system_taxonomy.json", () => {
    for (const key of SAFETY_SYSTEM_KEYS) {
      const item = findSystemItem(key);
      expect(item, `missing system ${key}`).toBeDefined();
      expect(item!.label).toBeTruthy();
      expect(item!.subtypeKey).toBe(key);
    }
  });

  it("places detectors + extinguisher with defaultCoverageRule=all_relevant_spaces; first_aid_kit is property_only", () => {
    expect(findSystemItem("sys.smoke_detector")!.defaultCoverageRule).toBe("all_relevant_spaces");
    expect(findSystemItem("sys.co_detector")!.defaultCoverageRule).toBe("all_relevant_spaces");
    expect(findSystemItem("sys.fire_extinguisher")!.defaultCoverageRule).toBe("all_relevant_spaces");
    expect(findSystemItem("sys.first_aid_kit")!.defaultCoverageRule).toBe("property_only");
  });

  it("exposes a sgrp.safety group containing the 4 safety systems", () => {
    const group = systemTaxonomy.groups.find((g) => g.id === "sgrp.safety");
    expect(group, "sgrp.safety group must exist").toBeDefined();
    const ids = group!.items.map((i) => i.id);
    for (const key of SAFETY_SYSTEM_KEYS) {
      expect(ids).toContain(key);
    }
  });

  it("registers a subtype with at least one field for each safety system", () => {
    for (const key of SAFETY_SYSTEM_KEYS) {
      const subtype = findSystemSubtype(key);
      expect(subtype, `missing subtype ${key}`).toBeDefined();
      expect(subtype!.systemKey).toBe(key);
      // Each safety system has at least opsFields (last tested/restocked) — detailsFields may be empty for some.
      const total = subtype!.detailsFields.length + subtype!.opsFields.length;
      expect(total, `subtype ${key} must declare fields`).toBeGreaterThan(0);
    }
  });

  it("each safety subtype lives in system_subtypes.json (round-trip via raw taxonomy)", () => {
    const ids = systemSubtypes.subtypes.map((s) => s.id);
    for (const key of SAFETY_SYSTEM_KEYS) {
      expect(ids).toContain(key);
    }
  });

  it("originating amenity items have destination=moved_to_system and a target resolving to an existing system", () => {
    for (const [amenityId, systemKey] of Object.entries(AMENITY_TO_SYSTEM)) {
      const item = amenityTaxonomy.items.find((i) => i.id === amenityId);
      expect(item, `amenity ${amenityId} must exist`).toBeDefined();
      expect(item!.destination).toBe("moved_to_system");
      expect(item!.target).toBe(systemKey);
      expect(findSystemItem(systemKey), `target ${systemKey} must resolve`).toBeDefined();
    }
  });
});
