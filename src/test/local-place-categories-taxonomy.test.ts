import { describe, it, expect } from "vitest";
import {
  localPlaceCategories,
  findLocalPlaceCategory,
  isLocalPlaceCategoryKey,
} from "@/lib/taxonomy-loader";

// Legacy unprefixed category strings that the 13A migration backfills to
// `lp.<slug>`. Locking this map pins the migration target so renaming a
// category silently can't break already-seeded LocalPlace rows.
const LEGACY_CATEGORY_KEYS = [
  "restaurant",
  "cafe",
  "bar",
  "supermarket",
  "pharmacy",
  "hospital",
  "transport",
  "parking",
  "attraction",
  "beach",
  "park",
  "gym",
  "laundry",
  "other",
] as const;

describe("local_place_categories.json", () => {
  it("loads and exposes all canonical categories", () => {
    expect(localPlaceCategories.items.length).toBe(LEGACY_CATEGORY_KEYS.length);
  });

  it("prefixes every id with `lp.`", () => {
    for (const item of localPlaceCategories.items) {
      expect(item.id).toMatch(/^lp\.[a-z][a-z0-9_]*$/);
    }
  });

  it("has no duplicate ids", () => {
    const ids = localPlaceCategories.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships Spanish labels (non-empty, not English placeholders)", () => {
    for (const item of localPlaceCategories.items) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.label).not.toMatch(/^(todo|tbd|placeholder)/i);
    }
  });

  it("maps every legacy unprefixed key to an `lp.<key>` entry", () => {
    for (const key of LEGACY_CATEGORY_KEYS) {
      const entry = findLocalPlaceCategory(`lp.${key}`);
      expect(entry, `missing lp.${key}`).toBeDefined();
    }
  });

  it("findLocalPlaceCategory returns undefined for unknown ids", () => {
    expect(findLocalPlaceCategory("lp.unknown_xyz")).toBeUndefined();
    expect(findLocalPlaceCategory("restaurant")).toBeUndefined();
  });

  it("isLocalPlaceCategoryKey discriminates known vs unknown keys", () => {
    expect(isLocalPlaceCategoryKey("lp.restaurant")).toBe(true);
    expect(isLocalPlaceCategoryKey("restaurant")).toBe(false);
    expect(isLocalPlaceCategoryKey("")).toBe(false);
  });
});
