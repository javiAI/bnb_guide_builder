import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EqItemRow } from "@/app/properties/[propertyId]/amenities/_components/eq-item-row";
import type { EnrichedAmenityItem } from "@/app/properties/[propertyId]/amenities/page";

// Regression for PR #107 Copilot comment: a disabled amenity with subtype
// fields must NOT render an expandable affordance. `EqGroupBand` only renders
// the detail panel when the item is enabled, so an expander on a disabled row
// would rotate the chevron with no panel ever appearing. `EqItemRow` gates the
// button on `canExpand = item.enabled && item.hasSubtype && subtypeFields > 0`.

function makeItem(overrides: Partial<EnrichedAmenityItem> = {}): EnrichedAmenityItem {
  return {
    id: "am.coffee_maker",
    label: "Cafetera de cápsulas",
    description: "Nespresso",
    recommended: false,
    importanceLevel: "standard",
    hasSubtype: true,
    subtypeFields: [
      { id: "brand", type: "text", label: "Marca", description: "Marca del aparato" },
    ],
    enabled: true,
    dbId: "inst-1",
    detailsJson: null,
    isCustomInstance: false,
    hasPhoto: false,
    hasNote: false,
    ...overrides,
  };
}

function render(item: EnrichedAmenityItem): string {
  return renderToStaticMarkup(
    <EqItemRow
      propertyId="prop-1"
      item={item}
      spaceId={null}
      isExpanded={false}
      onExpand={() => {}}
      expandKey={`${item.id}|`}
      panelId={`eq-panel-${item.id}-general`}
    />,
  );
}

describe("EqItemRow — expandable affordance gating", () => {
  it("enabled subtype row renders the expander (button + aria-expanded + aria-controls)", () => {
    const html = render(makeItem({ enabled: true }));
    expect(html).toContain("aria-expanded");
    expect(html).toContain('aria-controls="eq-panel-am.coffee_maker-general"');
    // chevron is part of the expandable <button>
    expect(html).toContain("<button");
  });

  it("disabled subtype row renders the static layout — no expander, no aria-expanded/controls", () => {
    const html = render(makeItem({ enabled: false }));
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("aria-controls");
    // No expand button toggling the panel — only the LcCheckbox button remains,
    // which carries role="checkbox" rather than the expander's aria-controls.
  });

  it("enabled item without subtype fields renders the static layout (no expander)", () => {
    const html = render(
      makeItem({ enabled: true, hasSubtype: false, subtypeFields: [] }),
    );
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("aria-controls");
  });
});

