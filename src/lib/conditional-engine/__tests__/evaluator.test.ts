import { describe, it, expect } from "vitest";
import { evaluateItemAvailability, evaluateFieldCondition } from "../evaluator";
import { buildSyntheticContext } from "../context-builder";
import type { ItemRules, PropertyContext } from "../types";

const baseCtx = (): PropertyContext =>
  buildSyntheticContext(
    {
      propertyType: "pt.villa",
      roomType: "rt.entire_place",
      propertyEnvironment: "env.rural",
      maxGuests: 6,
      infantsAllowed: true,
      floorLevel: 0,
      hasElevator: false,
    },
    [{ id: "s1", spaceType: "sp.garden" }],
    ["sys.pool_maintenance"],
    ["am.bbq_grill"],
  );

describe("evaluateItemAvailability", () => {
  it("no rules → available", () => {
    const r = evaluateItemAvailability(undefined, baseCtx());
    expect(r.available).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it("atomic propertyType match via `in`", () => {
    const rules: ItemRules = { propertyType: { in: ["pt.villa", "pt.house"] } };
    expect(evaluateItemAvailability(rules, baseCtx()).available).toBe(true);
  });

  it("atomic propertyType mismatch", () => {
    const rules: ItemRules = { propertyType: { in: ["pt.apt"] } };
    const r = evaluateItemAvailability(rules, baseCtx());
    expect(r.available).toBe(false);
    expect(r.reasons).toContain("propertyType");
  });

  it("propertyFields with shorthand + operator", () => {
    const rules: ItemRules = {
      propertyFields: { maxGuests: { gte: 6 }, infantsAllowed: true },
    };
    expect(evaluateItemAvailability(rules, baseCtx()).available).toBe(true);
  });

  it("propertyFields predicate fails", () => {
    const rules: ItemRules = { propertyFields: { maxGuests: { gte: 10 } } };
    const r = evaluateItemAvailability(rules, baseCtx());
    expect(r.available).toBe(false);
    expect(r.reasons).toContain("propertyFields.maxGuests");
  });

  it("requiresSpaces / requiresSystems / requiresAmenities", () => {
    const ok: ItemRules = {
      requiresSpaces: ["sp.garden"],
      requiresSystems: ["sys.pool_maintenance"],
      requiresAmenities: ["am.bbq_grill"],
    };
    expect(evaluateItemAvailability(ok, baseCtx()).available).toBe(true);

    const bad: ItemRules = { requiresSpaces: ["sp.pool"] };
    const r = evaluateItemAvailability(bad, baseCtx());
    expect(r.available).toBe(false);
    expect(r.reasons).toContain("missing space: sp.pool");
  });

  it("allOf: every branch must pass", () => {
    const rules: ItemRules = {
      allOf: [
        { propertyType: { in: ["pt.villa"] } },
        { propertyFields: { maxGuests: { gte: 6 } } },
      ],
    };
    expect(evaluateItemAvailability(rules, baseCtx()).available).toBe(true);

    const badAll: ItemRules = {
      allOf: [
        { propertyType: { in: ["pt.villa"] } },
        { propertyFields: { maxGuests: { gte: 99 } } },
      ],
    };
    expect(evaluateItemAvailability(badAll, baseCtx()).available).toBe(false);
  });

  it("anyOf: at least one branch must pass", () => {
    const rules: ItemRules = {
      anyOf: [
        { propertyType: { in: ["pt.apt"] } },
        { propertyType: { in: ["pt.villa"] } },
      ],
    };
    expect(evaluateItemAvailability(rules, baseCtx()).available).toBe(true);

    const bad: ItemRules = {
      anyOf: [{ propertyType: { in: ["pt.apt"] } }],
    };
    expect(evaluateItemAvailability(bad, baseCtx()).available).toBe(false);
  });

  it("not: blocks if inner matches", () => {
    const rules: ItemRules = {
      not: { propertyFields: { floorLevel: { gt: 0 } } },
    };
    expect(evaluateItemAvailability(rules, baseCtx()).available).toBe(true);

    const blocking: ItemRules = {
      not: { propertyType: { in: ["pt.villa"] } },
    };
    const r = evaluateItemAvailability(blocking, baseCtx());
    expect(r.available).toBe(false);
    expect(r.reasons).toContain("blocked by `not`");
  });

  it("full DSL example from sync_contracts.md", () => {
    const rules: ItemRules = {
      allOf: [
        { propertyType: { in: ["pt.villa", "pt.house"] } },
        { roomType: { equals: "rt.entire_place" } },
        { propertyEnvironment: { in: ["env.rural", "env.beach"] } },
        { propertyFields: { maxGuests: { gte: 6 }, infantsAllowed: true } },
        { requiresSpaces: ["sp.garden"] },
        { requiresSystems: ["sys.pool_maintenance"] },
        { requiresAmenities: ["am.bbq_grill"] },
      ],
      not: { propertyFields: { floorLevel: { gt: 0 }, hasElevator: false } },
    };
    expect(evaluateItemAvailability(rules, baseCtx()).available).toBe(true);
  });
});

describe("evaluateFieldCondition (legacy)", () => {
  it("equals", () => {
    expect(evaluateFieldCondition({ equals: "am.smart_lock" }, "am.smart_lock")).toBe(true);
    expect(evaluateFieldCondition({ equals: "am.smart_lock" }, "am.lockbox")).toBe(false);
  });

  it("contains", () => {
    expect(evaluateFieldCondition({ contains: "am.pet_bowls" }, ["am.pet_bowls", "x"])).toBe(true);
    expect(evaluateFieldCondition({ contains: "am.pet_bowls" }, ["x"])).toBe(false);
  });

  it("intersects", () => {
    expect(evaluateFieldCondition({ intersects: ["a", "b"] }, ["b", "c"])).toBe(true);
    expect(evaluateFieldCondition({ intersects: ["a", "b"] }, ["c"])).toBe(false);
  });

  it("prefix_contains", () => {
    expect(evaluateFieldCondition({ prefix_contains: ["am."] }, ["am.bbq_grill"])).toBe(true);
    expect(evaluateFieldCondition({ prefix_contains: ["sys."] }, ["am.bbq_grill"])).toBe(false);
  });

  it("delegates unknown keys to unified operators", () => {
    expect(evaluateFieldCondition({ gte: 6 }, 7)).toBe(true);
    expect(evaluateFieldCondition({ gte: 6 }, 5)).toBe(false);
  });
});
