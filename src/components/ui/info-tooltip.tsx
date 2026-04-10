"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <span className="inline-flex">
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setOpen(!open); } }}
        className="ml-1 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-[var(--color-neutral-200)] text-[10px] font-bold text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-300)] hover:text-[var(--color-neutral-700)] transition-colors"
        aria-label="Más información"
      >
        ?
      </span>
      {open && pos && typeof document !== "undefined" && createPortal(
        <span
          style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
          className="fixed z-50 w-64 rounded-[var(--radius-md)] bg-[var(--foreground)] px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
        >
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[var(--foreground)]" />
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
