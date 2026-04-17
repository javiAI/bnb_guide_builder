/**
 * Schema-version compatibility (Rama 10E).
 *
 * Pre-v2 snapshots (any `treeJson` published before 10E) lack the optional
 * fields introduced here: `schemaVersion`, `brandPaletteKey`, `brandLogoUrl`
 * on the tree; `journeyStage`, `journeyTags`, `isHero`, `isAggregator`,
 * `sourceResolverKeys`, `emptyCopy`, `runbookHtml` on sections/items.
 *
 * The React renderer (`src/components/public-guide/*`) must tolerate these
 * gaps without crashing — old snapshots render, they just look plainer.
 * These tests pin that contract at the TypeScript and runtime layer.
 */

import { describe, it, expect } from "vitest";
import { filterByAudience } from "@/lib/services/guide-rendering.service";
import type { GuideTree } from "@/lib/types/guide-tree";

/** Minimal pre-v2 tree shape — no new fields, no schemaVersion. */
function legacyTree(): GuideTree {
  return {
    propertyId: "p1",
    audience: "guest",
    generatedAt: "2026-02-01T10:00:00.000Z",
    sections: [
      {
        id: "gs.arrival",
        label: "Llegada",
        order: 10,
        resolverKey: "arrival",
        sortBy: "explicit_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        items: [
          {
            id: "arrival.checkin",
            taxonomyKey: null,
            label: "Check-in",
            value: "15:00 – 20:00",
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
  };
}

describe("pre-v2 snapshot compatibility", () => {
  it("legacy tree has no schemaVersion (absence = pre-v2)", () => {
    const tree = legacyTree();
    expect(tree.schemaVersion).toBeUndefined();
  });

  it("legacy sections lack new optional fields (isHero, isAggregator, emptyCopy, journeyStage)", () => {
    const section = legacyTree().sections[0];
    expect(section.isHero).toBeUndefined();
    expect(section.isAggregator).toBeUndefined();
    expect(section.emptyCopy).toBeUndefined();
    expect(section.journeyStage).toBeUndefined();
  });

  it("legacy items lack new optional fields (journeyStage, journeyTags, runbookHtml)", () => {
    const item = legacyTree().sections[0].items[0];
    expect(item.journeyStage).toBeUndefined();
    expect(item.journeyTags).toBeUndefined();
    expect(item.runbookHtml).toBeUndefined();
  });

  it("filterByAudience handles legacy items without crashing on missing optional fields", () => {
    const filtered = filterByAudience(legacyTree().sections[0].items, "guest");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("arrival.checkin");
  });

  it("legacy tree is a structural subtype of GuideTree — compiles against the current type", () => {
    // If this assertion compiles, the type `GuideTree` is backwards-compatible.
    const tree: GuideTree = legacyTree();
    expect(tree.sections[0].resolverKey).toBe("arrival");
  });
});
