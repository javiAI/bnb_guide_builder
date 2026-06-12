/**
 * Contract test for the bedding-options taxonomy (`bedding_options.json`).
 * These options are persisted by id into `Bed.configJson` (free JSON, no FK),
 * so the ids must stay stable and unique. Pins the loader against the JSON and
 * locks the id sets so a rename can't silently orphan stored values.
 */
import { describe, it, expect } from "vitest";
import {
  mattressTypes,
  mattressFirmness,
  pillowTypes,
} from "@/lib/taxonomies/bedding-options";

function ids(list: { id: string }[]) {
  return list.map((o) => o.id);
}

describe("bedding-options taxonomy", () => {
  it("exposes the three option lists with stable, persisted ids", () => {
    expect(ids(mattressTypes)).toEqual(["spring", "memory_foam", "latex", "foam", "hybrid", "air", "other"]);
    expect(ids(mattressFirmness)).toEqual(["soft", "medium", "firm"]);
    expect(ids(pillowTypes)).toEqual(["down", "synthetic", "memory_foam", "bamboo", "firm", "adjustable"]);
  });

  it("has unique ids and non-empty Spanish labels within each list", () => {
    for (const list of [mattressTypes, mattressFirmness, pillowTypes]) {
      const seen = new Set<string>();
      for (const opt of list) {
        expect(opt.id).toMatch(/^[a-z][a-z_]*$/);
        expect(opt.label.trim().length).toBeGreaterThan(0);
        expect(seen.has(opt.id)).toBe(false);
        seen.add(opt.id);
      }
    }
  });
});
