import { describe, it, expect } from "vitest";
import { coerceToPredicate, evaluatePredicate, OPERATORS } from "../operators";

describe("operators", () => {
  it("equals", () => {
    expect(OPERATORS.equals("a", "a")).toBe(true);
    expect(OPERATORS.equals("a", "b")).toBe(false);
  });

  it("in / notIn", () => {
    expect(OPERATORS.in("pt.villa", ["pt.villa", "pt.house"])).toBe(true);
    expect(OPERATORS.in("pt.apt", ["pt.villa"])).toBe(false);
    expect(OPERATORS.notIn("pt.apt", ["pt.villa"])).toBe(true);
  });

  it("numeric comparators", () => {
    expect(OPERATORS.gt(5, 3)).toBe(true);
    expect(OPERATORS.gte(3, 3)).toBe(true);
    expect(OPERATORS.lt(2, 3)).toBe(true);
    expect(OPERATORS.lte(3, 3)).toBe(true);
    expect(OPERATORS.gt(null, 3)).toBe(false);
    expect(OPERATORS.gt("5", 3)).toBe(true); // coerces
  });

  it("exists", () => {
    expect(OPERATORS.exists("foo", true)).toBe(true);
    expect(OPERATORS.exists("", true)).toBe(false);
    expect(OPERATORS.exists(null, false)).toBe(true);
  });

  it("truthy / falsy", () => {
    expect(OPERATORS.truthy(true, true)).toBe(true);
    expect(OPERATORS.truthy(0, true)).toBe(false);
    expect(OPERATORS.falsy(0, true)).toBe(true);
  });

  it("containsAny / containsAll", () => {
    expect(OPERATORS.containsAny(["a", "b"], ["b", "c"])).toBe(true);
    expect(OPERATORS.containsAny(["a"], ["b"])).toBe(false);
    expect(OPERATORS.containsAll(["a", "b", "c"], ["a", "b"])).toBe(true);
    expect(OPERATORS.containsAll(["a"], ["a", "b"])).toBe(false);
  });

  it("evaluatePredicate ANDs all keys", () => {
    expect(evaluatePredicate(5, { gte: 3, lt: 10 })).toBe(true);
    expect(evaluatePredicate(5, { gte: 3, lt: 4 })).toBe(false);
  });

  it("evaluatePredicate throws on unknown operator", () => {
    expect(() =>
      evaluatePredicate("x", { wat: 1 } as unknown as Parameters<typeof evaluatePredicate>[1]),
    ).toThrow(/Unknown conditional operator/);
  });

  it("coerceToPredicate", () => {
    expect(coerceToPredicate("foo")).toEqual({ equals: "foo" });
    expect(coerceToPredicate(["a", "b"])).toEqual({ in: ["a", "b"] });
    expect(coerceToPredicate(true)).toEqual({ equals: true });
    expect(coerceToPredicate({ gte: 3 })).toEqual({ gte: 3 });
  });
});
