import { describe, it, expect } from "vitest";
import { isSystemRelevant, getRelevantSystems } from "@/lib/services/system-relevance";
import { buildSyntheticContext } from "@/lib/conditional-engine/context-builder";
import { findSystemItem } from "@/lib/taxonomy-loader";
import type { SystemItem } from "@/lib/types/taxonomy";

const elevator = findSystemItem("sys.elevator")!;
// A system with no relevantWhen — must always be relevant.
const internet = findSystemItem("sys.internet")!;

const ctx = (propertyType: string | null, buildingFloors: number) =>
  buildSyntheticContext({ propertyType, buildingFloors });

describe("isSystemRelevant — elevator (sys.elevator.relevantWhen)", () => {
  it("has the rule wired in the taxonomy", () => {
    expect(elevator.relevantWhen).toBeTruthy();
    expect(elevator.managedInProperty).toBe(true);
  });

  it("never relevant for a standalone house, even with many floors", () => {
    expect(isSystemRelevant(elevator, ctx("pt.house", 5))).toBe(false);
  });

  it("relevant for an apartment regardless of floor count (inherent multi-floor)", () => {
    expect(isSystemRelevant(elevator, ctx("pt.apartment", 1))).toBe(true);
    expect(isSystemRelevant(elevator, ctx("pt.apartment", 5))).toBe(true);
  });

  it("relevant for a boutique hotel (inherent)", () => {
    expect(isSystemRelevant(elevator, ctx("pt.boutique_hotel", 1))).toBe(true);
  });

  it("non-inherent types: relevant only when multi-floor (buildingFloors ≥ 2)", () => {
    expect(isSystemRelevant(elevator, ctx("pt.bed_and_breakfast", 1))).toBe(false);
    expect(isSystemRelevant(elevator, ctx("pt.bed_and_breakfast", 3))).toBe(true);
    expect(isSystemRelevant(elevator, ctx("pt.unique_space", 1))).toBe(false);
    expect(isSystemRelevant(elevator, ctx("pt.unique_space", 2))).toBe(true);
  });
});

describe("isSystemRelevant — systems without a rule", () => {
  it("are always relevant", () => {
    expect(isSystemRelevant(internet, ctx("pt.house", 1))).toBe(true);
    expect(isSystemRelevant(internet, ctx("pt.apartment", 9))).toBe(true);
  });
});

describe("getRelevantSystems", () => {
  it("filters the list by relevance", () => {
    const items: SystemItem[] = [internet, elevator];
    expect(getRelevantSystems(items, ctx("pt.house", 5)).map((i) => i.id)).toEqual(["sys.internet"]);
    expect(getRelevantSystems(items, ctx("pt.apartment", 1)).map((i) => i.id)).toEqual([
      "sys.internet",
      "sys.elevator",
    ]);
  });
});
