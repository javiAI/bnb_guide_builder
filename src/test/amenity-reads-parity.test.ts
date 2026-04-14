import { describe, it, expect } from "vitest";
import {
  instanceKeyFor,
  spaceIdFromInstanceKey,
  isCanonicalInstanceKey,
} from "@/lib/amenity-instance-keys";

// Phase 2 / Branch 2C — reads parity.
//
// Invariant: the canonical instanceKey convention is a bijection between
// legacy `PropertyAmenity` rows and the canonical slice of
// `PropertyAmenityInstance` (+ its placements). This test pins that
// invariant at the key-helper level — if it ever breaks, the drift script
// will also scream, but this is a fast unit-level guard.
//
// Mapping:
//   legacy row {amenityKey, spaceId=null}   ↔  instance {amenityKey, instanceKey="default"}
//   legacy row {amenityKey, spaceId=X}      ↔  instance {amenityKey, instanceKey="space:X"} + placement(spaceId=X)
//   custom instance {instanceKey="..."}     ↔  (no legacy counterpart — excluded)

type LegacyRow = { amenityKey: string; spaceId: string | null };
type InstanceRow = {
  amenityKey: string;
  instanceKey: string;
  placements: { spaceId: string }[];
};

/** Normalize legacy rows to `amenityKey|spaceId` tuples (sorted). */
function legacyTuples(rows: LegacyRow[]): string[] {
  return rows.map((r) => `${r.amenityKey}|${r.spaceId ?? ""}`).sort();
}

/**
 * Normalize instance rows to the same `amenityKey|spaceId` tuples as legacy,
 * skipping non-canonical instances (custom amenities have no legacy mirror).
 *
 * For canonical "space:X" instances we emit one tuple per placement — this
 * tests the stronger invariant that placements on a canonical instance
 * match the spaceId encoded in the instanceKey (dual-write guarantees it,
 * the drift script verifies it, but wiring the parity here catches a whole
 * class of placement/key mismatches at unit speed). For "default" instances
 * we emit a single tuple with an empty spaceId.
 */
function instanceTuples(rows: InstanceRow[]): string[] {
  const tuples: string[] = [];
  for (const inst of rows) {
    if (!isCanonicalInstanceKey(inst.instanceKey)) continue;
    const spaceId = spaceIdFromInstanceKey(inst.instanceKey);
    if (spaceId === null) {
      tuples.push(`${inst.amenityKey}|`);
    } else {
      for (const p of inst.placements) {
        tuples.push(`${inst.amenityKey}|${p.spaceId}`);
      }
    }
  }
  return tuples.sort();
}

describe("amenity reads parity (legacy ↔ instance)", () => {
  it("bijects property-scoped and space-scoped amenities", () => {
    const legacy: LegacyRow[] = [
      { amenityKey: "am.wifi", spaceId: null },
      { amenityKey: "am.shower", spaceId: "s1" },
      { amenityKey: "am.shower", spaceId: "s2" },
      { amenityKey: "am.coffee_maker", spaceId: null },
    ];
    const instances: InstanceRow[] = [
      { amenityKey: "am.wifi", instanceKey: instanceKeyFor(null), placements: [] },
      { amenityKey: "am.shower", instanceKey: instanceKeyFor("s1"), placements: [{ spaceId: "s1" }] },
      { amenityKey: "am.shower", instanceKey: instanceKeyFor("s2"), placements: [{ spaceId: "s2" }] },
      { amenityKey: "am.coffee_maker", instanceKey: instanceKeyFor(null), placements: [] },
    ];

    expect(instanceTuples(instances)).toEqual(legacyTuples(legacy));
  });

  it("excludes non-canonical (custom) instances from the legacy-parity view", () => {
    const legacy: LegacyRow[] = [
      { amenityKey: "am.wifi", spaceId: null },
    ];
    const instances: InstanceRow[] = [
      { amenityKey: "am.wifi", instanceKey: "default", placements: [] },
      // Custom instance — no legacy mirror by design.
      { amenityKey: "custom.tea_station", instanceKey: "tea-v1", placements: [] },
    ];

    expect(instanceTuples(instances)).toEqual(legacyTuples(legacy));
  });

  it("round-trips the canonical key convention", () => {
    expect(spaceIdFromInstanceKey(instanceKeyFor(null))).toBeNull();
    expect(spaceIdFromInstanceKey(instanceKeyFor("s42"))).toBe("s42");
    expect(isCanonicalInstanceKey(instanceKeyFor(null))).toBe(true);
    expect(isCanonicalInstanceKey(instanceKeyFor("s42"))).toBe(true);
    expect(isCanonicalInstanceKey("custom-foo")).toBe(false);
  });

  it("detects drift: legacy row with no matching instance", () => {
    const legacy: LegacyRow[] = [
      { amenityKey: "am.wifi", spaceId: null },
      { amenityKey: "am.shower", spaceId: "s1" }, // orphan
    ];
    const instances: InstanceRow[] = [
      { amenityKey: "am.wifi", instanceKey: "default", placements: [] },
    ];
    expect(instanceTuples(instances)).not.toEqual(legacyTuples(legacy));
  });
});
