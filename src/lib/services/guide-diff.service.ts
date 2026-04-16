/**
 * GuideDiffService — computes a structural diff between two GuideTree snapshots.
 * Used on-the-fly in the publishing page to show what changed since the last
 * published version (9C).
 */

import type { GuideTree, GuideSection, GuideItem } from "@/lib/types/guide-tree";

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

export type DiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface ItemDiff {
  id: string;
  label: string;
  status: DiffStatus;
  /** Only present when status === "changed" — human-readable list of what changed. */
  changes?: string[];
}

export interface SectionDiff {
  id: string;
  label: string;
  status: DiffStatus;
  /** Metadata-level changes on the section itself (label, order, etc). */
  metadataChanges?: string[];
  items: ItemDiff[];
}

export interface GuideDiff {
  sections: SectionDiff[];
  stats: {
    sectionsAdded: number;
    sectionsRemoved: number;
    itemsAdded: number;
    itemsRemoved: number;
    itemsChanged: number;
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function itemFingerprint(item: GuideItem): string {
  const fieldParts = item.fields
    .map((f) => `${f.label}:${f.value}:${f.visibility}`)
    .join("|");
  const mediaParts = item.media
    .map((m) => `${m.url}:${m.role ?? ""}:${m.caption ?? ""}`)
    .join("|");
  const childParts = item.children.map((c) => itemFingerprint(c)).join("|");
  return [
    item.label,
    item.value ?? "",
    item.visibility,
    item.taxonomyKey ?? "",
    String(item.deprecated),
    item.warnings.join(","),
    fieldParts,
    mediaParts,
    childParts,
  ].join("::");
}

function diffItems(
  oldItems: GuideItem[],
  newItems: GuideItem[],
): ItemDiff[] {
  const oldMap = new Map(oldItems.map((i) => [i.id, i]));
  const newMap = new Map(newItems.map((i) => [i.id, i]));
  const result: ItemDiff[] = [];

  // Items in new tree
  for (const [id, newItem] of newMap) {
    const oldItem = oldMap.get(id);
    if (!oldItem) {
      result.push({ id, label: newItem.label, status: "added" });
    } else {
      const oldFp = itemFingerprint(oldItem);
      const newFp = itemFingerprint(newItem);
      if (oldFp === newFp) {
        result.push({ id, label: newItem.label, status: "unchanged" });
      } else {
        const changes = describeChanges(oldItem, newItem);
        result.push({ id, label: newItem.label, status: "changed", changes });
      }
    }
  }

  // Items removed (in old but not new)
  for (const [id, oldItem] of oldMap) {
    if (!newMap.has(id)) {
      result.push({ id, label: oldItem.label, status: "removed" });
    }
  }

  return result;
}

function describeChanges(oldItem: GuideItem, newItem: GuideItem): string[] {
  const changes: string[] = [];
  if (oldItem.label !== newItem.label) {
    changes.push(`label: "${oldItem.label}" → "${newItem.label}"`);
  }
  if (oldItem.value !== newItem.value) {
    changes.push(`value: "${oldItem.value ?? ""}" → "${newItem.value ?? ""}"`);
  }
  if (oldItem.visibility !== newItem.visibility) {
    changes.push(`visibility: ${oldItem.visibility} → ${newItem.visibility}`);
  }

  const oldFieldIds = new Set(oldItem.fields.map((f) => f.label));
  const newFieldIds = new Set(newItem.fields.map((f) => f.label));
  const addedFields = [...newFieldIds].filter((f) => !oldFieldIds.has(f));
  const removedFields = [...oldFieldIds].filter((f) => !newFieldIds.has(f));
  if (addedFields.length > 0) changes.push(`campos añadidos: ${addedFields.join(", ")}`);
  if (removedFields.length > 0) changes.push(`campos eliminados: ${removedFields.join(", ")}`);

  // Check for value changes in shared fields
  const oldFieldMap = new Map(oldItem.fields.map((f) => [f.label, f]));
  for (const f of newItem.fields) {
    const old = oldFieldMap.get(f.label);
    if (old && (old.value !== f.value || old.visibility !== f.visibility)) {
      changes.push(`campo "${f.label}" modificado`);
    }
  }

  return changes;
}

function describeSectionMetadataChanges(
  oldSec: GuideSection,
  newSec: GuideSection,
): string[] {
  const changes: string[] = [];
  if (oldSec.label !== newSec.label) {
    changes.push(`label: "${oldSec.label}" → "${newSec.label}"`);
  }
  if (oldSec.order !== newSec.order) {
    changes.push(`order: ${oldSec.order} → ${newSec.order}`);
  }
  if (oldSec.maxVisibility !== newSec.maxVisibility) {
    changes.push(`maxVisibility: ${oldSec.maxVisibility} → ${newSec.maxVisibility}`);
  }
  if (oldSec.sortBy !== newSec.sortBy) {
    changes.push(`sortBy: ${oldSec.sortBy} → ${newSec.sortBy}`);
  }
  return changes;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Compute a structural diff between two GuideTree snapshots.
 * `oldTree` is typically the last published version; `newTree` is the live tree.
 * Either may be null (first publish = oldTree is null, unpublished = newTree is null).
 */
export function computeGuideDiff(
  oldTree: GuideTree | null,
  newTree: GuideTree | null,
): GuideDiff {
  const oldSections = oldTree?.sections ?? [];
  const newSections = newTree?.sections ?? [];
  const oldMap = new Map<string, GuideSection>(oldSections.map((s) => [s.id, s]));
  const newMap = new Map<string, GuideSection>(newSections.map((s) => [s.id, s]));

  const sections: SectionDiff[] = [];
  let sectionsAdded = 0;
  let sectionsRemoved = 0;
  let itemsAdded = 0;
  let itemsRemoved = 0;
  let itemsChanged = 0;

  // Sections in new tree
  for (const [id, newSec] of newMap) {
    const oldSec = oldMap.get(id);
    if (!oldSec) {
      sectionsAdded++;
      const items = newSec.items.map((i) => ({
        id: i.id,
        label: i.label,
        status: "added" as const,
      }));
      itemsAdded += items.length;
      sections.push({ id, label: newSec.label, status: "added", items });
    } else {
      const items = diffItems(oldSec.items, newSec.items);
      const sectionItemsAdded = items.filter((i) => i.status === "added").length;
      const sectionItemsRemoved = items.filter((i) => i.status === "removed").length;
      const sectionItemsChanged = items.filter((i) => i.status === "changed").length;
      itemsAdded += sectionItemsAdded;
      itemsRemoved += sectionItemsRemoved;
      itemsChanged += sectionItemsChanged;

      // Detect section metadata changes
      const metadataChanges = describeSectionMetadataChanges(oldSec, newSec);
      const hasChanges =
        sectionItemsAdded + sectionItemsRemoved + sectionItemsChanged > 0 ||
        metadataChanges.length > 0;
      sections.push({
        id,
        label: newSec.label,
        status: hasChanges ? "changed" : "unchanged",
        ...(metadataChanges.length > 0 && { metadataChanges }),
        items,
      });
    }
  }

  // Sections removed
  for (const [id, oldSec] of oldMap) {
    if (!newMap.has(id)) {
      sectionsRemoved++;
      const items = oldSec.items.map((i) => ({
        id: i.id,
        label: i.label,
        status: "removed" as const,
      }));
      itemsRemoved += items.length;
      sections.push({ id, label: oldSec.label, status: "removed", items });
    }
  }

  return {
    sections,
    stats: { sectionsAdded, sectionsRemoved, itemsAdded, itemsRemoved, itemsChanged },
  };
}
