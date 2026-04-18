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
 * from guest output. Recursive: a raw item buried under a renderable parent
 * would otherwise leak through renderer recursion (`item.children` map in
 * md/html/pdf/React). Returns cloned items whose `children` are deep-filtered;
 * non-raw items with no raw descendants are returned by reference so
 * downstream equality checks stay cheap. Emits one `missing-presenter` log
 * per distinct item id within a single call — the normalizer's aggregated log
 * covers batched counts; this is a per-render trace so the specific item is
 * identifiable. */
export function filterRenderableItems(
  items: GuideItem[],
  audience: GuideAudience,
): GuideItem[] {
  if (audience !== "guest") return items;
  const loggedIds = new Set<string>();
  const logRaw = (item: GuideItem) => {
    if (loggedIds.has(item.id)) return;
    loggedIds.add(item.id);
    console.warn(
      `[guide-presenter] missing-presenter item=${item.id} taxonomyKey=${item.taxonomyKey}`,
    );
  };
  const deepFilter = (list: GuideItem[]): GuideItem[] => {
    const out: GuideItem[] = [];
    for (const item of list) {
      if (item.presentationType === "raw") {
        logRaw(item);
        continue;
      }
      const filteredChildren = deepFilter(item.children);
      out.push(
        filteredChildren === item.children
          ? item
          : { ...item, children: filteredChildren },
      );
    }
    return out.length === list.length && out.every((v, i) => v === list[i])
      ? list
      : out;
  };
  return deepFilter(items);
}

/** Audience-aware empty copy. Returns `null` when nothing should be shown. */
export function resolveEmptyCopy(
  section: GuideSection,
  audience: GuideAudience,
): string | null {
  if (audience === "guest") return section.emptyCopyGuest ?? null;
  return section.emptyCopy ?? null;
}

/** For `audience=guest`, an empty section is hidden when (a) it opted in via
 * `hideWhenEmptyForGuest`, or (b) it has no `emptyCopyGuest` declared — a
 * heading without body would either read as a bug or invite the host
 * `emptyCopy` (which must never reach guest). Hiding silently + logging
 * `guest-section-missing-empty-copy` surfaces CMS misconfiguration without
 * leaking editorial copy. */
export function shouldHideSection(
  section: GuideSection,
  audience: GuideAudience,
  renderableItems: GuideItem[],
): boolean {
  if (audience !== "guest") return false;
  if (renderableItems.length > 0) return false;
  if (section.hideWhenEmptyForGuest === true) return true;
  if (!section.emptyCopyGuest) {
    console.warn(
      `[guide-presenter] guest-section-missing-empty-copy section=${section.id}`,
    );
    return true;
  }
  return false;
}
