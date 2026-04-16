import { describe, it, expect } from "vitest";
import { computeGuideDiff } from "@/lib/services/guide-diff.service";
import type { GuideTree, GuideSection, GuideItem } from "@/lib/types/guide-tree";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function makeItem(overrides: Partial<GuideItem> & { id: string; label: string }): GuideItem {
  return {
    taxonomyKey: null,
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

function makeSection(overrides: Partial<GuideSection> & { id: string; label: string }): GuideSection {
  return {
    order: 0,
    resolverKey: "arrival",
    sortBy: "taxonomy_order",
    emptyCtaDeepLink: null,
    maxVisibility: "guest",
    items: [],
    ...overrides,
  };
}

function makeTree(sections: GuideSection[]): GuideTree {
  return {
    propertyId: "test-property",
    audience: "internal",
    generatedAt: new Date().toISOString(),
    sections,
  };
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("computeGuideDiff", () => {
  it("returns empty diff for identical trees", () => {
    const section = makeSection({
      id: "s1",
      label: "Llegada",
      items: [makeItem({ id: "i1", label: "Check-in" })],
    });
    const tree = makeTree([section]);
    const diff = computeGuideDiff(tree, tree);

    expect(diff.stats.itemsAdded).toBe(0);
    expect(diff.stats.itemsRemoved).toBe(0);
    expect(diff.stats.itemsChanged).toBe(0);
    expect(diff.stats.sectionsAdded).toBe(0);
    expect(diff.stats.sectionsRemoved).toBe(0);
  });

  it("detects added items", () => {
    const oldTree = makeTree([
      makeSection({ id: "s1", label: "Espacios", items: [] }),
    ]);
    const newTree = makeTree([
      makeSection({
        id: "s1",
        label: "Espacios",
        items: [makeItem({ id: "i1", label: "Sala de estar" })],
      }),
    ]);
    const diff = computeGuideDiff(oldTree, newTree);

    expect(diff.stats.itemsAdded).toBe(1);
    expect(diff.stats.itemsRemoved).toBe(0);
    expect(diff.sections[0].items[0].status).toBe("added");
  });

  it("detects removed items", () => {
    const oldTree = makeTree([
      makeSection({
        id: "s1",
        label: "Espacios",
        items: [
          makeItem({ id: "i1", label: "Sala" }),
          makeItem({ id: "i2", label: "Cocina" }),
        ],
      }),
    ]);
    const newTree = makeTree([
      makeSection({
        id: "s1",
        label: "Espacios",
        items: [makeItem({ id: "i1", label: "Sala" })],
      }),
    ]);
    const diff = computeGuideDiff(oldTree, newTree);

    expect(diff.stats.itemsRemoved).toBe(1);
    const removed = diff.sections[0].items.find((i) => i.id === "i2");
    expect(removed?.status).toBe("removed");
  });

  it("detects changed items", () => {
    const oldTree = makeTree([
      makeSection({
        id: "s1",
        label: "Llegada",
        items: [makeItem({ id: "i1", label: "Check-in", value: "15:00 – 20:00" })],
      }),
    ]);
    const newTree = makeTree([
      makeSection({
        id: "s1",
        label: "Llegada",
        items: [makeItem({ id: "i1", label: "Check-in", value: "14:00 – 22:00" })],
      }),
    ]);
    const diff = computeGuideDiff(oldTree, newTree);

    expect(diff.stats.itemsChanged).toBe(1);
    const changed = diff.sections[0].items.find((i) => i.id === "i1");
    expect(changed?.status).toBe("changed");
    expect(changed?.changes).toBeDefined();
    expect(changed!.changes!.length).toBeGreaterThan(0);
  });

  it("detects added sections", () => {
    const oldTree = makeTree([]);
    const newTree = makeTree([
      makeSection({
        id: "s1",
        label: "Contactos",
        items: [makeItem({ id: "i1", label: "Anfitrión" })],
      }),
    ]);
    const diff = computeGuideDiff(oldTree, newTree);

    expect(diff.stats.sectionsAdded).toBe(1);
    expect(diff.stats.itemsAdded).toBe(1);
    expect(diff.sections[0].status).toBe("added");
  });

  it("detects removed sections", () => {
    const oldTree = makeTree([
      makeSection({ id: "s1", label: "Emergencia", items: [] }),
    ]);
    const newTree = makeTree([]);
    const diff = computeGuideDiff(oldTree, newTree);

    expect(diff.stats.sectionsRemoved).toBe(1);
    expect(diff.sections[0].status).toBe("removed");
  });

  it("handles null oldTree (first publish)", () => {
    const newTree = makeTree([
      makeSection({
        id: "s1",
        label: "Espacios",
        items: [makeItem({ id: "i1", label: "Sala" })],
      }),
    ]);
    const diff = computeGuideDiff(null, newTree);

    expect(diff.stats.sectionsAdded).toBe(1);
    expect(diff.stats.itemsAdded).toBe(1);
  });

  it("handles null newTree (unpublish scenario)", () => {
    const oldTree = makeTree([
      makeSection({
        id: "s1",
        label: "Espacios",
        items: [makeItem({ id: "i1", label: "Sala" })],
      }),
    ]);
    const diff = computeGuideDiff(oldTree, null);

    expect(diff.stats.sectionsRemoved).toBe(1);
    expect(diff.stats.itemsRemoved).toBe(1);
  });

  it("detects field-level changes", () => {
    const oldTree = makeTree([
      makeSection({
        id: "s1",
        label: "Contactos",
        items: [
          makeItem({
            id: "i1",
            label: "Anfitrión",
            fields: [{ label: "Teléfono", value: "+34 600 000", visibility: "guest" }],
          }),
        ],
      }),
    ]);
    const newTree = makeTree([
      makeSection({
        id: "s1",
        label: "Contactos",
        items: [
          makeItem({
            id: "i1",
            label: "Anfitrión",
            fields: [{ label: "Teléfono", value: "+34 700 000", visibility: "guest" }],
          }),
        ],
      }),
    ]);
    const diff = computeGuideDiff(oldTree, newTree);

    expect(diff.stats.itemsChanged).toBe(1);
    const item = diff.sections[0].items[0];
    expect(item.changes).toContain('campo "Teléfono" modificado');
  });
});
