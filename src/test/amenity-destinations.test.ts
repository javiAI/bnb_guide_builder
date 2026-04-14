import { describe, it, expect } from "vitest";

import { amenityTaxonomy, systemTaxonomy } from "@/lib/taxonomy-loader";
import type { AmenityDestination } from "@/lib/types/taxonomy";

import { DESTINATIONS, applyDestinations } from "../../scripts/apply-amenity-destinations";

const allSystemIds = new Set(
  systemTaxonomy.groups.flatMap((g) => g.items.map((i) => i.id)),
);

// Systems deliberately not yet created — branch 1C will add them.
// Until then, `moved_to_system` targets are permitted to be absent from
// system_taxonomy.json. This test only enforces that DERIVED systems exist.
const PENDING_SYSTEM_TARGETS = new Set<string>([
  "sys.smoke_detector",
  "sys.co_detector",
  "sys.fire_extinguisher",
  "sys.first_aid_kit",
]);

describe("amenity audit destinations (branch 1B)", () => {
  it("has exactly 142 amenity items", () => {
    expect(amenityTaxonomy.items).toHaveLength(142);
  });

  it("mapping has exactly 142 entries with no duplicate ids", () => {
    expect(DESTINATIONS).toHaveLength(142);
    const ids = new Set(DESTINATIONS.map((d) => d.id));
    expect(ids.size).toBe(142);
  });

  it("every taxonomy item has a destination set", () => {
    const missing = amenityTaxonomy.items.filter((i) => !i.destination);
    expect(missing.map((i) => i.id)).toEqual([]);
  });

  it("every destination is a valid AmenityDestination", () => {
    const valid: ReadonlySet<AmenityDestination> = new Set<AmenityDestination>([
      "amenity_configurable",
      "derived_from_space",
      "derived_from_system",
      "derived_from_access",
      "moved_to_system",
      "moved_to_access",
      "moved_to_property_attribute",
      "moved_to_guide_content",
    ]);
    for (const item of amenityTaxonomy.items) {
      expect(valid.has(item.destination as AmenityDestination)).toBe(true);
    }
  });

  it("am.wifi is derived_from_system with target sys.internet", () => {
    const wifi = amenityTaxonomy.items.find((i) => i.id === "am.wifi");
    expect(wifi?.destination).toBe("derived_from_system");
    expect(wifi?.target).toBe("sys.internet");
  });

  it("all 13 ax.* items are moved_to_access", () => {
    const ax = amenityTaxonomy.items.filter((i) => i.id.startsWith("ax."));
    expect(ax).toHaveLength(13);
    for (const item of ax) {
      expect(item.destination).toBe("moved_to_access");
    }
  });

  it("derived_from_system items point to an existing systemKey", () => {
    const derived = amenityTaxonomy.items.filter(
      (i) => i.destination === "derived_from_system",
    );
    expect(derived.length).toBeGreaterThan(0);
    for (const item of derived) {
      expect(item.target, `${item.id} must have a target`).toBeDefined();
      expect(
        allSystemIds.has(item.target!),
        `${item.id} → target ${item.target} not in system_taxonomy.json`,
      ).toBe(true);
    }
  });

  it("moved_to_system items have a sys.* target (may not yet exist; branch 1C adds them)", () => {
    const moved = amenityTaxonomy.items.filter(
      (i) => i.destination === "moved_to_system",
    );
    expect(moved.length).toBe(4);
    for (const item of moved) {
      expect(item.target, `${item.id} must have a target`).toBeDefined();
      expect(item.target!.startsWith("sys.")).toBe(true);
      // target must be either an existing system or a pending one (1C).
      const known = allSystemIds.has(item.target!) || PENDING_SYSTEM_TARGETS.has(item.target!);
      expect(known, `${item.id} → target ${item.target} unknown`).toBe(true);
    }
  });

  it("counts per destination match the audit (87 / 20 / 18 / 6 / 5 / 4 / 1 / 1)", () => {
    const counts: Record<string, number> = {};
    for (const item of amenityTaxonomy.items) {
      const d = item.destination as string;
      counts[d] = (counts[d] ?? 0) + 1;
    }
    expect(counts).toEqual({
      amenity_configurable: 87,
      derived_from_space: 20,
      moved_to_access: 18,
      moved_to_property_attribute: 6,
      derived_from_system: 5,
      moved_to_system: 4,
      derived_from_access: 1,
      moved_to_guide_content: 1,
    });
  });

  it("apply script is idempotent (no changes on second run)", () => {
    // Deep-clone the live taxonomy and re-apply: `updated` should be 0.
    const clone = JSON.parse(JSON.stringify(amenityTaxonomy)) as Parameters<
      typeof applyDestinations
    >[0];
    const { updated } = applyDestinations(clone);
    expect(updated).toBe(0);
  });
});
