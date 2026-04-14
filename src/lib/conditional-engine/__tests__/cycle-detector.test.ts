import { describe, it, expect } from "vitest";
import { assertNoCycles, detectCycles } from "../cycle-detector";

describe("cycle-detector", () => {
  it("returns empty when acyclic", () => {
    const cycles = detectCycles(
      [
        { id: "a", rules: { requiresAmenities: ["b"] } },
        { id: "b", rules: { requiresAmenities: ["c"] } },
        { id: "c", rules: {} },
      ],
      "requiresAmenities",
    );
    expect(cycles).toEqual([]);
  });

  it("detects a direct cycle", () => {
    const cycles = detectCycles(
      [
        { id: "a", rules: { requiresAmenities: ["b"] } },
        { id: "b", rules: { requiresAmenities: ["a"] } },
      ],
      "requiresAmenities",
    );
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("detects a cycle across allOf branches", () => {
    const cycles = detectCycles(
      [
        { id: "a", rules: { allOf: [{ requiresSystems: ["b"] }] } },
        { id: "b", rules: { allOf: [{ requiresSystems: ["a"] }] } },
      ],
      "requiresSystems",
    );
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("ignores `not` branches", () => {
    const cycles = detectCycles(
      [
        { id: "a", rules: { not: { requiresAmenities: ["b"] } } },
        { id: "b", rules: { not: { requiresAmenities: ["a"] } } },
      ],
      "requiresAmenities",
    );
    expect(cycles).toEqual([]);
  });

  it("assertNoCycles throws on cycle", () => {
    expect(() =>
      assertNoCycles(
        [
          { id: "a", rules: { requiresAmenities: ["b"] } },
          { id: "b", rules: { requiresAmenities: ["a"] } },
        ],
        "requiresAmenities",
      ),
    ).toThrow(/Cycle detected/);
  });
});
