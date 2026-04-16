import { describe, it, expect } from "vitest";
import { filterByAudience } from "@/lib/services/guide-rendering.service";
import { renderHtml } from "@/lib/renderers/guide-html";
import type { GuideTree, GuideItem } from "@/lib/types/guide-tree";

function makeItem(overrides: Partial<GuideItem> = {}): GuideItem {
  return {
    id: "item-1",
    taxonomyKey: null,
    label: "Test item",
    value: null,
    visibility: "guest",
    deprecated: false,
    warnings: [],
    fields: [],
    media: [],
    children: [],
    ...overrides,
  };
}

function makeTree(items: GuideItem[]): GuideTree {
  return {
    propertyId: "p1",
    audience: "internal",
    generatedAt: new Date().toISOString(),
    sections: [
      {
        id: "gs.test",
        label: "Test Section",
        order: 1,
        resolverKey: "arrival",
        sortBy: "taxonomy_order",
        emptyCtaDeepLink: "/properties/p1/arrival",
        maxVisibility: "internal",
        items,
      },
    ],
  };
}

describe("Public guide render — audience filtering", () => {
  it("guest items pass through filterByAudience('guest')", () => {
    const items = [makeItem({ visibility: "guest", label: "Visible" })];
    const filtered = filterByAudience(items, "guest");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].label).toBe("Visible");
  });

  it("internal items are excluded for guest audience", () => {
    const items = [makeItem({ visibility: "internal", label: "Hidden" })];
    const filtered = filterByAudience(items, "guest");
    expect(filtered).toHaveLength(0);
  });

  it("sensitive items are excluded for guest audience", () => {
    const items = [makeItem({ visibility: "sensitive", label: "Secret" })];
    const filtered = filterByAudience(items, "guest");
    expect(filtered).toHaveLength(0);
  });

  it("internal fields within a guest item are stripped", () => {
    const items = [
      makeItem({
        visibility: "guest",
        fields: [
          { label: "Public field", value: "ok", visibility: "guest" },
          { label: "Internal field", value: "hidden", visibility: "internal" },
        ],
      }),
    ];
    const filtered = filterByAudience(items, "guest");
    expect(filtered[0].fields).toHaveLength(1);
    expect(filtered[0].fields[0].label).toBe("Public field");
  });

  it("internal children within a guest item are stripped", () => {
    const items = [
      makeItem({
        visibility: "guest",
        children: [
          makeItem({ visibility: "guest", label: "Child visible" }),
          makeItem({ visibility: "internal", label: "Child hidden" }),
        ],
      }),
    ];
    const filtered = filterByAudience(items, "guest");
    expect(filtered[0].children).toHaveLength(1);
    expect(filtered[0].children[0].label).toBe("Child visible");
  });
});

describe("Public guide render — HTML output safety", () => {
  it("rendered HTML for guest tree never contains internal or sensitive content", () => {
    const items = [
      makeItem({ visibility: "guest", label: "Check-in", value: "14:00" }),
      makeItem({ visibility: "internal", label: "Internal note", value: "secret-stuff" }),
      makeItem({ visibility: "sensitive", label: "Key code", value: "1234#" }),
    ];
    const tree = makeTree(items);

    // Simulate public page flow: filter to guest, then render
    const guestSections = tree.sections.map((s) => ({
      ...s,
      emptyCtaDeepLink: null,
      items: filterByAudience(s.items, "guest"),
    }));
    const guestTree: GuideTree = { ...tree, audience: "guest", sections: guestSections };
    const html = renderHtml(guestTree);

    expect(html).toContain("Check-in");
    expect(html).not.toContain("Internal note");
    expect(html).not.toContain("secret-stuff");
    expect(html).not.toContain("Key code");
    expect(html).not.toContain("1234#");
  });

  it("host-panel deep links are never present in guest-filtered output", () => {
    const tree = makeTree([makeItem({ visibility: "guest" })]);
    const guestSections = tree.sections.map((s) => ({
      ...s,
      emptyCtaDeepLink: null,
      items: filterByAudience(s.items, "guest"),
    }));
    const guestTree: GuideTree = { ...tree, audience: "guest", sections: guestSections };
    const html = renderHtml(guestTree);

    expect(html).not.toContain("/properties/p1/arrival");
  });
});
