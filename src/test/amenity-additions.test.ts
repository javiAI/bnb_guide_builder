import { describe, it, expect } from "vitest";

import {
  amenityTaxonomy,
  findAmenityItem,
  getAmenityGroupItems,
  getAmenityScopePolicy,
  isAmenityConfigurable,
} from "@/lib/taxonomy-loader";

// Branch 7B — new configurable amenity items proposed in
// docs/deep_research_2/amenities_arquitecture.md.
const NEW_ITEMS = [
  { id: "am.hand_soap", group: "ag.bathroom", scopePolicy: "property_only" },
  { id: "am.dish_soap", group: "ag.kitchen_dining", scopePolicy: "property_only" },
  { id: "am.laundry_detergent", group: "ag.bedroom_laundry", scopePolicy: "property_only" },
  { id: "am.air_purifier", group: "ag.heating_cooling", scopePolicy: "multi_instance" },
  { id: "am.humidifier", group: "ag.heating_cooling", scopePolicy: "multi_instance" },
  { id: "am.dehumidifier", group: "ag.heating_cooling", scopePolicy: "multi_instance" },
  { id: "am.cork_screw", group: "ag.kitchen_dining", scopePolicy: "property_only" },
  { id: "am.basic_spices", group: "ag.kitchen_dining", scopePolicy: "property_only" },
] as const;

describe("amenity additions (branch 7B)", () => {
  it("each new item is registered in the taxonomy", () => {
    for (const { id } of NEW_ITEMS) {
      expect(findAmenityItem(id), `${id} must exist in amenity_taxonomy.json`).toBeDefined();
    }
  });

  it("each new item is amenity_configurable", () => {
    for (const { id } of NEW_ITEMS) {
      expect(isAmenityConfigurable(id), `${id} must be amenity_configurable`).toBe(true);
    }
  });

  it("each new item is listed under its group's item_ids", () => {
    for (const { id, group } of NEW_ITEMS) {
      const items = getAmenityGroupItems(amenityTaxonomy, group);
      expect(items.map((i) => i.id), `${id} must appear under ${group}`).toContain(id);
    }
  });

  it("kitchen context surfaces the new kitchen items", () => {
    const kitchen = getAmenityGroupItems(amenityTaxonomy, "ag.kitchen_dining").map(
      (i) => i.id,
    );
    expect(kitchen).toEqual(
      expect.arrayContaining(["am.dish_soap", "am.cork_screw", "am.basic_spices"]),
    );
  });

  it("bathroom context surfaces am.hand_soap", () => {
    const bathroom = getAmenityGroupItems(amenityTaxonomy, "ag.bathroom").map((i) => i.id);
    expect(bathroom).toContain("am.hand_soap");
  });

  it("every new item has a non-empty label and description", () => {
    for (const { id } of NEW_ITEMS) {
      const item = findAmenityItem(id);
      expect(item?.label).toBeTruthy();
      expect(item?.description).toBeTruthy();
    }
  });

  it("every new item has the expected scopePolicy (required for UI surfacing)", () => {
    for (const { id, scopePolicy } of NEW_ITEMS) {
      const entry = getAmenityScopePolicy(id);
      expect(entry, `${id} must have a scopePolicies entry`).toBeDefined();
      expect(entry?.scopePolicy, `${id} scopePolicy`).toBe(scopePolicy);
    }
  });
});
