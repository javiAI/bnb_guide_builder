"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withViewTransition } from "@/lib/view-transition";

// ─────────────────────────────────────────────────────────────────────────
// useCockpitAccordion — single-open expand state for an EntityCardAccordion.
//
// Extracted from the Access cockpit (access-form.tsx) so every entity-card
// surface (Access, Spaces, future) gets the SAME behavior: expand morphs via
// the View Transition (`{ expandClass: true }` suppresses inner row VT names),
// and the card collapses on Escape or a click outside its wrapper. Clicks
// landing inside Radix portals (popovers / dialogs / menus) or tooltips are
// ignored so opening a select/tooltip over the card doesn't collapse it.
//
// Bind `wrapperRef` to the element that bounds the expandable surface.
// ─────────────────────────────────────────────────────────────────────────

const PORTAL_ESCAPE_SELECTOR =
  '[data-radix-popper-content-wrapper],[role="dialog"],[role="menu"],[role="tooltip"]';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useCockpitAccordion() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const setExpanded = useCallback((next: string | null) => {
    withViewTransition(() => setExpandedId(next), { expandClass: true });
  }, []);

  // Escape collapses — but not while typing inside an editor field.
  useEffect(() => {
    if (!expandedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isEditableTarget(e.target)) return;
      setExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedId, setExpanded]);

  // Click outside the wrapper collapses. Bound on `mousedown` so the collapse
  // fires before any focus shift. Radix portals + tooltips render to a body
  // portal, so a plain `contains` check would collapse when interacting with
  // them — the closest-selector escape hatch excludes those surfaces.
  useEffect(() => {
    if (!expandedId) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      const wrapper = wrapperRef.current;
      if (wrapper && wrapper.contains(target)) return;
      if (target instanceof Element && target.closest(PORTAL_ESCAPE_SELECTOR)) return;
      setExpanded(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [expandedId, setExpanded]);

  return { expandedId, setExpanded, wrapperRef };
}
