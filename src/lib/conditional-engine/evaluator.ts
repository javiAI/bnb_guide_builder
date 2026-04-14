/**
 * Unified evaluators.
 *
 * Two entry points:
 *  - evaluateItemAvailability(rules, ctx): catalog filtering vs PropertyContext
 *  - evaluateFieldCondition(condition, actualValue): shorthand for evaluating
 *    a single field's current value, used by dynamic_field_rules consumers
 *    (field visibility)
 */

import { coerceToPredicate, evaluatePredicate } from "./operators";
import type {
  AtomicCondition,
  EvaluationResult,
  ItemRules,
  OperatorPredicate,
  PropertyContext,
} from "./types";

const REASON_NOT = "blocked by `not`";
const REASON_ALL_OF = "unmet condition in `allOf`";
const REASON_ANY_OF = "no branch of `anyOf` matched";

function checkPropertyFields(
  fields: AtomicCondition["propertyFields"],
  ctx: PropertyContext,
): string[] {
  if (!fields) return [];
  const missing: string[] = [];
  for (const [path, raw] of Object.entries(fields)) {
    const predicate = coerceToPredicate(raw);
    const actual = ctx.property[path];
    if (!evaluatePredicate(actual, predicate)) missing.push(`propertyFields.${path}`);
  }
  return missing;
}

function checkSlot(
  predicate: OperatorPredicate | undefined,
  actual: unknown,
  label: string,
): string | null {
  if (!predicate) return null;
  return evaluatePredicate(actual, predicate) ? null : label;
}

function checkRequires(
  list: string[] | undefined,
  have: string[],
  label: (item: string) => string,
): string[] {
  if (!list || list.length === 0) return [];
  const reasons: string[] = [];
  for (const item of list) if (!have.includes(item)) reasons.push(label(item));
  return reasons;
}

function evaluateAtomic(rules: AtomicCondition, ctx: PropertyContext): string[] {
  const reasons: string[] = [];

  const pt = checkSlot(rules.propertyType, ctx.property.propertyType, "propertyType");
  if (pt) reasons.push(pt);
  const rt = checkSlot(rules.roomType, ctx.property.roomType, "roomType");
  if (rt) reasons.push(rt);
  const lk = checkSlot(rules.layoutKey, ctx.property.layoutKey, "layoutKey");
  if (lk) reasons.push(lk);
  const env = checkSlot(
    rules.propertyEnvironment,
    ctx.property.propertyEnvironment,
    "propertyEnvironment",
  );
  if (env) reasons.push(env);

  reasons.push(...checkPropertyFields(rules.propertyFields, ctx));

  const spaceKeys = ctx.spaces.map((s) => s.spaceType);
  reasons.push(
    ...checkRequires(rules.requiresSpaces, spaceKeys, (s) => `missing space: ${s}`),
    ...checkRequires(rules.requiresSystems, ctx.systems, (s) => `missing system: ${s}`),
    ...checkRequires(rules.requiresAmenities, ctx.amenities, (a) => `missing amenity: ${a}`),
  );

  return reasons;
}

export function evaluateItemAvailability(
  rules: ItemRules | undefined | null,
  ctx: PropertyContext,
): EvaluationResult {
  if (!rules) return { available: true, reasons: [] };

  const reasons: string[] = [];

  // 1) not
  if (rules.not) {
    const inner = evaluateItemAvailability(rules.not, ctx);
    if (inner.available) reasons.push(REASON_NOT);
  }

  // 2) allOf
  if (rules.allOf) {
    for (const branch of rules.allOf) {
      const inner = evaluateItemAvailability(branch, ctx);
      if (!inner.available) {
        reasons.push(REASON_ALL_OF, ...inner.reasons);
      }
    }
  }

  // 3) anyOf
  if (rules.anyOf && rules.anyOf.length > 0) {
    const anyPass = rules.anyOf.some((branch) => evaluateItemAvailability(branch, ctx).available);
    if (!anyPass) reasons.push(REASON_ANY_OF);
  }

  // 4) atomic
  reasons.push(...evaluateAtomic(rules, ctx));

  return { available: reasons.length === 0, reasons };
}

/**
 * Field-visibility entry point.  Works on a single field's actual value and
 * a legacy `condition` object whose KEYS are operator names (`equals`,
 * `contains`, `intersects`, `prefix_contains`) and whose VALUES are the
 * corresponding operands. This is the unified replacement for the legacy
 * switch that used to live in taxonomy-loader.
 *
 * Backwards-compat mapping for legacy condition shapes:
 *   { equals: X }              → strict equality against the trigger value
 *   { contains: X }            → arrays include X (scalar compared directly)
 *   { intersects: [a, b] }     → arrays share any element with the operand
 *   { prefix_contains: "ax." } → string operand; also accepts string[] form
 */
export function evaluateFieldCondition(
  condition: Record<string, unknown>,
  actualValue: unknown,
): boolean {
  for (const [op, operand] of Object.entries(condition)) {
    switch (op) {
      case "equals":
        if (actualValue !== operand) return false;
        break;
      case "contains": {
        const arr = Array.isArray(actualValue) ? actualValue : [actualValue];
        if (!arr.includes(operand)) return false;
        break;
      }
      case "intersects": {
        const arr = Array.isArray(actualValue) ? actualValue : [actualValue];
        const want = Array.isArray(operand) ? operand : [operand];
        if (!want.some((v) => arr.includes(v))) return false;
        break;
      }
      case "prefix_contains": {
        const arr = Array.isArray(actualValue) ? actualValue : [actualValue];
        const prefixes = Array.isArray(operand) ? operand : [operand];
        const ok = arr.some((v) =>
          typeof v === "string" && prefixes.some((p) => typeof p === "string" && v.startsWith(p)),
        );
        if (!ok) return false;
        break;
      }
      default: {
        // Delegate to unified operator set for new-style predicates.
        const predicate = { [op]: operand } as OperatorPredicate;
        if (!evaluatePredicate(actualValue, predicate)) return false;
      }
    }
  }
  return true;
}
