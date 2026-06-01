"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useId,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export type TooltipPlacement = "top" | "bottom";

export function TooltipBubble({
  id,
  pos,
  text,
  placement = "top",
}: {
  id: string;
  pos: { top: number; left: number };
  text: string;
  placement?: TooltipPlacement;
}) {
  const isTop = placement === "top";
  const ref = useRef<HTMLSpanElement>(null);
  // Keep the bubble fully on-screen horizontally: it's centred on the trigger,
  // but near a viewport edge (topbar corner, collapsed nav rail) that would clip
  // it and add a horizontal scrollbar. Measure before paint and shift it inward;
  // the arrow shifts back so it still points at the trigger.
  const [adjustX, setAdjustX] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.offsetWidth;
    const margin = 8;
    const centerX = pos.left - window.scrollX;
    const leftEdge = centerX - width / 2;
    const rightEdge = centerX + width / 2;
    let dx = 0;
    if (rightEdge > window.innerWidth - margin) dx = window.innerWidth - margin - rightEdge;
    else if (leftEdge < margin) dx = margin - leftEdge;
    setAdjustX(dx);
    // Only pos.left + text affect the horizontal clamp; pos.top is irrelevant.
  }, [pos.left, text]);
  return (
    <span
      ref={ref}
      id={id}
      role="tooltip"
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        transform: `translate(calc(-50% + ${adjustX}px), ${isTop ? "-100%" : "0"})`,
        zIndex: 9999,
        pointerEvents: "none",
        background: "var(--tooltip-bg)",
        color: "var(--tooltip-fg)",
        padding: "var(--tooltip-padding)",
        maxWidth: "var(--tooltip-max-width)",
        boxShadow: "var(--tooltip-shadow)",
        borderRadius: "var(--tooltip-radius)",
      }}
      className="text-[length:var(--tooltip-font-size)] leading-relaxed"
    >
      {text}
      <span
        style={{
          position: "absolute",
          top: isTop ? "100%" : undefined,
          bottom: isTop ? undefined : "100%",
          left: `calc(50% - ${adjustX}px)`,
          transform: "translateX(-50%)",
          borderWidth: "5px",
          borderStyle: "solid",
          borderColor: isTop
            ? "var(--tooltip-bg) transparent transparent transparent"
            : "transparent transparent var(--tooltip-bg) transparent",
        }}
      />
    </span>
  );
}

interface TooltipProps {
  text: string;
  children: ReactNode;
  /** Extra classes for the wrapper span. Use to opt the trigger into flex
   * layout when needed (e.g. `min-w-0 flex-1` so an inner truncated label
   * keeps shrinking inside a flex row). */
  className?: string;
  /** Side the bubble opens toward. `top` (default) suits in-flow content with
   * space above; `bottom` is for controls pinned to the viewport top (topbar)
   * where an above-anchored bubble would clip off-screen. */
  placement?: TooltipPlacement;
}

export function Tooltip({ text, children, className, placement = "top" }: TooltipProps) {
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const calcPos = useCallback(() => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setPos({
      top: (placement === "top" ? r.top - 8 : r.bottom + 8) + window.scrollY,
      left: r.left + r.width / 2 + window.scrollX,
    });
  }, [placement]);

  const show = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      calcPos();
      setVisible(true);
    }, 300);
  }, [calcPos]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const reposition = () => calcPos();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [visible, calcPos]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={visible ? tooltipId : undefined}
      className={cn("inline-flex", className)}
    >
      {children}
      {visible &&
        mounted &&
        createPortal(
          <TooltipBubble id={tooltipId} pos={pos} text={text} placement={placement} />,
          document.body,
        )}
    </span>
  );
}
