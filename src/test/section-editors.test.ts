import { describe, it, expect } from "vitest";
import {
  getSectionEditor,
} from "@/config/schemas/section-editors";
import {
  policyTaxonomy,
  getPolicyGroups,
  getPolicyItems,
  spaceTypes,
  getItems,
  amenityTaxonomy,
  getAmenityGroups,
  getAmenityGroupItems,
  findSubtype,
} from "@/lib/taxonomy-loader";

describe("Phase 4 section editors are config-driven", () => {
  const phase4Sections = ["basics", "arrival", "policies", "spaces", "amenities"];

  it("all Phase 4 sections exist in the registry", () => {
    for (const key of phase4Sections) {
      expect(getSectionEditor(key)).toBeDefined();
    }
  });

  it("Phase 4 content sections belong to content group", () => {
    for (const key of phase4Sections) {
      const section = getSectionEditor(key)!;
      expect(section.group).toBe("content");
    }
  });

  it("basics and arrival have completenessFields defined", () => {
    const basics = getSectionEditor("basics")!;
    expect(basics.completenessFields!.length).toBeGreaterThan(0);
    const arrival = getSectionEditor("arrival")!;
    expect(arrival.completenessFields!.length).toBeGreaterThan(0);
  });

  it("spaces, amenities reference their taxonomy source", () => {
    expect(getSectionEditor("spaces")!.taxonomySource).toBe("spaceTypes");
    expect(getSectionEditor("amenities")!.taxonomySource).toBe("amenityTaxonomy");
    expect(getSectionEditor("policies")!.taxonomySource).toBe("policyTaxonomy");
  });

  it("spaces and amenities have list + detail pattern", () => {
    expect(getSectionEditor("spaces")!.hasList).toBe(true);
    expect(getSectionEditor("spaces")!.hasDetail).toBe(true);
    expect(getSectionEditor("amenities")!.hasList).toBe(true);
    expect(getSectionEditor("amenities")!.hasDetail).toBe(true);
  });
});

describe("Policies editor is taxonomy-driven", () => {
  it("policy groups are loaded from taxonomy", () => {
    const groups = getPolicyGroups(policyTaxonomy);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("each policy group has items", () => {
    const groups = getPolicyGroups(policyTaxonomy);
    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("policy items have type field for form rendering", () => {
    const items = getPolicyItems(policyTaxonomy);
    for (const item of items) {
      expect(item.type).toBeTruthy();
    }
  });

  it("policy items have Spanish labels", () => {
    const items = getPolicyItems(policyTaxonomy);
    for (const item of items) {
      expect(item.label).toBeTruthy();
      expect(item.label).toMatch(/[a-záéíóúñ]/i);
    }
  });
});

describe("Spaces editor is taxonomy-driven", () => {
  it("space types are loaded from taxonomy", () => {
    const types = getItems(spaceTypes);
    expect(types.length).toBeGreaterThan(0);
  });

  it("space types have recommended flag", () => {
    const types = getItems(spaceTypes);
    const recommended = types.filter((t) => t.recommended);
    expect(recommended.length).toBeGreaterThan(0);
  });

  it("space types have stable IDs starting with sp.", () => {
    const types = getItems(spaceTypes);
    for (const type of types) {
      expect(type.id).toMatch(/^sp\./);
    }
  });
});

describe("Amenities editor is taxonomy-driven", () => {
  it("amenity groups are loaded from taxonomy", () => {
    const groups = getAmenityGroups(amenityTaxonomy);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("each amenity group has items", () => {
    const groups = getAmenityGroups(amenityTaxonomy);
    for (const group of groups) {
      const items = getAmenityGroupItems(amenityTaxonomy, group.id);
      expect(items.length).toBeGreaterThan(0);
    }
  });

  it("amenity items have stable IDs", () => {
    for (const item of amenityTaxonomy.items) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
    }
  });

  it("some amenities have subtype configurations", () => {
    // wifi and coffee_maker should have subtypes
    const wifiSubtype = findSubtype("am.wifi");
    expect(wifiSubtype).toBeDefined();
    expect(wifiSubtype!.fields.length).toBeGreaterThan(0);

    const coffeeSubtype = findSubtype("am.coffee_maker");
    expect(coffeeSubtype).toBeDefined();
    expect(coffeeSubtype!.fields.length).toBeGreaterThan(0);
  });
});
