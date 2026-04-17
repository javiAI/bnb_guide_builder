import type {
  GuideAudience,
  GuideItem,
  GuideItemField,
  GuideSection,
} from "@/lib/types/guide-tree";

/** Shared helpers for md/html/pdf/React renderers.
 *
 * After the presentation layer runs, every item on a normalized tree carries
 * `displayValue` / `displayFields`. Pre-normalized trees (legacy test
 * fixtures) may still be missing them — we fall back to `value` / `fields` so
 * the renderer never crashes. For guest trees the normalizer is mandatory
 * upstream; the fallback is a defensive net, not a guest code path. */

export function resolveDisplayValue(item: GuideItem): string | null {
  if (item.displayValue !== undefined) {
    return item.displayValue === "" ? null : item.displayValue;
  }
  return item.value;
}

/** Returns fields shaped as `GuideItemField` for renderer symmetry — every
 * renderer already knows how to iterate `{ label, value, visibility }`. */
export function resolveDisplayFields(item: GuideItem): GuideItemField[] {
  if (item.displayFields) {
    return item.displayFields.map((f) => ({
      label: f.label,
      value: f.displayValue,
      visibility: f.visibility,
    }));
  }
  return item.fields;
}

/** Items whose presenter failed (`presentationType === "raw"`) are hidden
 * from guest output and emit a `missing-presenter` log once. */
export function filterRenderableItems(
  items: GuideItem[],
  audience: GuideAudience,
): GuideItem[] {
  if (audience !== "guest") return items;
  return items.filter((item) => {
    if (item.presentationType === "raw") {
      console.warn(
        `[guide-presenter] missing-presenter item=${item.id} taxonomyKey=${item.taxonomyKey}`,
      );
      return false;
    }
    return true;
  });
}

/** Audience-aware empty copy. Returns `null` when nothing should be shown. */
export function resolveEmptyCopy(
  section: GuideSection,
  audience: GuideAudience,
): string | null {
  if (audience === "guest") return section.emptyCopyGuest ?? null;
  return section.emptyCopy ?? null;
}

export function shouldHideSection(
  section: GuideSection,
  audience: GuideAudience,
  renderableItems: GuideItem[],
): boolean {
  if (audience !== "guest") return false;
  if (renderableItems.length > 0) return false;
  return section.hideWhenEmptyForGuest === true;
}
