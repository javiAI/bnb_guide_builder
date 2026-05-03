"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

interface ChipRowProps {
  children: ReactNode[];
}

const GAP_PX = 6;
const OVERFLOW_RESERVE_PX = 56;

export function ChipRow({ children }: ChipRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(children.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    let raf = 0;
    const recompute = () => {
      const containerWidth = container.clientWidth;
      const items = Array.from(measure.children) as HTMLElement[];
      const widths = items.map((el) => el.offsetWidth);

      let total = 0;
      for (let i = 0; i < widths.length; i++) {
        total += widths[i] + (i > 0 ? GAP_PX : 0);
      }
      let next: number;
      if (total <= containerWidth) {
        next = widths.length;
      } else {
        let used = 0;
        let count = 0;
        for (let i = 0; i < widths.length; i++) {
          const after = used + widths[i] + (i > 0 ? GAP_PX : 0);
          if (after + GAP_PX + OVERFLOW_RESERVE_PX > containerWidth) break;
          used = after;
          count = i + 1;
        }
        next = Math.max(1, count);
      }
      setVisibleCount((prev) => (prev === next ? prev : next));
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };

    recompute();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(schedule);
      ro.observe(container);
      return () => {
        ro.disconnect();
        cancelAnimationFrame(raf);
      };
    }
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, [children]);

  const hidden = children.length - visibleCount;

  return (
    <div ref={containerRef} className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
        style={{ height: 1, visibility: "hidden" }}
      >
        <div
          ref={measureRef}
          className="flex flex-nowrap gap-1.5"
          style={{ width: "max-content" }}
        >
          {children}
        </div>
      </div>
      <div className="flex flex-nowrap gap-1.5 overflow-hidden">
        {children.slice(0, visibleCount)}
        {hidden > 0 && (
          <span
            className="inline-flex shrink-0 items-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] whitespace-nowrap"
            aria-label={`${hidden} más`}
            title={`${hidden} más`}
          >
            +{hidden}
          </span>
        )}
      </div>
    </div>
  );
}
