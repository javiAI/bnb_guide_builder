import { describe, it, expect } from "vitest";
import {
  getSectionEditor,
} from "@/config/schemas/section-editors";
import {
  policyTaxonomy,
  getPolicyGroups,
  getPolicyItems,
  spaceTypes,
  bedTypes,
  getItems,
  findItem,
  amenityTaxonomy,
  getAmenityGroups,
  getAmenityGroupItems,
  findSubtype,
  spaceFeatures,
  getSpaceFeatureGroups,
} from "@/lib/taxonomy-loader";

describe("Phase 4 section editors are config-driven", () => {
  const phase4Sections = ["property", "access", "contacts", "policies", "spaces", "amenities"];

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

  it("property and access have completenessFields defined", () => {
    const property = getSectionEditor("property")!;
    expect(property.completenessFields!.length).toBeGreaterThan(0);
    const access = getSectionEditor("access")!;
    expect(access.completenessFields!.length).toBeGreaterThan(0);
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

describe("Bed types taxonomy", () => {
  it("bed types are loaded from taxonomy", () => {
    const types = getItems(bedTypes);
    expect(types.length).toBeGreaterThan(0);
  });

  it("bed types have stable IDs starting with bt.", () => {
    const types = getItems(bedTypes);
    for (const type of types) {
      expect(type.id).toMatch(/^bt\./);
    }
  });

  it("bed types have sleepingCapacity", () => {
    const types = getItems(bedTypes);
    for (const type of types) {
      expect(type.sleepingCapacity).toBeGreaterThanOrEqual(1);
    }
  });

  it("recommended bed types exist", () => {
    const types = getItems(bedTypes);
    const recommended = types.filter((t) => t.recommended);
    expect(recommended.length).toBeGreaterThan(0);
  });

  it("common bed types are findable", () => {
    expect(findItem(bedTypes, "bt.single")).toBeDefined();
    expect(findItem(bedTypes, "bt.double")).toBeDefined();
    expect(findItem(bedTypes, "bt.king")).toBeDefined();
    expect(findItem(bedTypes, "bt.crib")).toBeDefined();
  });
});

describe("Space features taxonomy", () => {
  it("space feature groups are loaded from taxonomy", () => {
    expect(spaceFeatures.groups.length).toBeGreaterThan(0);
  });

  it("all groups have at least one field", () => {
    for (const group of spaceFeatures.groups) {
      expect(group.fields.length).toBeGreaterThan(0);
    }
  });

  it("all field IDs start with sf.", () => {
    for (const group of spaceFeatures.groups) {
      for (const field of group.fields) {
        expect(field.id).toMatch(/^sf\./);
      }
    }
  });

  it("all group IDs start with sfg.", () => {
    for (const group of spaceFeatures.groups) {
      expect(group.id).toMatch(/^sfg\./);
    }
  });

  it("dimensions group applies to all space types", () => {
    const dim = spaceFeatures.groups.find((g) => g.id === "sfg.dimensions");
    expect(dim).toBeDefined();
    expect(dim!.applies_to).toContain("*");
  });

  it("getSpaceFeatureGroups returns dimensions for every space type", () => {
    const types = getItems(spaceTypes);
    for (const type of types) {
      const groups = getSpaceFeatureGroups(type.id);
      const hasDimensions = groups.some((g) => g.id === "sfg.dimensions");
      expect(hasDimensions).toBe(true);
    }
  });

  it("bedroom-specific groups are returned only for sp.bedroom", () => {
    const bedroomGroups = getSpaceFeatureGroups("sp.bedroom");
    const bathroomGroups = getSpaceFeatureGroups("sp.bathroom");
    const bedroomIds = bedroomGroups.map((g) => g.id);
    const bathroomIds = bathroomGroups.map((g) => g.id);
    expect(bedroomIds).toContain("sfg.bedroom_comfort");
    expect(bathroomIds).not.toContain("sfg.bedroom_comfort");
  });

  it("kitchen groups are returned only for sp.kitchen", () => {
    const kitchenGroups = getSpaceFeatureGroups("sp.kitchen");
    const bedroomGroups = getSpaceFeatureGroups("sp.bedroom");
    const kitchenIds = kitchenGroups.map((g) => g.id);
    const bedroomIds = bedroomGroups.map((g) => g.id);
    expect(kitchenIds).toContain("sfg.kitchen_cooking");
    expect(bedroomIds).not.toContain("sfg.kitchen_cooking");
  });

  it("boolean fields have no options", () => {
    for (const group of spaceFeatures.groups) {
      for (const field of group.fields) {
        if (field.type === "boolean") {
          expect(field.options).toBeUndefined();
        }
      }
    }
  });

  it("enum and enum_multiselect fields have options", () => {
    for (const group of spaceFeatures.groups) {
      for (const field of group.fields) {
        if (field.type === "enum" || field.type === "enum_multiselect") {
          expect(field.options).toBeDefined();
          expect(field.options!.length).toBeGreaterThan(0);
        }
      }
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
