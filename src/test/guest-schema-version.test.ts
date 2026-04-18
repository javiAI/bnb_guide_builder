import { describe, it, expect } from "vitest";
import {
  GUIDE_TREE_SCHEMA_VERSION,
  type GuideItem,
  type GuideTree,
} from "@/lib/types/guide-tree";
import { normalizeGuideForPresentation } from "@/lib/services/guide-presentation.service";

/** Rama 10F — schema version v3 contract.
 *
 * Fresh trees carry `schemaVersion: 3`. Pre-v3 snapshots lack
 * `displayValue` / `displayFields` on items; the /g/[slug] route normalizes
 * them at serve time so the guest renderer can consume a uniform shape. */

function preV3Tree(): GuideTree {
  // Intentionally no `schemaVersion` — mirrors an old published snapshot.
  return {
    propertyId: "p-legacy",
    audience: "guest",
    generatedAt: "2026-01-15T09:00:00.000Z",
    sections: [
      {
        id: "gs.rules",
        label: "Normas de la casa",
        order: 40,
        resolverKey: "rules",
        sortBy: "taxonomy_order",
        emptyCtaDeepLink: null,
        maxVisibility: "internal",
        emptyCopyGuest: "No hay normas destacadas.",
        items: [
          {
            id: "policy.pol.smoking",
            taxonomyKey: "pol.smoking",
            label: "Fumar",
            value: "false",
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

describe("GUIDE_TREE_SCHEMA_VERSION constant", () => {
  it("is 3 at the 10F boundary", () => {
    expect(GUIDE_TREE_SCHEMA_VERSION).toBe(3);
  });
});

describe("pre-v3 snapshot normalization at serve", () => {
  it("normalizes pre-v3 items so they gain displayValue / displayFields", () => {
    const tree = preV3Tree();
    expect(tree.schemaVersion).toBeUndefined();
    const normalized = normalizeGuideForPresentation(tree, "guest");
    const item = normalized.sections[0].items[0] as GuideItem;
    expect(item.presentationType).toBe("policy");
    expect(item.displayValue).toBeDefined();
    expect(item.displayFields).toBeDefined();
  });

  it("humanizes the legacy scalar value for guest (false → 'No')", () => {
    const tree = preV3Tree();
    const normalized = normalizeGuideForPresentation(tree, "guest");
    const smoking = normalized.sections[0].items[0] as GuideItem;
    expect(smoking.displayValue).toBe("No");
  });

  it("leaves the raw `value` / `fields` intact on the tree (non-destructive)", () => {
    const tree = preV3Tree();
    const normalized = normalizeGuideForPresentation(tree, "guest");
    const smoking = normalized.sections[0].items[0] as GuideItem;
    expect(smoking.value).toBe("false");
    expect(smoking.fields).toEqual([]);
  });

  it("is idempotent on pre-v3 input (re-normalizing a normalized tree is a no-op)", () => {
    const tree = preV3Tree();
    const once = normalizeGuideForPresentation(tree, "guest");
    const twice = normalizeGuideForPresentation(once, "guest");
    expect(twice).toEqual(once);
  });
});
