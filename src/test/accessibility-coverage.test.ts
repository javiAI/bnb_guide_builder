import { describe, it, expect } from "vitest";
import {
  amenityTaxonomy,
  accessibilityFeatures,
  parkingOptions,
} from "@/lib/taxonomy-loader";

// Branch 1D — accessibility + parking audit.
// Every amenity with destination=moved_to_access must resolve to a real item
// in either accessibility_features.json or parking_options.json.

describe("Accessibility + parking coverage (1D)", () => {
  const movedToAccess = amenityTaxonomy.items.filter(
    (i) => i.destination === "moved_to_access",
  );

  const accessibilityIds = new Set(accessibilityFeatures.items.map((i) => i.id));
  const parkingIds = new Set(parkingOptions.items.map((i) => i.id));

  it("every moved_to_access amenity has a target", () => {
    expect(movedToAccess.length).toBeGreaterThan(0);
    for (const item of movedToAccess) {
      expect(item.target, `${item.id} missing target`).toBeTruthy();
    }
  });

  it("every target resolves to a real item in accessibility_features or parking_options", () => {
    for (const item of movedToAccess) {
      const target = item.target!;
      const resolved = target.startsWith("pk.")
        ? parkingIds.has(target)
        : accessibilityIds.has(target);
      expect(resolved, `${item.id} → ${target} does not resolve`).toBe(true);
    }
  });

  it("every ax.* amenity in the audit round-trips to an accessibility_features item with matching id", () => {
    const axAmenities = movedToAccess.filter((i) => i.id.startsWith("ax."));
    // spec promises 13 ax.* items migrated to accessibility_features
    expect(axAmenities.length).toBe(13);
    for (const item of axAmenities) {
      expect(item.target).toBe(item.id);
      expect(accessibilityIds.has(item.id), `${item.id} not in accessibility_features`).toBe(true);
    }
  });

  it("parking variants map to distinct parking_options items", () => {
    const parkingAmenities = movedToAccess.filter((i) =>
      i.id.startsWith("am.") && i.target?.startsWith("pk."),
    );
    expect(parkingAmenities.length).toBe(4);
    const targets = parkingAmenities.map((i) => i.target!);
    // No duplicates — each amenity maps to a distinct pk.* item
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("am.single_level_home maps to ax.single_level_home in accessibility_features", () => {
    const single = amenityTaxonomy.items.find((i) => i.id === "am.single_level_home");
    expect(single).toBeDefined();
    expect(single!.destination).toBe("moved_to_access");
    expect(single!.target).toBe("ax.single_level_home");
    expect(accessibilityIds.has("ax.single_level_home")).toBe(true);
  });

  it("accessibility_features.json covers all ax.* ids present as moved_to_access amenities", () => {
    const required = movedToAccess
      .filter((i) => i.id.startsWith("ax."))
      .map((i) => i.id);
    for (const id of required) {
      expect(accessibilityIds.has(id), `${id} missing from accessibility_features.json`).toBe(true);
    }
  });
});
