import type {
  GuideAudience,
  GuideItem,
  GuideItemDisplayField,
} from "@/lib/types/guide-tree";
import {
  TAXONOMY_KEY_PATTERN,
  looksLikeRawJson,
  type Presenter,
  type PresenterOutput,
} from "./types";

/** Default presenter used when no taxonomy-specific presenter is registered.
 *
 * For `audience=guest`: drops values that look like raw JSON or like a
 * taxonomy key (e.g. `ct.host`, `rm.smoking_outdoor_only`) so the internal
 * model can never leak. Field visibility is preserved — fields already
 * filtered out by `filterByAudience` never arrive here.
 *
 * For non-guest audiences: passes values through unchanged (operators need
 * to see raw data). */
export const genericTextPresenter: Presenter = (
  item: GuideItem,
  audience: GuideAudience,
): PresenterOutput => {
  const warnings: string[] = [];
  const isGuest = audience === "guest";

  const displayValue = sanitizeForAudience(item.value ?? "", isGuest, warnings, "value");

  const displayFields: GuideItemDisplayField[] = item.fields.map((f) => ({
    label: f.label,
    displayValue: sanitizeForAudience(f.value, isGuest, warnings, `field[${f.label}]`),
    visibility: f.visibility,
  }));

  return {
    presentationType: "generic_text",
    displayValue,
    displayFields,
    warnings,
  };
};

function sanitizeForAudience(
  value: string,
  isGuest: boolean,
  warnings: string[],
  source: string,
): string {
  if (!isGuest) return value;
  if (!value) return "";
  if (looksLikeRawJson(value)) {
    warnings.push(`generic-text: dropped raw-json ${source}`);
    return "";
  }
  if (TAXONOMY_KEY_PATTERN.test(value.trim())) {
    warnings.push(`generic-text: dropped taxonomy-key ${source} (${value})`);
    return "";
  }
  return value;
}
