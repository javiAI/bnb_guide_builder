"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

interface Size {
  width: number;
  height: number;
}

// useMeasure observes an element's content-box size via ResizeObserver.
// Initial size is { 0, 0 } until the first observed entry — callers default
// their layout-cap math to a safe fallback while width === 0 to avoid
// flashing a "0 visible" state before the first paint.
export function useMeasure<T extends Element>(): [RefObject<T | null>, Size] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
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
