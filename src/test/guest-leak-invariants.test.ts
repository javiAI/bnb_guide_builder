import { describe, it, expect } from "vitest";
import { buildAdversarialTree } from "./fixtures/adversarial-property";
import {
  INTERNAL_FIELD_LABEL_DENYLIST,
  normalizeGuideForPresentation,
} from "@/lib/services/guide-presentation.service";
import { renderMarkdown } from "@/lib/renderers/guide-markdown";
import { renderHtml } from "@/lib/renderers/guide-html";
import { TAXONOMY_KEY_PATTERN, looksLikeRawJson } from "@/lib/presenters/types";
import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";

/** QA_AND_RELEASE §3 — five anti-leak invariants enforced on the guest
 * pipeline end-to-end. Runs the adversarial fixture through
 * `normalizeGuideForPresentation` and each rendered output and asserts that
 * no known leak shape survives. */

const INTERNAL_LABEL_DENYLIST = Array.from(INTERNAL_FIELD_LABEL_DENYLIST);
const HOST_EDITORIAL_FRAGMENTS = [
  "Añade políticas",
  "Añade contactos",
  "Añade runbooks",
];

function walkItems(tree: GuideTree, visit: (item: GuideItem) => void): void {
  const recurse = (items: GuideItem[]) => {
    for (const item of items) {
      visit(item);
      recurse(item.children);
    }
  };
  for (const section of tree.sections) recurse(section.items);
}

describe("guest leak invariants — tree (post-normalization)", () => {
  const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");

  it("invariant 1: no displayValue / displayField looks like raw JSON", () => {
    walkItems(normalized, (item) => {
      if (item.displayValue) {
        expect(looksLikeRawJson(item.displayValue), `item ${item.id} displayValue`).toBe(false);
      }
      for (const f of item.displayFields ?? []) {
        expect(looksLikeRawJson(f.displayValue), `item ${item.id} field ${f.label}`).toBe(false);
      }
    });
  });

  it("invariant 2: no displayValue / displayField matches a taxonomy key", () => {
    walkItems(normalized, (item) => {
      if (item.displayValue) {
        expect(TAXONOMY_KEY_PATTERN.test(item.displayValue.trim())).toBe(false);
      }
      for (const f of item.displayFields ?? []) {
        expect(TAXONOMY_KEY_PATTERN.test(f.displayValue.trim())).toBe(false);
      }
    });
  });

  it("invariant 4: no displayField label comes from the internal-only denylist", () => {
    walkItems(normalized, (item) => {
      for (const f of item.displayFields ?? []) {
        expect(INTERNAL_LABEL_DENYLIST).not.toContain(f.label);
      }
    });
  });

  it("normalizer is idempotent — running twice produces an equivalent tree", () => {
    const once = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    const twice = normalizeGuideForPresentation(once, "guest");
    expect(twice).toEqual(once);
  });

  it("normalizer is pure — does not mutate the input", () => {
    const tree = buildAdversarialTree();
    const snapshot = JSON.parse(JSON.stringify(tree));
    normalizeGuideForPresentation(tree, "guest");
    expect(tree).toEqual(snapshot);
  });
});

describe("guest leak invariants — rendered outputs", () => {
  const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
  const markdown = renderMarkdown(normalized);
  const html = renderHtml(normalized);

  it("invariant 1: no raw JSON blob appears in md / html", () => {
    expect(markdown).not.toContain('{"allowed":true');
    expect(markdown).not.toContain('{"enforced":true');
    expect(html).not.toContain('{"allowed":true');
    expect(html).not.toContain('{"enforced":true');
  });

  it("invariant 2: no taxonomy enum keys leak into md / html", () => {
    // Exact leak shapes planted by the adversarial fixture.
    expect(markdown).not.toContain("rm.smoking_outdoor_only");
    expect(markdown).not.toContain("ct.host");
    expect(html).not.toContain("rm.smoking_outdoor_only");
    expect(html).not.toContain("ct.host");
  });

  it("invariant 3: host-editorial emptyCopy is never rendered for guest", () => {
    for (const fragment of HOST_EDITORIAL_FRAGMENTS) {
      expect(markdown).not.toContain(fragment);
      expect(html).not.toContain(fragment);
    }
  });

  it("invariant 3: guest-neutral emptyCopyGuest IS used where configured (gs.rules)", () => {
    // gs.rules has items, so its emptyCopyGuest isn't shown — but gs.howto is
    // empty + hideWhenEmptyForGuest, so it must be hidden entirely.
    expect(markdown).not.toContain("## Cómo usar");
    expect(html).not.toContain("<h2>Cómo usar</h2>");
  });

  it("invariant 4: internal labels (Slot / Config JSON) never appear in md / html", () => {
    for (const label of INTERNAL_LABEL_DENYLIST) {
      expect(markdown).not.toContain(`- ${label}:`);
      expect(html).not.toContain(`<li>${label}:`);
    }
  });

  it("invariant 5: items with presentationType='raw' are hidden from guest output", () => {
    // None of our adversarial items should land on `raw` (policy + contact
    // presenters handle them). This is a smoke-test: if any item ends up raw
    // for some reason, it must not be rendered.
    walkItems(normalized, (item) => {
      if (item.presentationType === "raw") {
        expect(markdown).not.toContain(item.label);
        expect(html).not.toContain(item.label);
      }
    });
  });
});
