/**
 * Builders for the two server-side payloads that drive the spatial and
 * temporal sides of `gs.local`:
 *
 * - `buildGuideMapData` — spatial: obfuscated property anchor + pins for
 *   audience-visible `LocalPlace` rows + pins for `LocalEvent` rows that
 *   have valid coordinates and fall inside the temporal window.
 *
 * - `buildGuideLocalEventsData` — temporal: the same `LocalEvent` rows
 *   in the same window, *also* including events without coordinates,
 *   ordered ascending by `startsAt`.
 *
 * Hard security invariants enforced here:
 *
 * 1. The exact `Property.latitude` / `Property.longitude` never appear in
 *    the returned `GuideMapData` when `audience !== "internal"`. The only
 *    path that emits exact coordinates is the explicit `internal` branch
 *    below. Any other audience goes through `obfuscateAnchor`.
 *
 * 2. `LocalPlace` pins pass through `isVisibleForAudience` (defence in
 *    depth even though all guest-visible places ultimately live in the
 *    same table).
 *
 * 3. `LocalEvent` has no `visibility` column today (13B merged without
 *    one). It is treated as implicitly guest-visible because the sync
 *    only pulls from public providers. Documented as a temporal
 *    invariant in `docs/SECURITY_AND_AUDIT.md`; if a future branch
 *    introduces private events, a `visibility` column must be added
 *    before this function can be reused for private hosts.
 */

import type { GuideAudience } from "@/lib/taxonomy-loader";
import { isVisibleForAudience } from "@/lib/taxonomy-loader";
import { prisma } from "@/lib/db";
import type {
  GuideLocalEventItem,
  GuideLocalEventsData,
  GuideMapAnchor,
  GuideMapData,
  GuideMapPin,
} from "@/lib/types/guide-map";
import { obfuscateAnchor } from "./map-obfuscation";
import { bucketizeDistance } from "./places/distance-bucket";
import {
  getLocalEventsForProperty,
  getLocalPlacesForProperty,
} from "./guide-local-data";

interface PropertyAnchorInput {
  id: string;
  latitude: number | null;
  longitude: number | null;
}

/** Temporal window applied identically to map pins and listing items:
 * starts within 24h in the past up to 30 days in the future. Events that
 * already started but haven't ended (e.g. a festival spanning days) are
 * kept by the `-24h` lower bound; longer-running events are out of scope
 * for 13C. */
const EVENT_WINDOW_PAST_MS = 24 * 60 * 60 * 1000;
const EVENT_WINDOW_FUTURE_MS = 30 * 24 * 60 * 60 * 1000;

export async function buildGuideMapData(
  propertyId: string,
  audience: GuideAudience,
  opts?: { now?: Date; property?: PropertyAnchorInput },
): Promise<GuideMapData | null> {
  // Sensitive audience never produces a renderable map. Internal is the
  // only path that surfaces exact coordinates.
  if (audience === "sensitive") return null;

  const now = opts?.now ?? new Date();

  // Callers that have already fetched `{id, latitude, longitude}` (e.g. the
  // `/g/[slug]` page, which reads the property by slug upfront) can pass it
  // in via `opts.property` and avoid a second findUnique-by-id.
  const [property, places, events] = await Promise.all([
    opts?.property !== undefined
      ? Promise.resolve(opts.property)
      : prisma.property.findUnique({
          where: { id: propertyId },
          select: { id: true, latitude: true, longitude: true },
        }),
    getLocalPlacesForProperty(propertyId),
    getLocalEventsForProperty(propertyId),
  ]);

  if (!property) return null;

  const anchor = buildAnchor(property, audience);
  const pins: GuideMapPin[] = [];

  for (const place of places) {
    if (place.latitude == null || place.longitude == null) continue;
    if (!isVisibleForAudience(place.visibility, audience)) continue;
    // SECURITY — triangulation: exact `distanceMeters` combined with the
    // place's exact coords lets a client intersect circles and recover the
    // (obfuscated-away) property anchor. For guest/ai we emit a coarse
    // `distanceBucketKey` (<200m / 200–500m / 500m–1km / >1km); the bucket
    // width matches the obfuscation disk resolution, so triangulation gains
    // no new information. Internal callers (ops) keep exact meters.
    const distanceAnnotation =
      place.distanceMeters == null
        ? {}
        : audience === "internal"
          ? { distanceMeters: place.distanceMeters }
          : { distanceBucketKey: bucketizeDistance(place.distanceMeters) };

    pins.push({
      id: place.id,
      kind: "place",
      lat: place.latitude,
      lng: place.longitude,
      categoryKey: place.categoryKey,
      label: place.name,
      ...distanceAnnotation,
    });
  }

  const windowStart = new Date(now.getTime() - EVENT_WINDOW_PAST_MS);
  const windowEnd = new Date(now.getTime() + EVENT_WINDOW_FUTURE_MS);
  for (const event of events) {
    if (event.latitude == null || event.longitude == null) continue;
    if (event.startsAt < windowStart || event.startsAt > windowEnd) continue;
    pins.push({
      id: event.id,
      kind: "event",
      lat: event.latitude,
      lng: event.longitude,
      categoryKey: event.categoryKey,
      label: event.title,
      startsAt: event.startsAt.toISOString(),
    });
  }

  return { anchor, pins };
}

export async function buildGuideLocalEventsData(
  propertyId: string,
  audience: GuideAudience,
  opts?: { now?: Date },
): Promise<GuideLocalEventsData> {
  if (audience === "sensitive") return { items: [] };

  const now = opts?.now ?? new Date();
  const windowStart = new Date(now.getTime() - EVENT_WINDOW_PAST_MS);
  const windowEnd = new Date(now.getTime() + EVENT_WINDOW_FUTURE_MS);

  const events = await getLocalEventsForProperty(propertyId);

  const items: GuideLocalEventItem[] = [];
  for (const event of events) {
    if (event.startsAt < windowStart || event.startsAt > windowEnd) continue;
    items.push({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt ? event.endsAt.toISOString() : null,
      venueName: event.venueName,
      categoryKey: event.categoryKey,
      descriptionMd: event.descriptionMd,
      sourceUrl: event.sourceUrl,
      hasCoords: event.latitude != null && event.longitude != null,
      primarySource: event.primarySource,
      contributingSources: event.contributingSources,
    });
  }

  // Defence in depth: the helper orders ASC at the DB, but the listing
  // contract is "sorted by startsAt" — sort here so the invariant holds
  // even if the fetcher's ordering ever changes.
  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { items };
}

function buildAnchor(
  property: { id: string; latitude: number | null; longitude: number | null },
  audience: GuideAudience,
): GuideMapAnchor | null {
  if (property.latitude == null || property.longitude == null) return null;

  if (audience === "internal") {
    return {
      obfuscated: false,
      lat: property.latitude,
      lng: property.longitude,
    };
  }
  // Every other (non-sensitive) audience — guest, ai — receives an
  // obfuscated anchor. The exact coordinates never leave this function.
  return obfuscateAnchor({
    lat: property.latitude,
    lng: property.longitude,
    propertyId: property.id,
  });
}
