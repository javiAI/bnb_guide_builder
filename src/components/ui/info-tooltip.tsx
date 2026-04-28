"use client";

import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { TooltipBubble } from "./tooltip";

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.top - 8 + window.scrollY, left: r.left + r.width / 2 + window.scrollX });
  }, []);

  const toggle = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!open) calcPos();
    setOpen((v) => !v);
  }, [open, calcPos]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const reposition = () => calcPos();
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, calcPos]);

  return (
    <span className="inline-flex shrink-0">
      <span
        ref={btnRef}
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(e); } }}
        className="ml-1 inline-flex h-4 w-4 cursor-pointer select-none items-center justify-center rounded-full bg-[var(--color-background-subtle)] text-[10px] font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-border-default)] hover:text-[var(--color-text-secondary)] transition-colors"
        aria-label="Más información"
        aria-describedby={open ? tooltipId : undefined}
      >
        ?
      </span>
      {open && mounted && createPortal(
        <TooltipBubble id={tooltipId} pos={pos} text={text} onMouseDown={(e) => e.stopPropagation()} />,
        document.body,
      )}
    </span>
  );
}
