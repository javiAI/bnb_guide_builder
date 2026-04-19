import { describe, it, expect } from "vitest";
import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";
import { buildGuideSearchIndex } from "@/lib/services/guide-search-index.service";

function item(partial: Partial<GuideItem> & Pick<GuideItem, "id" | "label">): GuideItem {
  return {
    taxonomyKey: null,
    value: null,
    visibility: "guest",
    deprecated: false,
    warnings: [],
    fields: [],
    media: [],
    children: [],
    presentationType: "generic_text",
    displayValue: partial.value ?? "",
    displayFields: (partial.fields ?? []).map((f) => ({
      label: f.label,
      displayValue: f.value,
      visibility: f.visibility,
    })),
    ...partial,
  };
}

function guestTree(sections: GuideTree["sections"]): GuideTree {
  return {
    schemaVersion: 3,
    propertyId: "p-search-test",
    audience: "guest",
    generatedAt: "2026-04-19T00:00:00.000Z",
    sections,
  };
}

describe("buildGuideSearchIndex", () => {
  it("refuses non-guest trees", () => {
    const tree = { ...guestTree([]), audience: "internal" } as GuideTree;
    expect(() => buildGuideSearchIndex(tree)).toThrow(/audience="guest"/);
  });

  it("includes top-level items with label + snippet + section keywords", () => {
    const tree = guestTree([
      {
        id: "gs.amenities",
        label: "Equipamiento",
        order: 30,
        resolverKey: "amenities",
        sortBy: "recommended_first",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        items: [
          item({
            id: "am.wifi",
            taxonomyKey: "am.wifi",
            label: "Wi-Fi",
            value: "Red CasaClaudia",
            fields: [
              { label: "Contraseña", value: "welcome2026", visibility: "guest" },
            ],
          }),
        ],
      },
    ]);
    const index = buildGuideSearchIndex(tree);
    expect(index.entries).toHaveLength(1);
    const entry = index.entries[0];
    expect(entry.id).toBe("item-am.wifi");
    expect(entry.anchor).toBe("item-am.wifi");
    expect(entry.sectionId).toBe("gs.amenities");
    expect(entry.sectionLabel).toBe("Equipamiento");
    expect(entry.label).toBe("Wi-Fi");
    expect(entry.snippet).toContain("Red CasaClaudia");
    expect(entry.snippet).toContain("welcome2026");
    // Section keywords from taxonomy (contains "wifi", "parking", etc.)
    expect(entry.keywords).toMatch(/wifi/);
    expect(entry.keywords).toMatch(/parking/);
  });

  it("drops items with presentationType='raw'", () => {
    const tree = guestTree([
      {
        id: "gs.amenities",
        label: "Equipamiento",
        order: 30,
        resolverKey: "amenities",
        sortBy: "recommended_first",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        items: [
          item({ id: "am.visible", label: "Visible", value: "shown" }),
          item({
            id: "am.sentinel",
            taxonomyKey: "unknown.prefix",
            label: "Sentinel",
            value: "hidden",
            presentationType: "raw",
          }),
        ],
      },
    ]);
    const index = buildGuideSearchIndex(tree);
    expect(index.entries.map((e) => e.id)).toEqual(["item-am.visible"]);
  });

  it("flattens children into their own entries with parent-scoped anchors", () => {
    const tree = guestTree([
      {
        id: "gs.spaces",
        label: "Espacios",
        order: 20,
        resolverKey: "spaces",
        sortBy: "taxonomy_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        items: [
          item({
            id: "sp.bathroom",
            label: "Baño",
            value: "Planta 1",
            children: [
              item({ id: "towels", label: "Toallas", value: "En el armario" }),
              item({ id: "shampoo", label: "Champú", value: "Bajo el lavabo" }),
            ],
          }),
        ],
      },
    ]);
    const index = buildGuideSearchIndex(tree);
    expect(index.entries).toHaveLength(3);
    const parent = index.entries.find((e) => e.id === "item-sp.bathroom");
    const firstChild = index.entries.find((e) => e.id === "child-sp.bathroom-0");
    const secondChild = index.entries.find((e) => e.id === "child-sp.bathroom-1");
    expect(parent?.anchor).toBe("item-sp.bathroom");
    expect(firstChild?.anchor).toBe("item-sp.bathroom--child-0");
    expect(firstChild?.label).toBe("Toallas");
    expect(secondChild?.anchor).toBe("item-sp.bathroom--child-1");
    expect(secondChild?.label).toBe("Champú");
  });

  it("dedupes essentials clones with synthetic prefix to the canonical section", () => {
    // Mirror production id shape: `resolveEssentials` stamps
    // `essentials.<resolverKey>.<originalId>` when it clones an item into
    // the hero. The dedup MUST normalize against the canonical id, not the
    // synthetic one — otherwise the search shows duplicates and Enter
    // scrolls to the hero clone instead of the canonical section.
    const wifiCanonical = item({
      id: "am.wifi",
      taxonomyKey: "am.wifi",
      label: "Wi-Fi",
      value: "Red CasaClaudia",
    });
    const wifiCloned = item({
      ...wifiCanonical,
      id: "essentials.amenities.am.wifi",
    });
    const tree = guestTree([
      {
        id: "gs.essentials",
        label: "Esenciales",
        order: 5,
        resolverKey: "essentials",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        isAggregator: true,
        sourceResolverKeys: ["amenities"],
        items: [wifiCloned],
      },
      {
        id: "gs.amenities",
        label: "Equipamiento",
        order: 30,
        resolverKey: "amenities",
        sortBy: "recommended_first",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        items: [wifiCanonical],
      },
    ]);
    const index = buildGuideSearchIndex(tree);
    const wifiEntries = index.entries.filter((e) => e.id === "item-am.wifi");
    expect(wifiEntries).toHaveLength(1);
    expect(wifiEntries[0].sectionId).toBe("gs.amenities");
    expect(wifiEntries[0].sectionLabel).toBe("Equipamiento");
    expect(wifiEntries[0].anchor).toBe("item-am.wifi");
    // No entry ever keeps the synthetic id — anchor goes home, not to hero.
    expect(
      index.entries.find((e) => e.id === "item-essentials.amenities.am.wifi"),
    ).toBeUndefined();
  });

  it("essentials clone survives when the canonical section has no entry for it", () => {
    // Edge case: if an item is essential-only (no canonical section contains
    // it), the clone must still end up in the index — but under its
    // canonical id and pointing at the canonical-shaped anchor.
    const orphan = item({
      id: "essentials.amenities.am.heater",
      taxonomyKey: "am.heater",
      label: "Calefacción",
      value: "Radiadores",
    });
    const tree = guestTree([
      {
        id: "gs.essentials",
        label: "Esenciales",
        order: 5,
        resolverKey: "essentials",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        isAggregator: true,
        sourceResolverKeys: ["amenities"],
        items: [orphan],
      },
    ]);
    const index = buildGuideSearchIndex(tree);
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0].id).toBe("item-am.heater");
    expect(index.entries[0].anchor).toBe("item-am.heater");
  });

  it("buildVersion is stable for identical input", () => {
    const sections: GuideTree["sections"] = [
      {
        id: "gs.amenities",
        label: "Equipamiento",
        order: 30,
        resolverKey: "amenities",
        sortBy: "recommended_first",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        items: [item({ id: "am.wifi", label: "Wi-Fi", value: "x" })],
      },
    ];
    const a = buildGuideSearchIndex(guestTree(sections));
    const b = buildGuideSearchIndex(guestTree(sections));
    expect(a.buildVersion).toBe(b.buildVersion);
    expect(a.buildVersion).toHaveLength(12);
  });

  it("buildVersion changes when entries diverge", () => {
    const base = guestTree([
      {
        id: "gs.amenities",
        label: "Equipamiento",
        order: 30,
        resolverKey: "amenities",
        sortBy: "recommended_first",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        items: [item({ id: "am.wifi", label: "Wi-Fi", value: "x" })],
      },
    ]);
    const changed: GuideTree = {
      ...base,
      sections: [
        {
          ...base.sections[0],
          items: [
            item({ id: "am.wifi", label: "Wi-Fi", value: "x" }),
            item({ id: "am.parking", label: "Parking", value: "y" }),
          ],
        },
      ],
    };
    expect(buildGuideSearchIndex(base).buildVersion).not.toBe(
      buildGuideSearchIndex(changed).buildVersion,
    );
  });

  it("snippet truncates at 160 chars with ellipsis", () => {
    const longValue = "a".repeat(400);
    const tree = guestTree([
      {
        id: "gs.howto",
        label: "Cómo usar",
        order: 25,
        resolverKey: "howto",
        sortBy: "taxonomy_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        items: [item({ id: "howto.washer", label: "Lavadora", value: longValue })],
      },
    ]);
    const [entry] = buildGuideSearchIndex(tree).entries;
    expect(entry.snippet.length).toBeLessThanOrEqual(160);
    expect(entry.snippet.endsWith("…")).toBe(true);
  });
});
