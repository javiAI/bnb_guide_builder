import { describe, it, expect } from "vitest";
import {
  propertyTypes,
  roomTypes,
  spaceTypes,
  accessMethods,
  policyTaxonomy,
  amenityTaxonomy,
  amenitySubtypes,
  troubleshootingTaxonomy,
  messagingTouchpoints,
  guideOutputs,
  visibilityLevels,
  mediaRequirements,
  dynamicFieldRules,
  automationChannels,
  mediaAssetRoles,
  reviewReasons,
  parkingOptions,
  accessibilityFeatures,
  propertyEnvironments,
  getItems,
  findItem,
  getRecommendedItems,
  getAmenityGroups,
  getAmenityGroupItems,
  getPolicyGroups,
  getPolicyItems,
  findSubtype,
  getRulesForTrigger,
  evaluateRule,
  findSystemItem,
  findSystemSubtype,
  getSystemGroups,
} from "@/lib/taxonomy-loader";

describe("Taxonomy loaders", () => {
  it("loads all 19 taxonomies without error", () => {
    expect(propertyTypes.file).toBe("property_types.json");
    expect(roomTypes.file).toBe("room_types.json");
    expect(spaceTypes.file).toBe("space_types.json");
    expect(accessMethods.file).toBe("access_methods.json");
    expect(policyTaxonomy.file).toBe("policy_taxonomy.json");
    expect(amenityTaxonomy.file).toBe("amenity_taxonomy.json");
    expect(amenitySubtypes.file).toBe("amenity_subtypes.json");
    expect(troubleshootingTaxonomy.file).toBe("troubleshooting_taxonomy.json");
    expect(messagingTouchpoints.file).toBe("messaging_touchpoints.json");
    expect(guideOutputs.file).toBe("guide_outputs.json");
    expect(visibilityLevels.file).toBe("visibility_levels.json");
    expect(mediaRequirements.file).toBe("media_requirements.json");
    expect(dynamicFieldRules.file).toBe("dynamic_field_rules.json");
    expect(automationChannels.file).toBe("automation_channels.json");
    expect(mediaAssetRoles.file).toBe("media_asset_roles.json");
    expect(reviewReasons.file).toBe("review_reasons.json");
    expect(parkingOptions.file).toBe("parking_options.json");
    expect(accessibilityFeatures.file).toBe("accessibility_features.json");
    expect(propertyEnvironments.file).toBe("property_environments.json");
  });

  it("all taxonomies use es-ES locale", () => {
    const all = [
      propertyTypes, roomTypes, spaceTypes, accessMethods,
      policyTaxonomy, amenityTaxonomy, amenitySubtypes,
      troubleshootingTaxonomy, messagingTouchpoints, guideOutputs,
      visibilityLevels, mediaRequirements, dynamicFieldRules,
      automationChannels, mediaAssetRoles, reviewReasons,
      parkingOptions, accessibilityFeatures, propertyEnvironments,
    ];
    all.forEach((t) => expect(t.locale).toBe("es-ES"));
  });

  it("all taxonomies use metric units", () => {
    expect(propertyTypes.units_system).toBe("metric");
    expect(roomTypes.units_system).toBe("metric");
  });

  it("getItems returns items from an item taxonomy", () => {
    const items = getItems(propertyTypes);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toMatch(/^pt\./);
  });

  it("findItem finds by id", () => {
    const apt = findItem(propertyTypes, "pt.apartment");
    expect(apt).toBeDefined();
    expect(apt!.label).toBe("Apartamento");
  });

  it("getRecommendedItems filters recommended only", () => {
    const rec = getRecommendedItems(propertyTypes);
    rec.forEach((item) => expect(item.recommended).toBe(true));
  });

  it("getAmenityGroups returns amenity groups", () => {
    const groups = getAmenityGroups(amenityTaxonomy);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].id).toMatch(/^ag\./);
  });

  it("getAmenityGroupItems returns items for a group", () => {
    const items = getAmenityGroupItems(amenityTaxonomy, "ag.popular");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toMatch(/^am\./);
  });

  it("getPolicyGroups returns policy groups", () => {
    const groups = getPolicyGroups(policyTaxonomy);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].id).toMatch(/^pol\./);
  });

  it("getPolicyItems returns all policy items flat", () => {
    const items = getPolicyItems(policyTaxonomy);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toMatch(/^pol\./);
  });

  it("findSubtype returns subtype config for an amenity", () => {
    const sub = findSubtype("am.coffee_maker");
    expect(sub).toBeDefined();
    expect(sub!.fields.length).toBeGreaterThan(0);
  });

  it("getRulesForTrigger returns matching rules", () => {
    const rules = getRulesForTrigger("arrival.access.method");
    expect(rules.length).toBeGreaterThan(0);
  });

  it("evaluateRule checks equals condition (string)", () => {
    const rules = getRulesForTrigger("arrival.access.method");
    const smartLockRule = rules.find((r) => r.id === "dfr.access_smart_lock")!;
    expect(evaluateRule(smartLockRule, "am.smart_lock")).toBe(true);
    expect(evaluateRule(smartLockRule, "am.lockbox")).toBe(false);
  });

  it("getSystemGroups returns system groups", () => {
    const groups = getSystemGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].id).toMatch(/^sgrp\./);
  });

  it("findSystemItem finds by id", () => {
    const item = findSystemItem("sys.internet");
    expect(item).toBeDefined();
    expect(item!.label).toBeTruthy();
  });

  it("findSystemItem returns undefined for unknown id", () => {
    expect(findSystemItem("sys.nonexistent")).toBeUndefined();
  });

  it("findSystemSubtype finds by systemKey", () => {
    const subtype = findSystemSubtype("sys.internet");
    expect(subtype).toBeDefined();
    expect(subtype!.systemKey).toBe("sys.internet");
  });

  it("findSystemSubtype finds by id", () => {
    const subtype = findSystemSubtype("sys.internet");
    expect(subtype).toBeDefined();
    // id field should also match
    const byId = findSystemSubtype(subtype!.id);
    expect(byId).toBeDefined();
    expect(byId!.systemKey).toBe("sys.internet");
  });

  it("findSystemSubtype returns undefined for unknown key", () => {
    expect(findSystemSubtype("sys.nonexistent")).toBeUndefined();
  });
});
