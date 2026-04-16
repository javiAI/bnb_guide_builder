import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/lib/renderers/guide-markdown";
import type { GuideTree } from "@/lib/types/guide-tree";

function makeTree(overrides: Partial<GuideTree> = {}): GuideTree {
  return {
    propertyId: "p1",
    audience: "guest",
    generatedAt: "2026-04-16T12:00:00.000Z",
    sections: [],
    ...overrides,
  };
}

describe("renderMarkdown — header", () => {
  it("includes propertyId, audience and generatedAt", () => {
    const md = renderMarkdown(makeTree());
    expect(md).toContain("# p1 — audiencia: guest");
    expect(md).toContain("_Generado: 2026-04-16T12:00:00.000Z_");
  });
});

describe("renderMarkdown — media + children", () => {
  it("renders media as markdown images under the item", () => {
    const md = renderMarkdown(
      makeTree({
        sections: [
          {
            id: "gs.spaces",
            label: "Espacios",
            order: 2,
            resolverKey: "spaces",
            sortBy: "explicit_order",
            emptyCtaDeepLink: null,
            maxVisibility: "internal",
            items: [
              {
                id: "s1",
                taxonomyKey: "sp.bedroom",
                label: "Dormitorio",
                value: null,
                visibility: "guest",
                deprecated: false,
                warnings: [],
                fields: [],
                media: [
                  { url: "https://cdn.example.com/1.jpg", caption: "Vista general" },
                ],
                children: [],
              },
            ],
          },
        ],
      }),
    );
    expect(md).toContain("![Vista general](https://cdn.example.com/1.jpg)");
  });

  it("renders nested children indented two spaces deeper", () => {
    const md = renderMarkdown(
      makeTree({
        sections: [
          {
            id: "gs.spaces",
            label: "Espacios",
            order: 2,
            resolverKey: "spaces",
            sortBy: "explicit_order",
            emptyCtaDeepLink: null,
            maxVisibility: "internal",
            items: [
              {
                id: "s1",
                taxonomyKey: "sp.bedroom",
                label: "Dormitorio",
                value: null,
                visibility: "guest",
                deprecated: false,
                warnings: [],
                fields: [],
                media: [],
                children: [
                  {
                    id: "a1",
                    taxonomyKey: "am.wifi",
                    label: "WiFi",
                    value: "Contraseña: xxx",
                    visibility: "guest",
                    deprecated: false,
                    warnings: [],
                    fields: [],
                    media: [],
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(md).toContain("- **Dormitorio**");
    expect(md).toContain("  - **WiFi**: Contraseña: xxx");
  });

  it("flags deprecated items", () => {
    const md = renderMarkdown(
      makeTree({
        sections: [
          {
            id: "gs.amenities",
            label: "Equipamiento",
            order: 3,
            resolverKey: "amenities",
            sortBy: "taxonomy_order",
            emptyCtaDeepLink: null,
            maxVisibility: "internal",
            items: [
              {
                id: "a1",
                taxonomyKey: "am.unknown",
                label: "am.unknown",
                value: null,
                visibility: "guest",
                deprecated: true,
                warnings: ["unknown amenity key"],
                fields: [],
                media: [],
                children: [],
              },
            ],
          },
        ],
      }),
    );
    expect(md).toContain("- **am.unknown** _(deprecated)_");
  });

  it("empty section with CTA renders it in the empty marker", () => {
    const md = renderMarkdown(
      makeTree({
        audience: "internal",
        sections: [
          {
            id: "gs.arrival",
            label: "Llegada",
            order: 1,
            resolverKey: "arrival",
            sortBy: "explicit_order",
            emptyCtaDeepLink: "/properties/p1/edit",
            maxVisibility: "internal",
            items: [],
          },
        ],
      }),
    );
    expect(md).toContain("_Sin elementos. /properties/p1/edit_");
  });
});
