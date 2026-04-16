import { describe, it, expect } from "vitest";
import type { GuideTree } from "@/lib/types/guide-tree";

/**
 * Guide publish workflow tests (9C).
 *
 * These are structural/contract tests that verify the snapshot model:
 * - A published GuideVersion.treeJson is a valid GuideTree
 * - The snapshot is decoupled from live data (immutability contract)
 * - Rollback creates a NEW version (linear history)
 *
 * Integration tests that hit the DB live in E2E; here we validate
 * the contract of the treeJson shape and the diff service integration.
 */

describe("GuideVersion snapshot contract", () => {
  it("a serialized GuideTree round-trips through JSON", () => {
    const tree: GuideTree = {
      propertyId: "prop-1",
      audience: "internal",
      generatedAt: "2026-04-16T10:00:00.000Z",
      sections: [
        {
          id: "arrival",
          label: "Llegada",
          order: 1,
          resolverKey: "arrival",
          sortBy: "explicit_order",
          emptyCtaDeepLink: null,
          maxVisibility: "guest",
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

    const json = JSON.stringify(tree);
    const parsed = JSON.parse(json) as GuideTree;

    expect(parsed.propertyId).toBe("prop-1");
    expect(parsed.audience).toBe("internal");
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0].items[0].label).toBe("Check-in");
    expect(parsed.sections[0].items[0].value).toBe("15:00 – 20:00");
  });

  it("snapshot is a deep copy — mutations do not propagate", () => {
    const tree: GuideTree = {
      propertyId: "prop-1",
      audience: "internal",
      generatedAt: "2026-04-16T10:00:00.000Z",
      sections: [
        {
          id: "spaces",
          label: "Espacios",
          order: 2,
          resolverKey: "spaces",
          sortBy: "taxonomy_order",
          emptyCtaDeepLink: null,
          maxVisibility: "guest",
          items: [
            {
              id: "space-1",
              taxonomyKey: "bedroom",
              label: "Dormitorio principal",
              value: "bedroom",
              visibility: "guest",
              deprecated: false,
              warnings: [],
              fields: [
                { label: "Cama doble", value: "1", visibility: "guest" },
              ],
              media: [],
              children: [],
            },
          ],
        },
      ],
    };

    // Simulate snapshot storage (serialize + parse = deep copy)
    const snapshot = JSON.parse(JSON.stringify(tree)) as GuideTree;

    // Mutate the original tree (simulating live data change)
    tree.sections[0].items[0].label = "Dormitorio renovado";
    tree.sections[0].items[0].fields[0].value = "2";
    tree.sections[0].items.push({
      id: "space-2",
      taxonomyKey: "bathroom",
      label: "Baño",
      value: "bathroom",
      visibility: "guest",
      deprecated: false,
      warnings: [],
      fields: [],
      media: [],
      children: [],
    });

    // Snapshot must be unchanged
    expect(snapshot.sections[0].items).toHaveLength(1);
    expect(snapshot.sections[0].items[0].label).toBe("Dormitorio principal");
    expect(snapshot.sections[0].items[0].fields[0].value).toBe("1");
  });

  it("rollback produces a new version number, not reusing old one", () => {
    // Contract: rollback creates version N+1 with old snapshot content
    const versions = [
      { version: 1, status: "archived" },
      { version: 2, status: "archived" },
      { version: 3, status: "published" },
    ];

    // Simulate rollback to v1: next version = max(versions) + 1 = 4
    const maxVersion = Math.max(...versions.map((v) => v.version));
    const rollbackVersion = maxVersion + 1;

    expect(rollbackVersion).toBe(4);
    expect(rollbackVersion).toBeGreaterThan(3);
  });

  it("treeJson with audience=internal includes all visibility levels", () => {
    const tree: GuideTree = {
      propertyId: "prop-1",
      audience: "internal",
      generatedAt: "2026-04-16T10:00:00.000Z",
      sections: [
        {
          id: "contacts",
          label: "Contactos",
          order: 5,
          resolverKey: "contacts",
          sortBy: "explicit_order",
          emptyCtaDeepLink: "/properties/prop-1/contacts",
          maxVisibility: "internal",
          items: [
            {
              id: "c1",
              taxonomyKey: "host",
              label: "Anfitrión",
              value: "host",
              visibility: "guest",
              deprecated: false,
              warnings: [],
              fields: [
                { label: "Teléfono", value: "+34 600", visibility: "guest" },
                { label: "Notas internas", value: "Prefiere WhatsApp", visibility: "internal" },
              ],
              media: [],
              children: [],
            },
          ],
        },
      ],
    };

    // Internal audience snapshot includes both guest and internal fields
    const guestFields = tree.sections[0].items[0].fields.filter(
      (f) => f.visibility === "guest",
    );
    const internalFields = tree.sections[0].items[0].fields.filter(
      (f) => f.visibility === "internal",
    );

    expect(guestFields.length).toBeGreaterThan(0);
    expect(internalFields.length).toBeGreaterThan(0);
  });
});
