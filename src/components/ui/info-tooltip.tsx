"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
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

  const tooltip = (
    <span
      role="tooltip"
      onMouseDown={(e) => e.stopPropagation()}
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
    <span className="inline-flex shrink-0">
      <span
        ref={btnRef}
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(e); } }}
        className="ml-1 inline-flex h-4 w-4 cursor-pointer select-none items-center justify-center rounded-full bg-[var(--color-neutral-200)] text-[10px] font-bold text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-300)] hover:text-[var(--color-neutral-700)] transition-colors"
        aria-label="Más información"
      >
        ?
      </span>
      {open && mounted && createPortal(tooltip, document.body)}
    </span>
  );
}
