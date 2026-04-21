/**
 * Server-side shapes for the guest map overlay (spatial UX) and the
 * temporal events listing under the map (temporal UX). Both travel to
 * `/g/[slug]/page.tsx` as props parallel to the `GuideTree`; neither is
 * persisted in `GuideVersion.treeJson`.
 *
 * Anchor obfuscation for `audience=guest` happens upstream in
 * `map-obfuscation.ts`. By the time a `GuideMapAnchor` is serialized onto
 * the wire, the invariant "exact property coords never reach a guest
 * client" must already hold — these types are the last mile, not the
 * authority on audience filtering.
 */

/**
 * Map anchor for the property. Discriminated on `obfuscated`:
 * - `true`  → always carries `radiusMeters` (required circle radius).
 * - `false` → exact pin; no radius field.
 *
 * The discriminant makes it impossible for callers to read `radiusMeters`
 * on an exact anchor — guards against helpers that would silently assume
 * one when the field is absent.
 */
export type GuideMapAnchor =
  | {
      obfuscated: true;
      lat: number;
      lng: number;
      radiusMeters: number;
    }
  | {
      obfuscated: false;
      lat: number;
      lng: number;
    };

/**
 * Map pin. Discriminated on `kind`:
 * - `place` → public LocalPlace; may carry `distanceMeters`.
 * - `event` → public LocalEvent inside the temporal window; carries
 *             `startsAt` (ISO 8601).
 *
 * Kind-specific fields only appear on the matching variant, so helpers
 * can't accidentally read `startsAt` off a place pin or vice versa.
 */
export type GuideMapPin =
  | {
      id: string;
      kind: "place";
      lat: number;
      lng: number;
      categoryKey: string;
      label: string;
      distanceMeters?: number;
    }
  | {
      id: string;
      kind: "event";
      lat: number;
      lng: number;
      categoryKey: string;
      label: string;
      startsAt: string;
    };

export type GuideMapPinKind = GuideMapPin["kind"];

export interface GuideMapData {
  /** `null` when the property has no coordinates. Pins still render. */
  anchor: GuideMapAnchor | null;
  /** Mixed places + events; the UI toggle filters by `kind`. */
  pins: GuideMapPin[];
}

export interface GuideLocalEventItem {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  categoryKey: string;
  descriptionMd: string | null;
  sourceUrl: string;
  /** Mirrors whether the same event also surfaces as a `kind:"event"` pin
   * in `GuideMapData.pins` — lets the UI link "in map" / "not in map" if
   * needed without re-deriving from coords. */
  hasCoords: boolean;
  /** Origin provider of the merged event (e.g. "predicthq", "ticketmaster",
   * "firecrawl:teruel_turismo"). Shown in the UI so guests see provenance. */
  primarySource: string;
  /** Other providers that contributed to the merged record (empty when a
   * single provider supplied the event). Surfaced for transparency. */
  contributingSources: string[];
}

export interface GuideLocalEventsData {
  /** Window: `startsAt ∈ [now - 24h, now + 30d]`, ordered ascending by
   * `startsAt`. Scoped to a single property. */
  items: GuideLocalEventItem[];
}
