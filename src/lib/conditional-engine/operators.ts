/**
 * Operator primitives shared by both entry points of the conditional engine.
 *
 * Every operator is a pure predicate `(actual, operand) => boolean`.
 * Unknown operator keys throw — fail loud during config migrations.
 */

import type { OperatorPredicate, Primitive } from "./types";

export type OperatorName = keyof OperatorPredicate;

function isNullish(v: unknown): boolean {
  return v === null || v === undefined;
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (isNullish(v)) return [];
  return [v];
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export const OPERATORS: {
  [K in OperatorName]: (actual: unknown, operand: NonNullable<OperatorPredicate[K]>) => boolean;
} = {
  equals: (actual, operand) => actual === operand,

  in: (actual, operand) => (operand as Primitive[]).some((v) => v === actual),

  notIn: (actual, operand) => !(operand as Primitive[]).some((v) => v === actual),

  gt: (actual, operand) => {
    const n = asNumber(actual);
    return n !== null && n > (operand as number);
  },
  gte: (actual, operand) => {
    const n = asNumber(actual);
    return n !== null && n >= (operand as number);
  },
  lt: (actual, operand) => {
    const n = asNumber(actual);
    return n !== null && n < (operand as number);
  },
  lte: (actual, operand) => {
    const n = asNumber(actual);
    return n !== null && n <= (operand as number);
  },

  exists: (actual, operand) => {
    const present = !isNullish(actual) && actual !== "";
    return (operand as boolean) ? present : !present;
  },

  truthy: (actual, operand) => {
    const t = Boolean(actual);
    return (operand as boolean) ? t : !t;
  },
  falsy: (actual, operand) => {
    const t = Boolean(actual);
    return (operand as boolean) ? !t : t;
  },

  containsAny: (actual, operand) => {
    const arr = asArray(actual);
    return (operand as Primitive[]).some((v) => arr.includes(v));
  },
  containsAll: (actual, operand) => {
    const arr = asArray(actual);
    return (operand as Primitive[]).every((v) => arr.includes(v));
  },
};

/**
 * Evaluate a predicate (map of operators) against a single actual value.
 * All operator keys present must pass (AND).
 */
export function evaluatePredicate(actual: unknown, predicate: OperatorPredicate): boolean {
  for (const key of Object.keys(predicate) as OperatorName[]) {
    const op = OPERATORS[key];
    if (!op) {
      throw new Error(`Unknown conditional operator: "${key}"`);
    }
    const operand = predicate[key];
    if (operand === undefined) continue;
    if (!op(actual, operand as never)) return false;
  }
  return true;
}

/**
 * Coerce a shorthand value to an OperatorPredicate.
 *   "foo"      → { equals: "foo" }
 *   ["a","b"]  → { in: ["a","b"] }
 *   true/false → { equals: true/false }
 *   object     → already a predicate
 */
export function coerceToPredicate(
  value: OperatorPredicate | Primitive | Primitive[] | boolean,
): OperatorPredicate {
  if (Array.isArray(value)) return { in: value as Primitive[] };
  if (value !== null && typeof value === "object") return value as OperatorPredicate;
  return { equals: value as Primitive };
}
