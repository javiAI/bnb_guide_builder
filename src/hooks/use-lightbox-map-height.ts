import { useEffect, useState } from "react";

/** Lightbox map slide-area sizing. The wrapper uses `height: min(82vh, 900px)`
 * in CSS; canvas-based children (MapLibre via MultiPinMap) need a numeric
 * pixel height that mirrors the same formula. Both must stay aligned —
 * mismatch lets the canvas clip the wrapper or overflow it.
 *
 * Kept as exported constants so the CSS value in MediaLightbox and the JS
 * value here read from the same source of truth. */
export const LIGHTBOX_MAP_HEIGHT_FRACTION = 0.82;
export const LIGHTBOX_MAP_HEIGHT_MAX_PX = 900;

function computeLightboxMapHeight(): number {
  if (typeof window === "undefined") return LIGHTBOX_MAP_HEIGHT_MAX_PX;
  return Math.round(
    Math.min(
      window.innerHeight * LIGHTBOX_MAP_HEIGHT_FRACTION,
      LIGHTBOX_MAP_HEIGHT_MAX_PX,
    ),
  );
}

/** Pixel height matching the lightbox map slide area, re-measured on resize.
 * `enabled=false` short-circuits the listener (used by inline cockpits that
 * keep a static prop-driven height). */
export function useLightboxMapHeight(enabled: boolean = true): number {
  const [height, setHeight] = useState<number>(() =>
    enabled ? computeLightboxMapHeight() : LIGHTBOX_MAP_HEIGHT_MAX_PX,
  );
  useEffect(() => {
    if (!enabled) return;
    const update = () => setHeight(computeLightboxMapHeight());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [enabled]);
  return height;
}
