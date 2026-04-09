/**
 * Field dependency engine.
 *
 * Wraps the dynamic_field_rules taxonomy into a usable API for forms.
 * Field visibility, defaults, and cleanup are all driven by the
 * centralized rules — not hardcoded in React components.
 *
 * Usage in a form component:
 *
 *   const deps = resolveFieldDependencies({
 *     "arrival.access.method": "am.smart_lock",
 *     "amenities.selected": ["am.wifi", "am.coffee_maker"],
 *   });
 *
 *   // deps.visibleFields → Set of field IDs to show
 *   // deps.defaults → merged defaults from all matched rules
 *   // deps.matchedRules → array of matched rule IDs (for debugging)
 */

import {
  dynamicFieldRules,
  getRulesForTrigger,
  evaluateRule,
} from "@/lib/taxonomy-loader";
import type { DynamicFieldRule, RuleConditionValue } from "@/lib/types/taxonomy";

export interface DependencyResult {
  /** Set of field IDs that should be visible */
  visibleFields: Set<string>;
  /** Merged default values from all matched rules */
  defaults: Record<string, unknown>;
  /** IDs of matched rules (for debugging/audit) */
  matchedRules: string[];
}

/**
 * Given the current form state (trigger → value), evaluate all
 * dynamic field rules and return which fields should be visible,
 * with their defaults.
 */
export function resolveFieldDependencies(
  formState: Record<string, RuleConditionValue>,
): DependencyResult {
  const visibleFields = new Set<string>();
  const defaults: Record<string, unknown> = {};
  const matchedRules: string[] = [];

  for (const [trigger, currentValue] of Object.entries(formState)) {
    const rules = getRulesForTrigger(trigger);

    for (const rule of rules) {
      if (evaluateRule(rule, currentValue)) {
        matchedRules.push(rule.id);
        for (const field of rule.shown_fields) {
          visibleFields.add(field);
        }
        if (rule.defaults) {
          Object.assign(defaults, rule.defaults);
        }
      }
    }
  }

  return { visibleFields, defaults, matchedRules };
}

/**
 * Get all unique triggers defined in the dynamic field rules.
 * Useful for knowing which form fields need to report changes.
 */
export function getAllTriggers(): string[] {
  const triggers = new Set<string>();
  for (const rule of dynamicFieldRules.items) {
    triggers.add(rule.trigger);
  }
  return Array.from(triggers);
}

/**
 * Get all fields that could potentially be shown by any rule.
 * Useful for knowing which fields to include in the form schema
 * even if initially hidden.
 */
export function getAllDependentFields(): string[] {
  const fields = new Set<string>();
  for (const rule of dynamicFieldRules.items) {
    for (const field of rule.shown_fields) {
      fields.add(field);
    }
  }
  return Array.from(fields);
}

/**
 * Get all rules that mention a specific field in shown_fields.
 * Useful for understanding "why is this field shown?"
 */
export function getRulesShowingField(fieldId: string): DynamicFieldRule[] {
  return dynamicFieldRules.items.filter((rule) =>
    rule.shown_fields.includes(fieldId),
  );
}
