import { useEffect, useState } from "react";

/** Tracks whether the viewport matches `(min-width: ${breakpointPx}px)`.
 *
 * SSR-safe: `ssrDefault` controls the initial value before mount. Pick the
 * default that gives the better visual result during the first paint before
 * `matchMedia` resolves — for layouts that prefer to render the desktop
 * variant by default, pass `true`; for variants that should stay hidden until
 * measured, pass `false`. */
export function useIsDesktop(
  breakpointPx: number = 768,
  ssrDefault: boolean = false,
): boolean {
  const [isDesktop, setIsDesktop] = useState(ssrDefault);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(min-width: ${breakpointPx}px)`);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpointPx]);
  return isDesktop;
}
