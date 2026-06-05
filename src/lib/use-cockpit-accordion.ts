"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { withViewTransition } from "@/lib/view-transition";
import { isEditableTarget } from "@/lib/dom";

// ─────────────────────────────────────────────────────────────────────────
// useCockpitAccordion — single-open expand state for an EntityCardAccordion.
//
// The SAME behavior across every entity-card surface (Access, Spaces, future):
// expand morphs via the View Transition (`{ expandClass: true }` suppresses
// inner row VT names), and the card collapses on Escape or a click outside its
// wrapper. Clicks inside Radix portals / tooltips, or inside any `extraInsideRefs`
// (e.g. Access's arrival-steps section), are ignored.
//
// `onExpandChange` runs inside the expand transition — use it to coordinate
// sibling accordions in the same commit (Access collapses its arrival-steps
// sub-accordion when a card opens). `setExpandedRaw` is the un-animated setter
// for callers that need to bundle the change into their own transition (Access's
// `handleStepToggle` sets the steps + clears the card in one View Transition).
// ─────────────────────────────────────────────────────────────────────────

const PORTAL_ESCAPE_SELECTOR =
  '[data-radix-popper-content-wrapper],[role="dialog"],[role="menu"],[role="tooltip"]';

interface CockpitAccordionOptions {
  /** Additional "inside" refs for the click-outside guard (besides `wrapperRef`). */
  extraInsideRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  /** Called inside the expand View Transition — coordinate sibling state here. */
  onExpandChange?: (next: string | null) => void;
}

export function useCockpitAccordion(opts?: CockpitAccordionOptions) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const onExpandChange = opts?.onExpandChange;
  const extraInsideRefs = opts?.extraInsideRefs;

  const setExpanded = useCallback(
    (next: string | null) => {
      withViewTransition(() => {
        setExpandedId(next);
        onExpandChange?.(next);
      }, { expandClass: true });
    },
    [onExpandChange],
  );

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

  // Click outside the wrapper(s) collapses. Bound on `mousedown` so the collapse
  // fires before any focus shift. Radix portals + tooltips render to a body
  // portal, so a plain `contains` check would collapse when interacting with
  // them — the closest-selector escape hatch excludes those surfaces.
  useEffect(() => {
    if (!expandedId) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (wrapperRef.current?.contains(target)) return;
      if (extraInsideRefs?.some((r) => r.current?.contains(target))) return;
      if (target instanceof Element && target.closest(PORTAL_ESCAPE_SELECTOR)) return;
      setExpanded(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [expandedId, setExpanded, extraInsideRefs]);

  return { expandedId, setExpanded, setExpandedRaw: setExpandedId, wrapperRef };
}
