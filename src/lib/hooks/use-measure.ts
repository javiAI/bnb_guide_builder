"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

interface Size {
  width: number;
  height: number;
}

// useLayoutEffect during SSR triggers a console warning. The hook is consumed
// only inside "use client" subtrees, but Next.js still evaluates the module
// during the initial server render — this guard makes the effect a noop on
// the server and runs synchronously (pre-paint) on the client.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// useMeasure observes an element's content-box size via ResizeObserver.
// Initial measurement is performed SYNCHRONOUSLY in a layout effect (before
// the first browser paint) by reading getBoundingClientRect + computed style
// and subtracting padding/border to land at content-box. This means callers
// see the correct width on their second render — which happens before paint —
// avoiding a "flash of wrong layout" that pure-effect measurement produces
// (commit → paint → measure → re-render → paint).
export function useMeasure<T extends Element>(): [RefObject<T | null>, Size] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Synchronous initial measurement — runs after layout but before paint,
    // so the post-update render replaces the width=0 commit on screen.
    const rect = node.getBoundingClientRect();
    const cs = window.getComputedStyle(node);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const borderX =
      parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderY =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    setSize({
      width: Math.max(0, rect.width - padX - borderX),
      height: Math.max(0, rect.height - padY - borderY),
    });

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentBoxSize?.[0];
      const width = box ? box.inlineSize : entry.contentRect.width;
      const height = box ? box.blockSize : entry.contentRect.height;
      setSize({ width, height });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}
