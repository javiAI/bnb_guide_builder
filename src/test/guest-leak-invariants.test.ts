import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  "Añade instrucciones",
  "Añade algo aquí",
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

// Silence the normalizer's aggregated warn + filterRenderable per-item warn
// during assertions that deliberately trip them; individual tests below assert
// the calls happened when relevant.
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("guest leak invariants — tree (post-normalization)", () => {
  it("invariant 1: no displayValue / displayField looks like raw JSON", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
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
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
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
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    walkItems(normalized, (item) => {
      for (const f of item.displayFields ?? []) {
        expect(INTERNAL_LABEL_DENYLIST).not.toContain(f.label);
      }
    });
  });

  it("invariant 5: unknown-prefix taxonomyKey routes to presentationType=raw", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    let rawFound = false;
    walkItems(normalized, (item) => {
      if (item.id === "arrival.unknown") {
        rawFound = true;
        expect(item.presentationType).toBe("raw");
        expect(item.displayValue).toBe("");
        expect(item.presentationWarnings?.some((w) => w.includes("missing-presenter"))).toBe(true);
      }
    });
    expect(rawFound).toBe(true);
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
  function render() {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    return { markdown: renderMarkdown(normalized), html: renderHtml(normalized) };
  }

  it("invariant 1: no raw JSON blob appears in md / html", () => {
    const { markdown, html } = render();
    expect(markdown).not.toContain('{"allowed":true');
    expect(markdown).not.toContain('{"enforced":true');
    expect(markdown).not.toContain('{"allowed\\":true'); // md-escaped variant
    expect(html).not.toContain('{"allowed":true');
    expect(html).not.toContain('{"enforced":true');
  });

  it("invariant 2: no taxonomy enum keys leak into md / html", () => {
    const { markdown, html } = render();
    expect(markdown).not.toContain("rm.smoking_outdoor_only");
    expect(markdown).not.toContain("ct.host");
    expect(markdown).not.toContain("arrival.checkin_code");
    expect(html).not.toContain("rm.smoking_outdoor_only");
    expect(html).not.toContain("ct.host");
    expect(html).not.toContain("arrival.checkin_code");
  });

  it("invariant 3: host-editorial emptyCopy is never rendered for guest", () => {
    const { markdown, html } = render();
    for (const fragment of HOST_EDITORIAL_FRAGMENTS) {
      expect(markdown).not.toContain(fragment);
      expect(html).not.toContain(fragment);
    }
  });

  it("invariant 3: hideWhenEmptyForGuest sections are hidden entirely", () => {
    const { markdown, html } = render();
    expect(markdown).not.toContain("## Cómo usar");
    expect(html).not.toContain("<h2>Cómo usar</h2>");
  });

  it("invariant 3 (new): empty section with no emptyCopyGuest is hidden silently", () => {
    const { markdown, html } = render();
    expect(markdown).not.toContain("Sección huérfana");
    expect(html).not.toContain("Sección huérfana");
  });

  it("logs guest-section-missing-empty-copy when an orphan section is hidden", () => {
    const warn = vi.spyOn(console, "warn");
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    warn.mockClear(); // drop the normalizer's own aggregated warn
    renderMarkdown(normalized);
    const missingCopyCalls = warn.mock.calls.filter((args) =>
      typeof args[0] === "string" && args[0].includes("guest-section-missing-empty-copy"),
    );
    expect(missingCopyCalls.length).toBeGreaterThan(0);
    const message = missingCopyCalls[0][0] as string;
    expect(message).toContain("section=gs.orphan");
  });

  it("invariant 4: internal labels (Slot / Config JSON) never appear in md / html", () => {
    const { markdown, html } = render();
    for (const label of INTERNAL_LABEL_DENYLIST) {
      expect(markdown).not.toContain(`- ${label}:`);
      expect(html).not.toContain(`<li>${label}:`);
    }
  });

  it("invariant 5: items with presentationType='raw' are hidden from guest output", () => {
    const { markdown, html } = render();
    // `arrival.unknown` carries label "Código de entrada" — hidden via sentinel.
    expect(markdown).not.toContain("Código de entrada");
    expect(html).not.toContain("Código de entrada");
  });

  it("invariant 5: raw-sentinel children buried under a renderable parent are filtered recursively", () => {
    // `policy.pol.quiet_hours.nested` has taxonomyKey "unknown.nested_noise"
    // (label "Sensor interno") and sits inside a non-raw parent. Without deep
    // filtering, renderer recursion prints it in the children `<ol>` / list.
    const { markdown, html } = render();
    expect(markdown).not.toContain("Sensor interno");
    expect(html).not.toContain("Sensor interno");
    expect(markdown).not.toContain("unknown.nested_noise");
    expect(html).not.toContain("unknown.nested_noise");
  });
});

describe("normalizer observability", () => {
  it("emits a single aggregated warn when any item has warnings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    const aggregatedCalls = warn.mock.calls.filter((args) =>
      typeof args[0] === "string" && args[0].startsWith("[guide-presenter] ") && args[0].includes("drops on"),
    );
    expect(aggregatedCalls.length).toBe(1);
    const [message, meta] = aggregatedCalls[0];
    expect(message).toContain("audience=guest");
    expect(meta).toHaveProperty("byTaxonomyKey");
    expect(meta).toHaveProperty("byCategory");
  });

  it("captures hidden taxonomy-key leaks inside JSON-expanded policy fields", () => {
    // The adversarial `pol.pets` blob contains a nested `hidden_key`
    // with a value matching TAXONOMY_KEY_PATTERN. After expandObject's
    // warnings are propagated, that drop must surface on the item.
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    let found = false;
    walkItems(normalized, (item) => {
      if (item.id === "policy.pol.pets") {
        found = true;
        const warnings = item.presentationWarnings ?? [];
        expect(warnings.some((w) => w.includes("taxonomy key"))).toBe(true);
      }
    });
    expect(found).toBe(true);
  });
});
