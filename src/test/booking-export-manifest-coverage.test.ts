import { describe, it, expect } from "vitest";
import {
  coveredManifestEntries,
} from "@/lib/exports/booking/manifest";
import {
  getManifestIndex,
  entryKey,
  uncoveredManifestEntries,
} from "@/lib/exports/booking/engine";

// Forward execution gate (rama 14C): every `relevance: "covered"` entry in
// booking-structured-fields.json must have at least one taxonomy item whose
// `source[]` references it. Mirror of the Airbnb gate — together with the
// reverse-coverage tests in 14A, this closes the loop on both directions.

describe("Booking export — manifest coverage", () => {
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
