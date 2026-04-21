import { describe, it, expect } from "vitest";
import { obfuscateAnchor } from "@/lib/services/map-obfuscation";

/** Haversine distance in meters between two coordinates. Independent of
 * the flat-earth conversion used inside `obfuscateAnchor` — if either the
 * degree-to-meter factor or the `cos(lat)` correction drifted, the
 * distance measured here would no longer match the computed radial draw. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

describe("obfuscateAnchor", () => {
  const MADRID = { lat: 40.4168, lng: -3.7038 };

  it("is deterministic for the same propertyId", () => {
    const out1 = obfuscateAnchor({ ...MADRID, propertyId: "prop-abc" });
    const out2 = obfuscateAnchor({ ...MADRID, propertyId: "prop-abc" });
    expect(out1).toEqual(out2);
  });

  it("produces different outputs for different propertyIds", () => {
    const a = obfuscateAnchor({ ...MADRID, propertyId: "prop-abc" });
    const b = obfuscateAnchor({ ...MADRID, propertyId: "prop-xyz" });
    expect(a.lat === b.lat && a.lng === b.lng).toBe(false);
  });

  it("never returns the identity transform (guards against null-jitter hashes)", () => {
    // Sample 50 ids; the MIN_R_FRACTION clamp must enforce strict offset
    // regardless of the hash draw.
    for (let i = 0; i < 50; i++) {
      const id = `prop-${i.toString().padStart(3, "0")}`;
      const out = obfuscateAnchor({ ...MADRID, propertyId: id });
      expect(out.lat).not.toBe(MADRID.lat);
      expect(out.lng).not.toBe(MADRID.lng);
    }
  });

  it("enforces the minimum radial offset via the clamp", () => {
    // With MIN_R_FRACTION = 0.1 and R = 300m, the haversine distance must
    // be ≥ 300 · sqrt(0.1) ≈ 94.87m for any propertyId.
    const radius = 300;
    const minDist = radius * Math.sqrt(0.1);
    for (let i = 0; i < 50; i++) {
      const id = `prop-${i.toString().padStart(3, "0")}`;
      const out = obfuscateAnchor({
        ...MADRID,
        propertyId: id,
        radiusMeters: radius,
      });
      const dist = haversineMeters(MADRID.lat, MADRID.lng, out.lat, out.lng);
      // 2m slack absorbs the flat-earth-vs-haversine mismatch at mid latitudes
      // (constant METERS_PER_DEG_LAT overestimates by ~0.3% at lat 40°).
      expect(dist).toBeGreaterThanOrEqual(minDist - 2);
    }
  });

  it("keeps every offset within the requested radius", () => {
    const radius = 300;
    // Sample many ids to hit a range of (u1, theta) pairs.
    for (let i = 0; i < 100; i++) {
      const id = `prop-bound-${i}`;
      const out = obfuscateAnchor({
        ...MADRID,
        propertyId: id,
        radiusMeters: radius,
      });
      const dist = haversineMeters(MADRID.lat, MADRID.lng, out.lat, out.lng);
      // 1m slack for the flat-earth-vs-haversine mismatch at 300m scale.
      expect(dist).toBeLessThanOrEqual(radius + 1);
    }
  });

  it("applies cos(lat) correction so offsets measure the same in meters at any latitude", () => {
    // Same propertyId → identical (east, north) meter offsets. The
    // haversine distance from input to output must match in both cases:
    // if the cos(lat) correction were missing, the high-lat output would
    // land closer (smaller deltaLng in meters) than the equator output.
    const radius = 300;
    const atEquator = obfuscateAnchor({
      lat: 0,
      lng: 0,
      propertyId: "prop-cos-check",
      radiusMeters: radius,
    });
    const atHighLat = obfuscateAnchor({
      lat: 60,
      lng: 0,
      propertyId: "prop-cos-check",
      radiusMeters: radius,
    });
    const distEq = haversineMeters(0, 0, atEquator.lat, atEquator.lng);
    const distHi = haversineMeters(60, 0, atHighLat.lat, atHighLat.lng);
    // If cos(60°) ≈ 0.5 were NOT applied, distHi would be ≈ 0.5 · distEq.
    // Tolerance of 1m absorbs the flat-earth vs haversine mismatch.
    expect(Math.abs(distHi - distEq)).toBeLessThan(1);
  });

  it("returns a radius-tagged obfuscated variant", () => {
    const out = obfuscateAnchor({
      ...MADRID,
      propertyId: "prop-abc",
      radiusMeters: 500,
    });
    expect(out.obfuscated).toBe(true);
    expect(out.radiusMeters).toBe(500);
  });

  it("defaults radiusMeters to 300 when omitted", () => {
    const out = obfuscateAnchor({ ...MADRID, propertyId: "prop-abc" });
    expect(out.radiusMeters).toBe(300);
  });
});
