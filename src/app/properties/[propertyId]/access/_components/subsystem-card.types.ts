import type { AccessCockpitId } from "@/lib/icons/access-icons";

/**
 * One slide in a subsystem card's media carousel. Built server-side from
 * `MediaAssignment` rows joined with `MediaAsset`. URLs are presigned R2
 * download URLs (55-min cache TTL).
 *
 * `kind` is classified server-side:
 *   - "map":   `usageKey.endsWith(".map")`         (e.g. `access.parking.map`)
 *   - "image": `mimeType.startsWith("image/")`     (and not `.map`)
 *   - "video": `mimeType.startsWith("video/")`     (and not `.map`)
 *
 * `title` is the resolved overlay label (`"Principal"` / method label /
 * `"Mapa"` / `"<method> · Mapa"`). Resolution lives in `page.tsx` — the
 * card consumes the resolved string.
 */
export interface SubsystemSlide {
  id: string;
  kind: "image" | "map" | "video";
  url: string;
  alt: string;
  blurhash: string | null;
  title: string;
  usageKey: string;
}

export type SubsystemSlides = Record<AccessCockpitId, SubsystemSlide[]>;
