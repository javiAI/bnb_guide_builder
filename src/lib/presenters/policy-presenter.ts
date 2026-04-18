import type {
  GuideAudience,
  GuideItem,
  GuideItemDisplayField,
} from "@/lib/types/guide-tree";
import { findPolicyItem } from "@/lib/taxonomy-loader";
import type { PolicyItemField, TaxonomyOption } from "@/lib/types/taxonomy";
import {
  TAXONOMY_KEY_PATTERN,
  looksLikeRawJson,
  type Presenter,
  type PresenterOutput,
} from "./types";

/** Humanizes policy items (`pol.*`). Policies arrive from `resolvePoliciesByStage`
 * with `value` stringified from the raw `policiesJson` — this can be a JSON
 * object (`{"allowed":true,"fee":50}`), an enum option (`outdoor_only`), a
 * number (`4`), or a boolean.
 *
 * Strategy:
 *  1. If `value` is a JSON blob → parse, spread keys as `displayFields` using
 *     the policy taxonomy's `fields[]` for labels + `options[]` for option
 *     humanization. Primary `displayValue` stays empty.
 *  2. Otherwise → translate through `options[]` if available; else apply
 *     boolean/number formatting; else pass through unless it matches a raw
 *     taxonomy key (invariant 2) or raw-JSON sentinel (invariant 1). */
export const policyPresenter: Presenter = (
  item: GuideItem,
  audience: GuideAudience,
): PresenterOutput => {
  const warnings: string[] = [];
  const taxonomyItem = item.taxonomyKey ? findPolicyItem(item.taxonomyKey) : undefined;
  const raw = item.value ?? "";

  // Non-guest audiences see the raw value plus raw fields — internal
  // operators need to inspect the model as stored.
  if (audience !== "guest") {
    return {
      presentationType: "policy",
      displayValue: raw,
      displayFields: item.fields.map(passthroughField),
      warnings,
    };
  }

  if (raw && looksLikeRawJson(raw)) {
    const parsed = safeParseJson(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const displayFields = expandObject(
        parsed as Record<string, unknown>,
        taxonomyItem?.fields ?? [],
        item.visibility,
        warnings,
      );
      return {
        presentationType: "policy",
        displayValue: "",
        displayFields: [...item.fields.map(passthroughField), ...displayFields],
        warnings,
      };
    }
    warnings.push(`policy: unparseable json for ${item.taxonomyKey ?? "?"}`);
    return {
      presentationType: "policy",
      displayValue: "",
      displayFields: item.fields.map(passthroughField),
      warnings,
    };
  }

  return {
    presentationType: "policy",
    displayValue: humanizeScalar(raw, taxonomyItem?.options ?? [], warnings, item.taxonomyKey),
    displayFields: item.fields.map(passthroughField),
    warnings,
  };
};

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function expandObject(
  obj: Record<string, unknown>,
  taxonomyFields: PolicyItemField[],
  visibility: GuideAudience,
  warnings: string[],
): GuideItemDisplayField[] {
  const byId = new Map(taxonomyFields.map((f) => [f.id, f]));
  const out: GuideItemDisplayField[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === "") continue;
    const field = byId.get(key);
    const label = field?.guestLabel ?? field?.label ?? key;
    const displayValue = humanizeScalar(
      typeof value === "object" ? JSON.stringify(value) : String(value),
      field?.options ?? [],
      warnings,
      key,
    );
    if (!displayValue) continue;
    out.push({
      label,
      displayValue,
      visibility,
      icon: field?.icon,
    });
  }
  return out;
}

function humanizeScalar(
  value: string,
  options: TaxonomyOption[],
  warnings: string[],
  sourceKey: string | null,
): string {
  if (!value) return "";
  if (value === "true") return "Sí";
  if (value === "false") return "No";
  if (value === "null") return "";

  const opt = options.find((o) => o.id === value);
  if (opt) return opt.guestLabel ?? opt.label;

  if (TAXONOMY_KEY_PATTERN.test(value.trim())) {
    warnings.push(`policy: dropped untranslated taxonomy key ${sourceKey ?? "?"}=${value}`);
    return "";
  }
  if (looksLikeRawJson(value)) {
    warnings.push(`policy: dropped raw-json scalar ${sourceKey ?? "?"}`);
    return "";
  }
  return value;
}

function passthroughField(f: GuideItem["fields"][number]): GuideItemDisplayField {
  return {
    label: f.label,
    displayValue: f.value,
    visibility: f.visibility,
  };
}
