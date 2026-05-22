import type { AccessCockpitId } from "@/lib/icons/access-icons";

/**
 * One slide in a subsystem card's media carousel. Built server-side from
 * `MediaAssignment` rows joined with `MediaAsset`. URLs are presigned R2
 * download URLs (55-min cache TTL).
 *
 * `kind` is classified server-side:
 *   - "map":      `usageKey.endsWith(".map")`         (e.g. `access.parking.map`)
 *   - "image":    `mimeType.startsWith("image/")`     (and not `.map`)
 *   - "video":    `mimeType.startsWith("video/")`     (and not `.map`)
 *   - "live-map": synthetic; always injected when the property has coords,
 *                 even with 0 pins (so the operator can drop the first pin
 *                 from the lightbox). Renders an interactive mini-map
 *                 (MapLibre) instead of an `<img>`.
 *
 * `title` is the resolved overlay label (`"Principal"` / method label /
 * `"Mapa"` / `"<method> · Mapa"`). Resolution lives in `page.tsx` — the
 * card consumes the resolved string.
 *
 * `livePins` is required for `kind === "live-map"` and ignored otherwise.
 * `url` is empty for live-map slides (no presigned URL).
 */
export interface SubsystemLivePin {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  feeType: "free" | "paid" | null;
}

export interface SubsystemSlide {
  id: string;
  assetId: string;
  kind: "image" | "map" | "video" | "live-map";
  url: string;
  alt: string;
  blurhash: string | null;
  title: string;
  usageKey: string;
  livePins?: SubsystemLivePin[];
  liveAnchor?: { latitude: number; longitude: number };
}

export type SubsystemSlides = Record<AccessCockpitId, SubsystemSlide[]>;

/** Stable usageKey for the synthetic live-map slide injected into the parking
 * subsystem. Shared so consumers that want to open the lightbox AT the map
 * (e.g. the in-editor zoom overlay) resolve the slide by key without
 * duplicating the literal. */
export const LIVE_MAP_USAGE_KEY = "access.parking.live-map";
