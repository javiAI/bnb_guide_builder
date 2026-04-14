"use client";

import { useState, useRef, useCallback, useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  text: string;
  children: ReactNode;
}

/**
 * Hover tooltip matching InfoTooltip's visual style.
 * Wraps any element and shows a styled tooltip on hover/focus.
 */
export function Tooltip({ text, children }: TooltipProps) {
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
      top: r.top - 8 + window.scrollY,
      left: r.left + r.width / 2 + window.scrollX,
    });
  }, []);

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

  const tooltip = (
    <span
      id={tooltipId}
      role="tooltip"
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
        zIndex: 9999,
        pointerEvents: "none",
      }}
      className="w-60 rounded-[var(--radius-md)] bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-xl"
    >
      {text}
      <span
        style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)" }}
        className="border-[5px] border-transparent border-t-gray-900"
      />
    </span>
  );

  return (
    <span
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={visible ? tooltipId : undefined}
      className="inline-flex"
    >
      {children}
      {visible && mounted && createPortal(tooltip, document.body)}
    </span>
  );
}
