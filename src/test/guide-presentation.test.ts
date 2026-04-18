import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { normalizeGuideForPresentation } from "@/lib/services/guide-presentation.service";
import { buildAdversarialTree } from "./fixtures/adversarial-property";
import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";

/** Unit tests for the presentation layer (rama 10F). The fixture is shared
 * with `guest-leak-invariants` — here we focus on transformation semantics
 * (purity, idempotence, audience-awareness) rather than the leak surface. */

// Silence the normalizer's aggregated console.warn — individual tests assert
// the warnings via `presentationWarnings` instead.
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

function findItem(tree: GuideTree, id: string): GuideItem | undefined {
  for (const s of tree.sections) {
    for (const i of s.items) if (i.id === id) return i;
  }
  return undefined;
}

describe("normalizeGuideForPresentation — semantics", () => {
  it("stamps presentationType + displayValue + displayFields on every item", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    for (const section of normalized.sections) {
      for (const item of section.items) {
        expect(item.presentationType).toBeDefined();
        expect(item.displayValue).toBeDefined();
        expect(item.displayFields).toBeDefined();
      }
    }
  });

  it("routes pol.* items through the policy presenter", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    expect(findItem(normalized, "policy.pol.pets")?.presentationType).toBe("policy");
    expect(findItem(normalized, "policy.pol.smoking")?.presentationType).toBe("policy");
  });

  it("routes ct.* items through the contact presenter", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    expect(findItem(normalized, "ct.host.1")?.presentationType).toBe("contact");
  });

  it("does not mutate the input tree (pure)", () => {
    const tree = buildAdversarialTree();
    const before = JSON.parse(JSON.stringify(tree));
    normalizeGuideForPresentation(tree, "guest");
    expect(tree).toEqual(before);
  });

  it("is idempotent — running twice produces an equivalent tree", () => {
    const once = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    const twice = normalizeGuideForPresentation(once, "guest");
    expect(twice).toEqual(once);
  });

  it("preserves internal `value` / `fields` on the tree (non-guest renderers may read them)", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    const pets = findItem(normalized, "policy.pol.pets");
    expect(pets?.value).toBe(
      '{"allowed":true,"fee":50,"hidden_key":"rm.noise_outdoor_only"}',
    );
    expect(pets?.fields).toEqual([]);
  });

  it("audience=internal passes value through unchanged (no humanization)", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "internal");
    const smoking = findItem(normalized, "policy.pol.smoking");
    expect(smoking?.displayValue).toBe("rm.smoking_outdoor_only");
    const host = findItem(normalized, "ct.host.1");
    expect(host?.displayValue).toBe("ct.host");
  });

  it("audience=guest drops contact roleKey leak (displayValue becomes empty)", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    const host = findItem(normalized, "ct.host.1");
    expect(host?.displayValue).toBe("");
  });

  it("audience=guest humanizes policy enum via taxonomy options", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    const smoking = findItem(normalized, "policy.pol.smoking");
    // `rm.smoking_outdoor_only` is not a valid option for `pol.smoking` in the
    // taxonomy → the presenter drops it and emits a warning.
    expect(smoking?.displayValue).toBe("");
    expect(smoking?.presentationWarnings?.some((w) => w.includes("taxonomy key"))).toBe(true);
  });

  it("audience=guest expands JSON object value into displayFields", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    const pets = findItem(normalized, "policy.pol.pets");
    expect(pets?.displayValue).toBe("");
    // fee:50 expands into a displayField (taxonomy has a `fee` field).
    const feeField = pets?.displayFields?.find((f) => /fee/i.test(f.label));
    expect(feeField?.displayValue).toBe("50");
  });

  it("expandObject propagates taxonomy-key drops from nested JSON keys", () => {
    // Adversarial pol.pets blob carries `hidden_key: "rm.noise_outdoor_only"` —
    // the drop must surface on the item via warnings threading through expandObject.
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    const pets = findItem(normalized, "policy.pol.pets");
    expect(pets?.presentationWarnings?.some((w) => w.includes("taxonomy key"))).toBe(true);
  });

  it("routes unknown-prefix taxonomyKey through the raw sentinel presenter", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "guest");
    const arrival = findItem(normalized, "arrival.unknown");
    expect(arrival?.presentationType).toBe("raw");
    expect(arrival?.displayValue).toBe("");
    expect(arrival?.presentationWarnings?.[0]).toContain("missing-presenter");
  });

  it("raw sentinel preserves raw value for non-guest audiences (operator debugging)", () => {
    const normalized = normalizeGuideForPresentation(buildAdversarialTree(), "internal");
    const arrival = findItem(normalized, "arrival.unknown");
    expect(arrival?.presentationType).toBe("raw");
    // Non-guest audiences still see the raw value so operators can triage.
    expect(arrival?.displayValue).toBe("arrival.checkin_code");
  });
});
