"use client";

import { useMemo, useRef } from "react";
import {
  resolveFieldDependencies,
  getAllDependentFields,
  type DependencyResult,
} from "@/config/schemas/field-dependencies";
import type { RuleConditionValue } from "@/lib/types/taxonomy";

export interface DynamicFieldsState {
  /** Set of field IDs currently visible */
  visibleFields: Set<string>;
  /** Merged defaults from matched rules */
  defaults: Record<string, unknown>;
  /** IDs of matched rules */
  matchedRules: string[];
  /** Fields that were previously visible but are now hidden (need cleanup) */
  hiddenFields: string[];
}

/**
 * React hook that wraps the declarative rule engine.
 *
 * Given a form state object (trigger → value), resolves which fields
 * should be visible, their defaults, and which fields need cleanup.
 *
 * Usage:
 *   const { visibleFields, defaults, hiddenFields } = useDynamicFields({
 *     "arrival.access.method": selectedAccessMethod,
 *     "amenities.selected": selectedAmenityKeys,
 *   });
 */
export function useDynamicFields(
  formState: Record<string, RuleConditionValue>,
): DynamicFieldsState {
  const previousFieldsRef = useRef<Set<string>>(new Set());

  return useMemo(() => {
    const result: DependencyResult = resolveFieldDependencies(formState);

    // Calculate hidden fields (were visible, now aren't)
    const hiddenFields: string[] = [];
    for (const field of previousFieldsRef.current) {
      if (!result.visibleFields.has(field)) {
        hiddenFields.push(field);
      }
    }

    // Update ref for next render
    previousFieldsRef.current = new Set(result.visibleFields);

    return {
      visibleFields: result.visibleFields,
      defaults: result.defaults,
      matchedRules: result.matchedRules,
      hiddenFields,
    };
  }, [formState]);
}

/** Cache the set of conditional fields */
let _conditionalFields: Set<string> | null = null;
function getConditionalFieldSet(): Set<string> {
  if (!_conditionalFields) {
    _conditionalFields = new Set(getAllDependentFields());
  }
  return _conditionalFields;
}

/**
 * Calculate form progress counting only active (visible) fields.
 *
 * Required fields that are hidden by rules don't count toward progress.
 */
export function calculateActiveProgress(
  allRequiredFields: string[],
  visibleFields: Set<string>,
  filledFields: Set<string>,
): { total: number; filled: number; percentage: number } {
  const conditionalFields = getConditionalFieldSet();

  // Only count required fields that are currently visible or not conditional
  const activeRequired = allRequiredFields.filter(
    (f) => visibleFields.has(f) || !conditionalFields.has(f),
  );

  const filled = activeRequired.filter((f) => filledFields.has(f)).length;
  const total = activeRequired.length;
  const percentage = total === 0 ? 100 : Math.round((filled / total) * 100);

  return { total, filled, percentage };
}
