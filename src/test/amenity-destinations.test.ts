import { describe, it, expect } from "vitest";

import {
  amenityTaxonomy,
  systemTaxonomy,
  amenitySubtypes,
  getCompletenessRule,
} from "@/lib/taxonomy-loader";
import type { AmenityDestination } from "@/lib/types/taxonomy";
import { spaceFeatures } from "@/lib/taxonomies/space-features";

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

describe("amenity audit destinations (branch 1B+7B)", () => {
  it("has exactly 150 amenity items", () => {
    expect(amenityTaxonomy.items).toHaveLength(150);
  });

  it("mapping has exactly 150 entries with no duplicate ids", () => {
    expect(DESTINATIONS).toHaveLength(150);
    const ids = new Set(DESTINATIONS.map((d) => d.id));
    expect(ids.size).toBe(150);
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

  // ── Single source of truth (no duplication): a "system-backed" amenity is
  // one whose data lives on a system — whether it surfaces as a read-only
  // derived chip (`derived_from_system`: wifi/heating/hot_water/cooling/elevator)
  // or was moved entirely to the system (`moved_to_system`: smoke/co alarms,
  // fire extinguisher, first-aid kit). NEITHER may be re-captured as a
  // configurable amenity (core key or subtype) — that duplicates the truth.
  // These guards prevent re-introducing the dual-model the wifi/heating fix removed.
  const systemBackedAmenityIds = new Set(
    amenityTaxonomy.items
      .filter(
        (i) =>
          i.destination === "derived_from_system" ||
          i.destination === "moved_to_system",
      )
      .map((i) => i.id),
  );

  it("no system-backed amenity is a core amenity in completeness", () => {
    const core = getCompletenessRule("amenities").coreAmenityKeys;
    expect(core.filter((k) => systemBackedAmenityIds.has(k))).toEqual([]);
  });

  it("no system-backed amenity has a configurable amenity subtype", () => {
    const subtypeIds = amenitySubtypes.subtypes.map((s) => s.amenity_id);
    expect(subtypeIds.filter((id) => systemBackedAmenityIds.has(id))).toEqual([]);
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

  // 16I-4 flipped the six fitted kitchen appliances (fridge/freezer/dishwasher/
  // microwave/oven/stove) from configurable to derived_from_space — their truth
  // lives in the Espacios editor (sf.kitchen_*), like am.bathtub's does.
  it("counts per destination match the audit (89 / 26 / 18 / 6 / 5 / 4 / 1 / 1)", () => {
    const counts: Record<string, number> = {};
    for (const item of amenityTaxonomy.items) {
      const d = item.destination as string;
      counts[d] = (counts[d] ?? 0) + 1;
    }
    expect(counts).toEqual({
      amenity_configurable: 89,
      derived_from_space: 26,
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

  // ── Space-backed amenities (16I-4): each flipped amenity must keep a
  // matching space-feature field — that's where its truth is captured. If a
  // field is renamed/removed in space_features.json, this fails instead of
  // silently leaving the amenity underivable (the am.hair_dryer gap).
  const SPACE_BACKED_FIELD: ReadonlyArray<[amenityId: string, groupId: string, fieldId: string]> = [
    ["am.refrigerator", "sfg.kitchen_equipment", "sf.kitchen_fridge"],
    ["am.freezer", "sfg.kitchen_equipment", "sf.kitchen_freezer"],
    ["am.dishwasher", "sfg.kitchen_equipment", "sf.kitchen_dishwasher"],
    ["am.microwave", "sfg.kitchen_equipment", "sf.kitchen_microwave"],
    ["am.oven", "sfg.kitchen_equipment", "sf.kitchen_oven"],
    ["am.stove", "sfg.kitchen_equipment", "sf.kitchen_hob"],
    ["am.bathtub", "sfg.bathroom_fixtures", "sf.bathtub"],
    ["am.bidet", "sfg.bathroom_fixtures", "sf.bidet"],
    ["am.hair_dryer", "sfg.bathroom_fixtures", "sf.hair_dryer"],
    ["am.safe", "sfg.bedroom_storage", "sf.safe"],
    ["am.mosquito_net", "sfg.bedroom_privacy", "sf.mosquito_screens"],
    ["am.outdoor_shower", "sfg.outdoor_setup", "sf.outdoor_shower"],
  ];

  it("space-backed amenities are derived_from_space and have their space-feature field", () => {
    for (const [amenityId, groupId, fieldId] of SPACE_BACKED_FIELD) {
      const item = amenityTaxonomy.items.find((i) => i.id === amenityId);
      expect(item?.destination, amenityId).toBe("derived_from_space");
      const group = spaceFeatures.groups.find((g) => g.id === groupId);
      expect(group, groupId).toBeDefined();
      expect(
        group!.fields.some((f) => f.id === fieldId),
        `${amenityId} → ${fieldId} missing in ${groupId}`,
      ).toBe(true);
    }
  });
});
