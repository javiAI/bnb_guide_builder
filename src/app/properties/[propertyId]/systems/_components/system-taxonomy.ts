import { getSystemGroups } from "@/lib/taxonomy-loader";

/**
 * systemKey → group label lookup, built once. `SystemItem` does not carry its
 * group label (it lives on the parent `SystemGroup`), so both the list page and
 * the detail page need this mapping. Kept local to the systems module — the
 * shared `taxonomy-loader.ts` is off-limits during the 16E.5 parallel ports.
 */
const _groupLabelByKey: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of getSystemGroups()) for (const item of g.items) m.set(item.id, g.label);
  return m;
})();

export function groupLabelFor(systemKey: string): string {
  return _groupLabelByKey.get(systemKey) ?? "";
}
