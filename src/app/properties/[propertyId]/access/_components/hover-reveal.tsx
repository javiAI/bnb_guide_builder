"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

interface HoverRevealProps {
  trigger: ReactNode;
  content: ReactNode;
  // Distance in pixels between the trigger and the popover.
  gap?: number;
}

// In-house hover/focus popover (no Radix dep). Anchors via getBoundingClientRect
// + position: fixed. Mouse: 150ms enter delay + 100ms close grace so the user
// can cross the gap. Keyboard: focus-on-trigger opens, blur/Escape closes.
export function HoverReveal({ trigger, content, gap = 8 }: HoverRevealProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const computeCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + gap,
      left: rect.left + rect.width / 2,
    });
  }, [gap]);

  const scheduleOpen = useCallback(() => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    if (open) return;
    enterTimer.current = setTimeout(() => {
      computeCoords();
      setOpen(true);
    }, 150);
  }, [open, computeCoords]);

  const scheduleClose = useCallback(() => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    exitTimer.current = setTimeout(() => setOpen(false), 100);
  }, []);

  const openImmediate = useCallback(() => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    computeCoords();
    setOpen(true);
  }, [computeCoords]);

  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        aria-describedby={open ? id : undefined}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={openImmediate}
        onBlur={scheduleClose}
        className="inline-flex"
      >
        {trigger}
      </span>
      {open && coords && (
        <div
          ref={popoverRef}
          id={id}
          role="tooltip"
          onMouseEnter={() => {
            if (exitTimer.current) {
              clearTimeout(exitTimer.current);
              exitTimer.current = null;
            }
          }}
          onMouseLeave={scheduleClose}
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            transform: "translateX(-50%)",
            zIndex: 50,
          }}
          className="min-w-[180px] max-w-[260px] rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-2 text-[12px] text-[var(--color-text-primary)] shadow-lg"
        >
          {content}
        </div>
      )}
    </>
  );
}
