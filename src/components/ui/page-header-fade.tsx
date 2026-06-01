"use client";

import { useEffect, useState } from "react";

/**
 * Scroll-reactive header boundary (Liora 16F.5). At the very top of the page a
 * crisp hairline separates the sticky `PageHeader` from the content; as soon as
 * the page scrolls, that separator cross-fades into a soft gradient so content
 * dissolves under the header. Both elements live in the header→content gap
 * (`top-full`) and are purely decorative (`pointer-events-none`). The gradient
 * is only opaque while scrolling — so at rest nothing dims the content
 * container, only the line shows.
 *
 * Driven by `window.scrollY`: the operator shell scrolls the document, not an
 * inner container. Window access is inside the effect, so it's SSR-safe.
 */
export function PageHeaderFade() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Gradient dissolve — hidden at the top, fades in on scroll. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-full h-12 bg-gradient-to-b from-[var(--color-background-page)] to-transparent transition-opacity duration-200 ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Hairline separator — visible at the top, fades out on scroll. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-full h-px bg-[var(--color-border-default)] transition-opacity duration-200 ${
          scrolled ? "opacity-0" : "opacity-100"
        }`}
      />
    </>
  );
}
