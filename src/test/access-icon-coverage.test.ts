import { describe, it, expect } from "vitest";
import {
  buildingAccessMethods,
  accessMethods,
  parkingOptions,
  accessibilityFeatures,
} from "@/lib/taxonomy-loader";
import {
  BUILDING_ACCESS_ICONS,
  UNIT_ACCESS_ICONS,
  PARKING_ICONS,
  ACCESSIBILITY_ICONS,
  SUBSYSTEM_HEADER_ICONS,
  ACCESS_COCKPIT_IDS,
  ACCESS_USAGE_KEYS,
  buildingIconFor,
  unitIconFor,
  parkingIconFor,
  accessibilityIconFor,
} from "@/lib/icons/access-icons";

describe("access-icons coverage", () => {
  it("BUILDING_ACCESS_ICONS keys === building_access_methods.json items", () => {
    const taxonomyIds = buildingAccessMethods.items.map((i) => i.id).sort();
    const iconKeys = Object.keys(BUILDING_ACCESS_ICONS).sort();
    expect(iconKeys).toEqual(taxonomyIds);
  });

  it("UNIT_ACCESS_ICONS keys === access_methods.json items", () => {
    const taxonomyIds = accessMethods.items.map((i) => i.id).sort();
    const iconKeys = Object.keys(UNIT_ACCESS_ICONS).sort();
    expect(iconKeys).toEqual(taxonomyIds);
  });

  it("PARKING_ICONS keys === parking_options.json items", () => {
    const taxonomyIds = parkingOptions.items.map((i) => i.id).sort();
    const iconKeys = Object.keys(PARKING_ICONS).sort();
    expect(iconKeys).toEqual(taxonomyIds);
  });

  it("ACCESSIBILITY_ICONS keys === accessibility_features.json items", () => {
    const taxonomyIds = accessibilityFeatures.items.map((i) => i.id).sort();
    const iconKeys = Object.keys(ACCESSIBILITY_ICONS).sort();
    expect(iconKeys).toEqual(taxonomyIds);
  });

  it("SUBSYSTEM_HEADER_ICONS covers every cockpit id", () => {
    for (const id of ACCESS_COCKPIT_IDS) {
      expect(SUBSYSTEM_HEADER_ICONS[id]).toBeTruthy();
    }
  });

  it("ACCESS_USAGE_KEYS covers every cockpit id with access.* prefix", () => {
    for (const id of ACCESS_COCKPIT_IDS) {
      const key = ACCESS_USAGE_KEYS[id];
      expect(key).toMatch(/^access\./);
    }
  });

  it("fallback helpers return Ellipsis for unknown ids", () => {
    expect(buildingIconFor("zz.unknown")).toBeTruthy();
    expect(unitIconFor("zz.unknown")).toBeTruthy();
    expect(parkingIconFor("zz.unknown")).toBeTruthy();
    expect(accessibilityIconFor("zz.unknown")).toBeTruthy();
  });
});
