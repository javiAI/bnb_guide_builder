/**
 * Deterministic anchor obfuscation for the guest map overlay (Rama 13C).
 *
 * Given a property's exact coordinates and a radius in meters, returns a
 * point inside a disk of that radius, offset by a jitter seeded from the
 * property id. The mapping is deterministic (same property → same
 * obfuscated point every render, so the circle doesn't "jitter" between
 * requests) but one-way: the seed input stays on the server, so a client
 * that knows the obfuscated point cannot recover the exact coordinates.
 *
 * Invariant for realistic inputs: away from the geographic poles the
 * function always returns a point visibly offset from the input. The
 * `MIN_R_FRACTION` clamp prevents the radial draw from collapsing to
 * identity. Exactly at the poles `cos(lat)=0` forces `deltaLng=0`, so a
 * hash drawing `theta ∈ {0, π}` could yield zero eastward displacement
 * while `deltaLat` still fires — and no rental property sits at the
 * pole, but the function stays total either way.
 */

import { createHash } from "node:crypto";
import type { GuideMapAnchor } from "@/lib/types/guide-map";

/** Meters per degree of latitude — flat-earth approximation accurate to
 * <0.1% over the ~300m radius we operate in; well within pixel noise on
 * any map tile. */
const METERS_PER_DEG_LAT = 111320;

/** Minimum fraction of the radial draw. With uniform disk sampling
 * `r = R * sqrt(u1)`, a pathological hash could collapse `r` to ~0 and
 * return the exact anchor. Clamping `u1` to `[MIN_R_FRACTION, 1)`
 * guarantees the output sits at least `R * sqrt(0.1) ≈ 0.316 · R` from
 * the exact anchor (≈95m for R=300m). */
const MIN_R_FRACTION = 0.1;

export interface ObfuscateAnchorInput {
  lat: number;
  lng: number;
  propertyId: string;
  /** Defaults to 300m. */
  radiusMeters?: number;
}

export function obfuscateAnchor({
  lat,
  lng,
  propertyId,
  radiusMeters = 300,
}: ObfuscateAnchorInput): Extract<GuideMapAnchor, { obfuscated: true }> {
  const [u1Raw, u2] = seedUniformFloats(`${propertyId}:map-anchor`);
  // Clamp u1 so the radial draw never collapses to identity.
  const u1 = Math.max(u1Raw, MIN_R_FRACTION);

  // Uniform disk sampling in polar coordinates. Converting back to
  // east/north meters keeps the cos(lat) scaling on longitude explicit.
  const r = radiusMeters * Math.sqrt(u1);
  const theta = 2 * Math.PI * u2;
  const offsetEastMeters = r * Math.cos(theta);
  const offsetNorthMeters = r * Math.sin(theta);

  const deltaLat = offsetNorthMeters / METERS_PER_DEG_LAT;
  const metersPerDegLngHere =
    METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  // Rental properties never sit at the pole; guard anyway so the function
  // stays total.
  const deltaLng =
    metersPerDegLngHere === 0 ? 0 : offsetEastMeters / metersPerDegLngHere;

  return {
    obfuscated: true,
    lat: lat + deltaLat,
    lng: lng + deltaLng,
    radiusMeters,
  };
}

function seedUniformFloats(input: string): [number, number] {
  const hash = createHash("sha256").update(input).digest();
  // Two independent big-endian u32 reads → two uniform draws in [0, 1).
  const u1 = hash.readUInt32BE(0) / 0x1_0000_0000;
  const u2 = hash.readUInt32BE(4) / 0x1_0000_0000;
  return [u1, u2];
}
