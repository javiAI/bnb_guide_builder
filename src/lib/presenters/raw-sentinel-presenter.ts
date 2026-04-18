import type {
  GuideAudience,
  GuideItem,
  GuideItemDisplayField,
} from "@/lib/types/guide-tree";
import type { Presenter, PresenterOutput } from "./types";

/** Sentinel presenter for items whose `taxonomyKey` has a non-null prefix that
 * nobody owns — neither a specialized presenter (`pol.*`, `fee.*`, `ct.*`)
 * nor the intentional-fallback allowlist (`sp.*`, `am.*`, `lp.*`). Always
 * emits `presentationType: "raw"`, which `filterRenderableItems` drops in
 * guest output (QA_AND_RELEASE §3 invariant 5). For non-guest audiences the
 * raw `value` / `fields` are mirrored into `displayValue` / `displayFields`
 * so operators can still see the unmapped data while triaging. */
export const rawSentinelPresenter: Presenter = (
  item: GuideItem,
  audience: GuideAudience,
): PresenterOutput => {
  const warnings = [`missing-presenter taxonomyKey=${item.taxonomyKey}`];
  if (audience === "guest") {
    return { presentationType: "raw", displayValue: "", displayFields: [], warnings };
  }
  const displayFields: GuideItemDisplayField[] = item.fields.map((f) => ({
    label: f.label,
    displayValue: f.value,
    visibility: f.visibility,
  }));
  return {
    presentationType: "raw",
    displayValue: item.value ?? "",
    displayFields,
    warnings,
  };
};
