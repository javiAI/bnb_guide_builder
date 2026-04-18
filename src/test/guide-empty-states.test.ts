import { describe, it, expect } from "vitest";
import {
  resolveEmptyCopy,
  shouldHideSection,
} from "@/lib/renderers/_guide-display";
import { renderMarkdown } from "@/lib/renderers/guide-markdown";
import { renderHtml } from "@/lib/renderers/guide-html";
import { guideSections } from "@/lib/taxonomy-loader";
import type { GuideSection, GuideTree } from "@/lib/types/guide-tree";

/** Rama 10F — empty-state gating matrix.
 *  Each guide section is either:
 *    A) `hideWhenEmptyForGuest: true`   → entirely hidden for guest
 *    B) `emptyCopyGuest: "<neutral>"`   → shows guest-neutral copy
 *  Host-facing `emptyCopy` never falls through to guest. */

const EMPTY_TREE_BASE: Omit<GuideTree, "sections"> = {
  schemaVersion: 3,
  propertyId: "p1",
  audience: "guest",
  generatedAt: "2026-04-18T00:00:00.000Z",
};

function emptySection(id: string, overrides: Partial<GuideSection> = {}): GuideSection {
  return {
    id,
    label: id,
    order: 1,
    resolverKey: "arrival",
    sortBy: "explicit_order",
    emptyCtaDeepLink: null,
    maxVisibility: "internal",
    items: [],
    ...overrides,
  };
}

describe("resolveEmptyCopy — audience routing", () => {
  it("guest reads only `emptyCopyGuest`, never `emptyCopy`", () => {
    const section = emptySection("gs.rules", {
      emptyCopy: "Añade normas (host-facing).",
      emptyCopyGuest: "No hay normas.",
    });
    expect(resolveEmptyCopy(section, "guest")).toBe("No hay normas.");
    expect(resolveEmptyCopy(section, "internal")).toBe("Añade normas (host-facing).");
  });

  it("guest returns null when `emptyCopyGuest` is absent (no fallback to `emptyCopy`)", () => {
    const section = emptySection("gs.howto", {
      emptyCopy: "Añade runbooks.",
      hideWhenEmptyForGuest: true,
    });
    expect(resolveEmptyCopy(section, "guest")).toBeNull();
  });
});

describe("shouldHideSection — guest-only gating", () => {
  it("hides empty sections flagged `hideWhenEmptyForGuest` for guest", () => {
    const section = emptySection("gs.howto", { hideWhenEmptyForGuest: true });
    expect(shouldHideSection(section, "guest", [])).toBe(true);
  });

  it("shows empty section when gate is absent", () => {
    const section = emptySection("gs.rules", {
      emptyCopyGuest: "No hay normas.",
    });
    expect(shouldHideSection(section, "guest", [])).toBe(false);
  });

  it("never hides for non-guest audiences", () => {
    const section = emptySection("gs.howto", { hideWhenEmptyForGuest: true });
    expect(shouldHideSection(section, "internal", [])).toBe(false);
    expect(shouldHideSection(section, "ai", [])).toBe(false);
  });

  it("does not hide when the section has renderable items", () => {
    const section = emptySection("gs.howto", { hideWhenEmptyForGuest: true });
    const items = [
      {
        id: "x",
        taxonomyKey: null,
        label: "x",
        value: "x",
        visibility: "guest" as const,
        deprecated: false,
        warnings: [],
        fields: [],
        media: [],
        children: [],
      },
    ];
    expect(shouldHideSection(section, "guest", items)).toBe(false);
  });
});

describe("renderers respect the empty-state gating for guest", () => {
  const tree: GuideTree = {
    ...EMPTY_TREE_BASE,
    sections: [
      emptySection("gs.howto", {
        label: "Cómo usar",
        emptyCopy: "Añade runbooks.",
        hideWhenEmptyForGuest: true,
      }),
      emptySection("gs.rules", {
        label: "Normas de la casa",
        emptyCopy: "Añade normas.",
        emptyCopyGuest: "No hay normas destacadas.",
      }),
    ],
  };

  const md = renderMarkdown(tree);
  const html = renderHtml(tree);

  it("hidden sections do not appear in markdown output", () => {
    expect(md).not.toContain("## Cómo usar");
  });

  it("hidden sections do not appear in html output", () => {
    expect(html).not.toContain("<h2>Cómo usar</h2>");
  });

  it("sections with `emptyCopyGuest` render the neutral copy (md + html)", () => {
    expect(md).toContain("## Normas de la casa");
    expect(md).toContain("No hay normas destacadas.");
    expect(html).toContain("<h2>Normas de la casa</h2>");
    expect(html).toContain("No hay normas destacadas.");
  });

  it("host-facing `emptyCopy` never appears in guest output", () => {
    expect(md).not.toContain("Añade runbooks.");
    expect(md).not.toContain("Añade normas.");
    expect(html).not.toContain("Añade runbooks.");
    expect(html).not.toContain("Añade normas.");
  });
});

describe("guide_sections.json — A3 empty-state contract", () => {
  it("every section either has `hideWhenEmptyForGuest: true` or `emptyCopyGuest`", () => {
    for (const section of guideSections.items) {
      const hasGate =
        section.hideWhenEmptyForGuest === true || typeof section.emptyCopyGuest === "string";
      expect(hasGate, `section ${section.id} needs a guest empty-state gate`).toBe(true);
    }
  });
});
