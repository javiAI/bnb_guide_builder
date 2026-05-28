import { describe, expect, it } from "vitest";
import {
  deriveAccessibilityPersistence,
  normalizeAccessibilityFeatures,
  NO_ACCESSIBILITY_ID,
  OTHER_ACCESSIBILITY_ID,
} from "@/lib/services/access-tri-state";
import { accessibilityFeatures } from "@/lib/taxonomy-loader";

const VALID_IDS = new Set(accessibilityFeatures.items.map((i) => i.id));

describe("normalizeAccessibilityFeatures — mutex sentinel handling", () => {
  it("drops ids not in the taxonomy (defense against tampered FormData)", () => {
    const result = normalizeAccessibilityFeatures(
      ["ax.step_free_guest_entrance", "ax.bogus", "not_a_taxonomy_id"],
      VALID_IDS,
    );
    expect(result).toEqual(["ax.step_free_guest_entrance"]);
  });

  it("returns [sentinel] when only the sentinel was submitted", () => {
    const result = normalizeAccessibilityFeatures(
      [NO_ACCESSIBILITY_ID],
      VALID_IDS,
    );
    expect(result).toEqual([NO_ACCESSIBILITY_ID]);
  });

  it("returns positives only when sentinel + positives both arrived (positives win)", () => {
    const result = normalizeAccessibilityFeatures(
      [NO_ACCESSIBILITY_ID, "ax.step_free_guest_entrance", "ax.single_level_home"],
      VALID_IDS,
    );
    expect(result).toEqual(["ax.step_free_guest_entrance", "ax.single_level_home"]);
  });

  it("returns positives in submitted order (no resorting)", () => {
    const result = normalizeAccessibilityFeatures(
      ["ax.single_level_home", "ax.step_free_guest_entrance"],
      VALID_IDS,
    );
    expect(result).toEqual(["ax.single_level_home", "ax.step_free_guest_entrance"]);
  });

  it("returns [] for empty input (unanswered case)", () => {
    expect(normalizeAccessibilityFeatures([], VALID_IDS)).toEqual([]);
  });

  it("returns [] when all submitted ids are invalid", () => {
    expect(
      normalizeAccessibilityFeatures(["bogus.one", "bogus.two"], VALID_IDS),
    ).toEqual([]);
  });

  it("strips duplicates of the sentinel idempotently", () => {
    const result = normalizeAccessibilityFeatures(
      [NO_ACCESSIBILITY_ID, NO_ACCESSIBILITY_ID],
      VALID_IDS,
    );
    expect(result).toEqual([NO_ACCESSIBILITY_ID]);
  });
});

describe("deriveAccessibilityPersistence — tri-state split", () => {
  it("opt-out: sentinel only → hasConsiderations=false + accessJsonShape=null", () => {
    const result = deriveAccessibilityPersistence({
      features: [NO_ACCESSIBILITY_ID],
      customLabel: null,
      customDesc: null,
    });
    expect(result.hasConsiderations).toBe(false);
    expect(result.accessJsonShape).toBeNull();
    expect(result.isOptOut).toBe(true);
    expect(result.positiveFeatures).toEqual([]);
  });

  it("positive answer: positives present → hasConsiderations=true + shape filled", () => {
    const result = deriveAccessibilityPersistence({
      features: ["ax.step_free_guest_entrance", "ax.single_level_home"],
      customLabel: "custom",
      customDesc: "desc",
    });
    expect(result.hasConsiderations).toBe(true);
    expect(result.accessJsonShape).toEqual({
      features: ["ax.step_free_guest_entrance", "ax.single_level_home"],
      customLabel: null,
      customDesc: null,
    });
    expect(result.isOptOut).toBe(false);
  });

  it("unanswered: empty array → hasConsiderations=null + accessJsonShape=null", () => {
    const result = deriveAccessibilityPersistence({
      features: [],
      customLabel: null,
      customDesc: null,
    });
    expect(result.hasConsiderations).toBeNull();
    expect(result.accessJsonShape).toBeNull();
    expect(result.isOptOut).toBe(false);
    expect(result.positiveFeatures).toEqual([]);
  });

  it("custom label/desc only bind when ax.other is present", () => {
    const withOther = deriveAccessibilityPersistence({
      features: ["ax.step_free_guest_entrance", OTHER_ACCESSIBILITY_ID],
      customLabel: "my custom",
      customDesc: "my desc",
    });
    expect(withOther.accessJsonShape).toEqual({
      features: ["ax.step_free_guest_entrance", OTHER_ACCESSIBILITY_ID],
      customLabel: "my custom",
      customDesc: "my desc",
    });

    const withoutOther = deriveAccessibilityPersistence({
      features: ["ax.step_free_guest_entrance"],
      customLabel: "stale",
      customDesc: "stale",
    });
    expect(withoutOther.accessJsonShape).toEqual({
      features: ["ax.step_free_guest_entrance"],
      customLabel: null,
      customDesc: null,
    });
  });

  it("sentinel never appears in positiveFeatures, even if (illegally) passed in alongside positives", () => {
    // Caller should pass already-normalized features, but the helper must be
    // defensive — the sentinel must never leak into accessJsonShape.features.
    const result = deriveAccessibilityPersistence({
      features: [NO_ACCESSIBILITY_ID, "ax.step_free_guest_entrance"],
      customLabel: null,
      customDesc: null,
    });
    expect(result.positiveFeatures).toEqual(["ax.step_free_guest_entrance"]);
    expect(result.accessJsonShape?.features).not.toContain(NO_ACCESSIBILITY_ID);
  });

  it("round-trip — sentinel-only column value matches the page hydration contract", () => {
    // page.tsx hydrates the chip group with [sentinel] when the column is
    // false; this test pins that the save path emits column=false for that
    // input, so a guest with sentinel → reload → sentinel round-trips cleanly.
    const result = deriveAccessibilityPersistence({
      features: [NO_ACCESSIBILITY_ID],
      customLabel: null,
      customDesc: null,
    });
    expect(result.hasConsiderations).toBe(false);
  });
});

describe("ax.no_accessibility sentinel — taxonomy registration", () => {
  it("the sentinel exists in accessibility_features.json", () => {
    expect(VALID_IDS.has(NO_ACCESSIBILITY_ID)).toBe(true);
  });

  it("the ax.other id exists in accessibility_features.json", () => {
    expect(VALID_IDS.has(OTHER_ACCESSIBILITY_ID)).toBe(true);
  });
});
