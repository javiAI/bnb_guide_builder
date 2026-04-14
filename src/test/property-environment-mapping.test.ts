import { describe, it, expect } from "vitest";
import { amenityTaxonomy, propertyEnvironments } from "@/lib/taxonomy-loader";
import { propertySchema } from "@/lib/schemas/editor.schema";

// Branch 1E — the 6 moved_to_property_attribute amenities resolve either
// to a value in property_environments.json or to a typed Property column.

const TYPED_PROPERTY_FIELDS = new Set([
  "Property.hasPrivateEntrance",
]);

describe("Property environment + attribute mapping (1E)", () => {
  const moved = amenityTaxonomy.items.filter(
    (i) => i.destination === "moved_to_property_attribute",
  );
  const envIds = new Set(propertyEnvironments.items.map((i) => i.id));

  it("exposes exactly 6 moved_to_property_attribute items (per audit)", () => {
    expect(moved.length).toBe(6);
  });

  it("every moved_to_property_attribute item has a target", () => {
    for (const item of moved) {
      expect(item.target, `${item.id} missing target`).toBeTruthy();
    }
  });

  it("every target resolves to a propertyEnvironment id or a known Property.* field", () => {
    for (const item of moved) {
      expect(item.target, `${item.id} missing target`).toBeTruthy();
      if (!item.target) continue;
      const resolved = envIds.has(item.target) || TYPED_PROPERTY_FIELDS.has(item.target);
      expect(resolved, `${item.id} → ${item.target} does not resolve`).toBe(true);
    }
  });

  it("env.waterfront + env.resort are present in property_environments.json", () => {
    expect(envIds.has("env.waterfront")).toBe(true);
    expect(envIds.has("env.resort")).toBe(true);
  });

  it("am.private_entrance maps to the typed Property.hasPrivateEntrance field", () => {
    const pe = moved.find((i) => i.id === "am.private_entrance");
    expect(pe).toBeDefined();
    expect(pe!.target).toBe("Property.hasPrivateEntrance");
  });

  it("location-type amenities map to distinct propertyEnvironment ids", () => {
    const locationAmenities = moved.filter((i) => i.id !== "am.private_entrance");
    const targets = locationAmenities.map((i) => i.target!);
    expect(new Set(targets).size).toBe(targets.length);
    for (const t of targets) expect(envIds.has(t), `${t} missing from propertyEnvironments`).toBe(true);
  });

  it("propertySchema accepts the optional hasPrivateEntrance boolean", () => {
    const base = {
      propertyNickname: "Test",
      propertyType: "pt.apartment",
      roomType: "rt.entire_place",
      layoutKey: "lk.one_bed",
      country: "España",
      city: "Madrid",
      streetAddress: "Calle Mayor 1",
      timezone: "Europe/Madrid",
      maxGuests: 2,
      maxAdults: 2,
      maxChildren: 0,
      infantsAllowed: false,
    };
    expect(propertySchema.safeParse({ ...base, hasPrivateEntrance: true }).success).toBe(true);
    expect(propertySchema.safeParse({ ...base, hasPrivateEntrance: false }).success).toBe(true);
    // Optional — omission is also valid
    expect(propertySchema.safeParse(base).success).toBe(true);
  });
});
