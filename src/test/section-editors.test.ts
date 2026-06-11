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
      // Cribs (bt.crib) have capacity 0 — they don't count as adult guest slots
      const min = type.id === "bt.crib" ? 0 : 1;
      expect(type.sleepingCapacity).toBeGreaterThanOrEqual(min);
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

  // After the 16I lean redesign, the space editor keeps only INTRINSIC feature
  // groups; amenity-/system-backed groups (heating, cooling, appliances,
  // entertainment, supplies, connectivity…) were pruned and now live in
  // Equipamiento / Sistemas (coverage). These assertions track that contract.
  it("bedroom-specific intrinsic groups are returned only for sp.bedroom", () => {
    const bedroomGroups = getSpaceFeatureGroups("sp.bedroom");
    const bathroomGroups = getSpaceFeatureGroups("sp.bathroom");
    const bedroomIds = bedroomGroups.map((g) => g.id);
    const bathroomIds = bathroomGroups.map((g) => g.id);
    expect(bedroomIds).toContain("sfg.bedroom_storage");
    expect(bedroomIds).toContain("sfg.bedroom_privacy");
    expect(bedroomIds).toContain("sfg.bedroom_views");
    expect(bathroomIds).not.toContain("sfg.bedroom_storage");
    // Climate is a system now — pruned from space features.
    expect(bedroomIds).not.toContain("sfg.bedroom_heating");
    expect(bedroomIds).not.toContain("sfg.bedroom_cooling");
  });

  // En-suite parity: the bedroom's "Baño en suite" group mirrors the full
  // bathroom fixtures catalog via include_fields_from (single source). The
  // loader injects the toggle gate into included fields without a shown_if;
  // fields with their own trigger keep it (the editor cascades visibility).
  it("sfg.ensuite_bathroom includes every sfg.bathroom_fixtures field, gated by the toggle", () => {
    const bedroomGroups = getSpaceFeatureGroups("sp.bedroom");
    const ensuite = bedroomGroups.find((g) => g.id === "sfg.ensuite_bathroom");
    const fixtures = getSpaceFeatureGroups("sp.bathroom").find((g) => g.id === "sfg.bathroom_fixtures");
    expect(ensuite).toBeDefined();
    expect(fixtures).toBeDefined();
    expect(ensuite!.fields[0].id).toBe("sf.en_suite_bathroom");
    const ensuiteById = new Map(ensuite!.fields.map((f) => [f.id, f]));
    for (const f of fixtures!.fields) {
      const mirrored = ensuiteById.get(f.id);
      expect(mirrored, `${f.id} missing from ensuite include`).toBeDefined();
      if (f.shown_if) {
        expect(mirrored!.shown_if).toEqual(f.shown_if);
      } else {
        expect(mirrored!.shown_if).toEqual({ field: "sf.en_suite_bathroom", equals: true });
      }
    }
  });

  it("living room intrinsic groups are returned for sp.living_room", () => {
    const livingGroups = getSpaceFeatureGroups("sp.living_room");
    const bathroomGroups = getSpaceFeatureGroups("sp.bathroom");
    const livingIds = livingGroups.map((g) => g.id);
    const bathroomIds = bathroomGroups.map((g) => g.id);
    expect(livingIds).toContain("sfg.living_seating");
    // Light merged into one "Luz y ambiente" group (16I-4 coherence pass);
    // views/orientation got their own structured group mirroring the bedroom.
    expect(livingIds).not.toContain("sfg.living_light");
    expect(livingIds).toContain("sfg.living_ambience");
    expect(livingIds).toContain("sfg.living_views");
    expect(bathroomIds).not.toContain("sfg.living_seating");
    // Entertainment → amenities; comfort (heating/AC) → systems.
    expect(livingIds).not.toContain("sfg.living_entertainment");
    expect(livingIds).not.toContain("sfg.living_comfort");
  });

  it("kitchen intrinsic groups are returned for sp.kitchen and not for sp.bedroom", () => {
    const kitchenGroups = getSpaceFeatureGroups("sp.kitchen");
    const bedroomGroups = getSpaceFeatureGroups("sp.bedroom");
    const kitchenIds = kitchenGroups.map((g) => g.id);
    const bedroomIds = bedroomGroups.map((g) => g.id);
    // Equipment (appliances + cooking, incl. hob-type reveal) is one group; layout stays separate.
    expect(kitchenIds).toContain("sfg.kitchen_equipment");
    expect(kitchenIds).toContain("sfg.kitchen_layout");
    expect(bedroomIds).not.toContain("sfg.kitchen_equipment");
    // Merged-away + amenity-backed groups must not reappear.
    expect(kitchenIds).not.toContain("sfg.kitchen_type");
    expect(kitchenIds).not.toContain("sfg.kitchen_cooking");
    expect(kitchenIds).not.toContain("sfg.kitchen_appliances");
    expect(kitchenIds).not.toContain("sfg.kitchen_utensils");
  });

  it("bathroom intrinsic groups are returned only for sp.bathroom", () => {
    const bathroomGroups = getSpaceFeatureGroups("sp.bathroom");
    const bedroomGroups = getSpaceFeatureGroups("sp.bedroom");
    const bathroomIds = bathroomGroups.map((g) => g.id);
    const bedroomIds = bedroomGroups.map((g) => g.id);
    expect(bathroomIds).toContain("sfg.bathroom_fixtures");
    // Access type folded into accessibility ("Acceso y accesibilidad"); the
    // lonely "Tipo y acceso" group is gone.
    expect(bathroomIds).toContain("sfg.bathroom_accessibility");
    expect(bathroomIds).not.toContain("sfg.bathroom_type");
    expect(bedroomIds).not.toContain("sfg.bathroom_accessibility");
    // Equipment + supplies → amenities.
    expect(bathroomIds).not.toContain("sfg.bathroom_equipment");
    expect(bathroomIds).not.toContain("sfg.bathroom_supplies");
  });

  it("dining groups include atmosphere and table", () => {
    const diningGroups = getSpaceFeatureGroups("sp.dining");
    const diningIds = diningGroups.map((g) => g.id);
    expect(diningIds).toContain("sfg.dining_table");
    expect(diningIds).toContain("sfg.dining_atmosphere");
  });

  it("studio and loft get studio_layout group", () => {
    const studioGroups = getSpaceFeatureGroups("sp.studio");
    const loftGroups = getSpaceFeatureGroups("sp.loft");
    const bathroomGroups = getSpaceFeatureGroups("sp.bathroom");
    expect(studioGroups.map((g) => g.id)).toContain("sfg.studio_layout");
    expect(loftGroups.map((g) => g.id)).toContain("sfg.studio_layout");
    expect(bathroomGroups.map((g) => g.id)).not.toContain("sfg.studio_layout");
  });

  it("office gets the intrinsic workspace group (connectivity → systems)", () => {
    const officeGroups = getSpaceFeatureGroups("sp.office");
    const officeIds = officeGroups.map((g) => g.id);
    expect(officeIds).toContain("sfg.office_workspace");
    expect(officeIds).not.toContain("sfg.office_connectivity");
  });

  it("laundry no longer carries appliance groups (washer/dryer/iron → amenities)", () => {
    const laundryGroups = getSpaceFeatureGroups("sp.laundry");
    const laundryIds = laundryGroups.map((g) => g.id);
    // Laundry is defined by its appliances (amenities) + systems; intrinsically
    // it only inherits the universal dimensions group.
    expect(laundryIds).toContain("sfg.dimensions");
    expect(laundryIds).not.toContain("sfg.laundry_appliances");
    expect(laundryIds).not.toContain("sfg.laundry_ironing");
  });

  it("outdoor spaces get setup and environment groups", () => {
    const balconyGroups = getSpaceFeatureGroups("sp.balcony");
    const gardenGroups = getSpaceFeatureGroups("sp.garden");
    const balconyIds = balconyGroups.map((g) => g.id);
    const gardenIds = gardenGroups.map((g) => g.id);
    expect(balconyIds).toContain("sfg.outdoor_setup");
    expect(balconyIds).toContain("sfg.outdoor_environment");
    expect(gardenIds).toContain("sfg.garden_features");
    expect(balconyIds).not.toContain("sfg.garden_features");
  });

  it("pool gets all three pool groups", () => {
    const poolGroups = getSpaceFeatureGroups("sp.pool");
    const poolIds = poolGroups.map((g) => g.id);
    expect(poolIds).toContain("sfg.pool_features");
    expect(poolIds).toContain("sfg.pool_safety");
    expect(poolIds).toContain("sfg.pool_area");
  });

  it("shared_area gets the intrinsic access group (services → amenities)", () => {
    const sharedGroups = getSpaceFeatureGroups("sp.shared_area");
    const sharedIds = sharedGroups.map((g) => g.id);
    expect(sharedIds).toContain("sfg.shared_access");
    expect(sharedIds).not.toContain("sfg.shared_amenities");
  });

  it("sp.other gets generic description group", () => {
    const otherGroups = getSpaceFeatureGroups("sp.other");
    const otherIds = otherGroups.map((g) => g.id);
    expect(otherIds).toContain("sfg.other_space_details");
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
    // pool and coffee_maker should have subtypes (am.wifi is derived → no subtype)
    const poolSubtype = findSubtype("am.pool");
    expect(poolSubtype).toBeDefined();
    expect(poolSubtype!.fields.length).toBeGreaterThan(0);

    const coffeeSubtype = findSubtype("am.coffee_maker");
    expect(coffeeSubtype).toBeDefined();
    expect(coffeeSubtype!.fields.length).toBeGreaterThan(0);
  });
});
