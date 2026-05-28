// Tri-state accessibility persistence helpers.
//
// `ax.no_accessibility` is a mutex sentinel inside the accessibility-features
// chip group: selecting it clears all positive features, and any positive
// feature clears the sentinel. Persistence then splits into three legs that
// downstream surfaces (completeness scoring, guest filtering) rely on:
//
//   • sentinel only           -> hasAccessibilityConsiderations = false
//   • any positive feature    -> hasAccessibilityConsiderations = true
//   • empty (never answered)  -> hasAccessibilityConsiderations = null
//
// `customLabel` / `customDesc` only bind when `ax.other` is selected — a
// deselect-then-reselect must not resurrect stale free-text.

export const NO_ACCESSIBILITY_ID = "ax.no_accessibility";
export const OTHER_ACCESSIBILITY_ID = "ax.other";

/** Normalize the raw form-submitted feature list: drop unknown ids, then
 * collapse to the tri-state mutex. If any positive feature is present, the
 * sentinel is silently dropped (positives win). If only the sentinel was
 * submitted, returns `[sentinel]`. Empty otherwise. */
export function normalizeAccessibilityFeatures(
  rawFeatures: readonly string[],
  validIds: ReadonlySet<string>,
): string[] {
  const filtered = rawFeatures.filter((id) => validIds.has(id));
  const positives = filtered.filter((id) => id !== NO_ACCESSIBILITY_ID);
  if (positives.length > 0) return positives;
  return filtered.includes(NO_ACCESSIBILITY_ID) ? [NO_ACCESSIBILITY_ID] : [];
}

export interface AccessibilityShape {
  features: string[];
  customLabel: string | null;
  customDesc: string | null;
}

export interface AccessibilityPersistence {
  /** Column value on `Property.hasAccessibilityConsiderations`. */
  hasConsiderations: boolean | null;
  /** Shape for `accessMethodsJson.accessibility`; null when no positives so a
   * "Sin consideraciones" row is not synthesized from an opt-out. */
  accessJsonShape: AccessibilityShape | null;
  /** Whether the sentinel was the only entry (opt-out). */
  isOptOut: boolean;
  /** Positive-only feature ids (excludes sentinel). */
  positiveFeatures: string[];
}

/** Derive the persistence shape for already-normalized features. Callers
 * should run `normalizeAccessibilityFeatures` first (which the access save
 * action does pre-schema-parse, so this receives the validated subset). */
export function deriveAccessibilityPersistence(input: {
  features: readonly string[];
  customLabel: string | null;
  customDesc: string | null;
}): AccessibilityPersistence {
  const isOptOut = input.features.includes(NO_ACCESSIBILITY_ID);
  const positiveFeatures = input.features.filter(
    (id) => id !== NO_ACCESSIBILITY_ID,
  );
  const hasConsiderations: boolean | null = isOptOut
    ? false
    : positiveFeatures.length > 0
      ? true
      : null;
  const hasOther = positiveFeatures.includes(OTHER_ACCESSIBILITY_ID);
  const accessJsonShape: AccessibilityShape | null =
    positiveFeatures.length > 0
      ? {
          features: positiveFeatures,
          customLabel: hasOther ? input.customLabel : null,
          customDesc: hasOther ? input.customDesc : null,
        }
      : null;
  return { hasConsiderations, accessJsonShape, isOptOut, positiveFeatures };
}
