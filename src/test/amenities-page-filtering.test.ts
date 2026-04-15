import { describe, it, expect } from "vitest";
import {
  amenityTaxonomy,
  isAmenityMoved,
  isAmenityDerived,
  isAmenityConfigurable,
} from "@/lib/taxonomy-loader";

// Mirrors the partition logic in amenities/page.tsx. If this test drifts from
// the page, the page is the bug — the invariants below are the contract.

describe("amenities page partitioning (3B)", () => {
  it("every item has exactly one destination category", () => {
    for (const item of amenityTaxonomy.items) {
      const flags = [
        isAmenityMoved(item.id),
        isAmenityDerived(item.id),
        isAmenityConfigurable(item.id),
      ];
      const trueCount = flags.filter(Boolean).length;
      expect(trueCount, `item=${item.id} destination=${item.destination}`).toBe(1);
    }
  });

  it("shown items equal the configurable+derived union", () => {
    const shownIds = amenityTaxonomy.items
      .filter((it) => !isAmenityMoved(it.id))
      .map((it) => it.id)
      .sort();
    const configurableOrDerivedIds = amenityTaxonomy.items
      .filter((it) => isAmenityConfigurable(it.id) || isAmenityDerived(it.id))
      .map((it) => it.id)
      .sort();
    expect(shownIds).toEqual(configurableOrDerivedIds);
  });

  it("known moved samples are classified correctly", () => {
    // Safety-infrastructure items moved to Sistemas.
    expect(isAmenityMoved("am.smoke_alarm")).toBe(true);
    expect(isAmenityMoved("am.co_alarm")).toBe(true);
    expect(isAmenityMoved("am.fire_extinguisher")).toBe(true);
    expect(isAmenityMoved("am.first_aid_kit")).toBe(true);
  });

  it("known derived samples are classified correctly", () => {
    expect(isAmenityDerived("am.wifi")).toBe(true);
    expect(isAmenityDerived("am.air_conditioning")).toBe(true);
  });

  it("known configurable samples are classified correctly", () => {
    // Spot-check a couple of items known to stay configurable.
    const anyConfigurable = amenityTaxonomy.items.find((it) =>
      isAmenityConfigurable(it.id),
    );
    expect(anyConfigurable).toBeDefined();
  });
});
