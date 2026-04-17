"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { GuideMedia } from "@/lib/types/guide-tree";

// Lightbox ships ~40 KB gzipped — only load it once the user actually taps a
// thumbnail. ssr:false keeps it out of the server bundle entirely; opening
// media is inherently client-driven.
const Lightbox = dynamic(() => import("yet-another-react-lightbox"), {
  ssr: false,
});

interface Props {
  media: GuideMedia[];
  /** Short label used for the figure's aria-label (the item's label). */
  contextLabel: string;
}

export function GuideMediaGallery({ media, contextLabel }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const open = useCallback((i: number) => setIndex(i), []);
  const close = useCallback(() => setIndex(null), []);

  if (media.length === 0) return null;

  const slides = media.map((m) => ({
    src: m.variants.full,
    alt: m.alt,
  }));

  return (
    <>
      <ul
        className="guide-gallery"
        aria-label={`Galería de ${contextLabel}`}
      >
        {media.map((m, i) => (
          <li key={m.assetId}>
            <button
              type="button"
              onClick={() => open(i)}
              className="guide-gallery__thumb-btn"
              aria-label={`Abrir ${m.alt || contextLabel} en grande`}
              style={{
                padding: 0,
                border: "none",
                background: "transparent",
                display: "block",
                width: "100%",
              }}
            >
              <img
                className="guide-gallery__thumb"
                src={m.variants.thumb}
                srcSet={`${m.variants.thumb} 1x, ${m.variants.md} 2x`}
                alt={m.alt}
                loading="lazy"
                decoding="async"
              />
            </button>
          </li>
        ))}
      </ul>
      {index !== null && (
        <Lightbox
          open
          close={close}
          index={index}
          slides={slides}
          on={{ view: ({ index: i }) => setIndex(i) }}
        />
      )}
    </>
  );
}
