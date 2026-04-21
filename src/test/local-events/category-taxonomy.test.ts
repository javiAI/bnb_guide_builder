import { describe, it, expect } from "vitest";
import {
  localEventCategories,
  findLocalEventCategory,
  isLocalEventCategoryKey,
} from "@/lib/taxonomy-loader";

// Canonical `le.<slug>` keys shipped with rama 13B. Locking them here pins
// the universe that providers must map to — adding a new id requires touching
// this list so downstream provider category-mapping tables stay in sync.
const CANONICAL_EVENT_KEYS = [
  "le.concert",
  "le.sports",
  "le.arts",
  "le.family",
  "le.festival",
  "le.exhibition",
  "le.community",
  "le.workshop",
  "le.nightlife",
  "le.other",
] as const;

describe("local_event_categories.json", () => {
  it("loads and exposes all canonical categories", () => {
    expect(localEventCategories.items.length).toBe(
      CANONICAL_EVENT_KEYS.length,
    );
  });

  it("prefixes every id with `le.`", () => {
    for (const item of localEventCategories.items) {
      expect(item.id).toMatch(/^le\.[a-z][a-z0-9_]*$/);
    }
  });

  it("has no duplicate ids", () => {
    const ids = localEventCategories.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships Spanish labels (non-empty, not English placeholders)", () => {
    for (const item of localEventCategories.items) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.label).not.toMatch(/^(todo|tbd|placeholder)/i);
    }
  });

  it("ships a non-empty description for every category", () => {
    for (const item of localEventCategories.items) {
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("exposes every canonical key", () => {
    for (const key of CANONICAL_EVENT_KEYS) {
      const entry = findLocalEventCategory(key);
      expect(entry, `missing ${key}`).toBeDefined();
    }
  });

  it("findLocalEventCategory returns undefined for unknown ids", () => {
    expect(findLocalEventCategory("le.unknown_xyz")).toBeUndefined();
    expect(findLocalEventCategory("concert")).toBeUndefined();
  });

  it("isLocalEventCategoryKey discriminates known vs unknown keys", () => {
    expect(isLocalEventCategoryKey("le.concert")).toBe(true);
    expect(isLocalEventCategoryKey("le.other")).toBe(true);
    expect(isLocalEventCategoryKey("concert")).toBe(false);
    expect(isLocalEventCategoryKey("")).toBe(false);
  });

  it("rejects cross-namespace leaks from the place taxonomy", () => {
    expect(isLocalEventCategoryKey("lp.restaurant")).toBe(false);
    expect(isLocalEventCategoryKey("lp.other")).toBe(false);
  });

  it("rejects raw provider category strings", () => {
    expect(isLocalEventCategoryKey("music")).toBe(false);
    expect(isLocalEventCategoryKey("Concerts")).toBe(false);
    expect(isLocalEventCategoryKey("performing-arts")).toBe(false);
    expect(isLocalEventCategoryKey("KZFzniwnSyZfZ7v7nJ")).toBe(false);
  });
});
