import { describe, it, expect } from "vitest";
import {
  coveredManifestEntries,
} from "@/lib/exports/airbnb/manifest";
import {
  getManifestIndex,
  entryKey,
  uncoveredManifestEntries,
} from "@/lib/exports/airbnb/engine";

// Forward execution gate (rama 14B): every `relevance: "covered"` entry in
// airbnb-structured-fields.json must have at least one taxonomy item whose
// `source[]` references it. Otherwise the engine emits nothing for that
// field and the host gets a silent gap. The reverse coverage test (14A)
// already gates the opposite direction — that no covered Airbnb concept
// lacks an internal item — so the two together close the loop.

describe("Airbnb export — manifest coverage", () => {
  it("every covered manifest entry has at least one taxonomy item targeting it", () => {
    const gaps = uncoveredManifestEntries();
    expect(gaps).toEqual([]);
  });

  it("manifest index has an entry for every covered manifest entry key", () => {
    const index = getManifestIndex();
    for (const entry of coveredManifestEntries) {
      const key = entryKey(entry);
      expect(index.byKey.get(key)).toBeDefined();
    }
  });
});
