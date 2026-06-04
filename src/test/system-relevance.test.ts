import { describe, it, expect } from "vitest";
import { isSystemRelevant } from "@/lib/services/system-relevance";
import { buildSyntheticContext } from "@/lib/conditional-engine/context-builder";
import { findSystemItem } from "@/lib/taxonomy-loader";

const elevator = findSystemItem("sys.elevator")!;
// A system with no relevantWhen — must always be relevant.
const internet = findSystemItem("sys.internet")!;

const ctx = (propertyType: string | null, floorLevel?: number) =>
  buildSyntheticContext({ propertyType, ...(floorLevel != null ? { floorLevel } : {}) });

describe("isSystemRelevant — elevator (sys.elevator.relevantWhen)", () => {
  it("has the rule wired in the taxonomy", () => {
    expect(elevator.relevantWhen).toBeTruthy();
    expect(elevator.managedInProperty).toBe(true);
  });

  it("never relevant for a standalone house, even on an upper floor", () => {
    expect(isSystemRelevant(elevator, ctx("pt.house", 3))).toBe(false);
  });

  it("not relevant on the ground floor — no lift needed to reach the unit", () => {
    expect(isSystemRelevant(elevator, ctx("pt.apartment", 0))).toBe(false);
    expect(isSystemRelevant(elevator, ctx("pt.bed_and_breakfast", 0))).toBe(false);
  });

  it("relevant for a non-house unit above the ground floor", () => {
    expect(isSystemRelevant(elevator, ctx("pt.apartment", 1))).toBe(true);
    expect(isSystemRelevant(elevator, ctx("pt.apartment", 4))).toBe(true);
    expect(isSystemRelevant(elevator, ctx("pt.bed_and_breakfast", 2))).toBe(true);
  });

  it("not relevant when the floor is unknown (unset)", () => {
    expect(isSystemRelevant(elevator, ctx("pt.apartment"))).toBe(false);
  });
});

describe("isSystemRelevant — systems without a rule", () => {
  it("are always relevant", () => {
    expect(isSystemRelevant(internet, ctx("pt.house", 0))).toBe(true);
    expect(isSystemRelevant(internet, ctx("pt.apartment", 9))).toBe(true);
  });
});
