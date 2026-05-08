"use client";

import { useMemo } from "react";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { SubsystemSlide } from "./subsystem-card.types";
import { MultiPinMap, type MultiPinSpec } from "./multi-pin-map";

// The library's default Slide union covers image + video. We extend it locally
// with two synthetic types: "video-url" (a plain <video src=> we render via
// render.slide so we don't depend on the Video plugin), and "live-map" (the
// parking interactive map). Both are flagged by `type` and resolved in the
// render.slide callback below — the library treats unknown types as opaque.
type LiveMapSlide = {
  type: "live-map";
  id: string;
  title: string;
  alt: string;
  anchor: { latitude: number; longitude: number };
  pins: MultiPinSpec[];
};

type VideoUrlSlide = {
  type: "video-url";
  id: string;
  title: string;
  alt: string;
  src: string;
};

type LightboxSlide = Slide | LiveMapSlide | VideoUrlSlide;

interface Props {
  slides: readonly SubsystemSlide[];
  /** When `null`, the lightbox is closed. When a number, opens at that index. */
  index: number | null;
  onIndexChange: (idx: number) => void;
  onClose: () => void;
}

export function MediaLightbox({ slides, index, onIndexChange, onClose }: Props) {
  const lightboxSlides = useMemo<LightboxSlide[]>(() => {
    return slides
      .map((s): LightboxSlide | null => {
        if (s.kind === "image" || s.kind === "map") {
          return {
            type: "image",
            src: s.url,
            alt: s.alt || s.title,
          };
        }
        if (s.kind === "video") {
          return {
            type: "video-url",
            id: s.id,
            title: s.title,
            alt: s.alt || s.title,
            src: s.url,
          };
        }
        if (s.kind === "live-map") {
          if (!s.liveAnchor) return null;
          const pins: MultiPinSpec[] = (s.livePins ?? []).map((p) => ({
            id: p.id,
            latitude: p.latitude,
            longitude: p.longitude,
            kind:
              p.feeType === "free"
                ? "confirmed-free"
                : p.feeType === "paid"
                  ? "confirmed-paid"
                  : "confirmed-unknown",
            label: p.label,
          }));
          return {
            type: "live-map",
            id: s.id,
            title: s.title,
            alt: s.alt || s.title,
            anchor: s.liveAnchor,
            pins,
          };
        }
        return null;
      })
      .filter((s): s is LightboxSlide => s !== null);
  }, [slides]);

  if (index === null || lightboxSlides.length === 0) return null;

  return (
    <Lightbox
      open
      close={onClose}
      index={Math.min(index, lightboxSlides.length - 1)}
      slides={lightboxSlides as Slide[]}
      on={{ view: ({ index: i }) => onIndexChange(i) }}
      controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
      animation={{ fade: 200, swipe: 280 }}
      carousel={{ finite: false, padding: "16px", spacing: "24px" }}
      render={{
        slide: ({ slide }) => {
          const s = slide as LightboxSlide;
          if ("type" in s && s.type === "live-map") {
            // 75vh covers "almost the whole screen" while leaving room for
            // the toolbar/counter. MapLibre takes its container's height so
            // we hand it a fixed pixel value via a CSS calc inline.
            return (
              <div
                style={{ width: "min(95vw, 1400px)", height: "min(82vh, 900px)" }}
                className="relative overflow-hidden rounded-[12px]"
              >
                <MultiPinMap
                  anchor={s.anchor}
                  pins={s.pins}
                  height={Math.round(Math.min(window.innerHeight * 0.82, 900))}
                  interactive={true}
                />
              </div>
            );
          }
          if ("type" in s && s.type === "video-url") {
            return (
              <video
                src={s.src}
                controls
                playsInline
                preload="metadata"
                aria-label={s.alt}
                style={{
                  maxWidth: "min(95vw, 1400px)",
                  maxHeight: "min(82vh, 900px)",
                }}
                className="rounded-[12px] bg-black"
              />
            );
          }
          return undefined;
        },
      }}
      styles={{
        container: { backgroundColor: "var(--color-background-scrim)" },
      }}
    />
  );
}
