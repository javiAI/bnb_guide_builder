"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  NAV_COLLAPSED_KEY,
  RAIL_COLLAPSED_KEY,
  NAV_COLLAPSED_ATTR,
  RAIL_COLLAPSED_ATTR,
  NAV_WIDTH_KEY,
  RAIL_WIDTH_KEY,
  NAV_WIDTH_VAR,
  RAIL_WIDTH_VAR,
  NAV_WIDTH,
  RAIL_WIDTH,
  clampWidth,
} from "@/lib/shell-prefs";

/**
 * Client islands for the operator shell chrome (Liora 16F.5). Collapse + width
 * live on `<html>` (attributes + inline CSS vars) so the layout follows from
 * CSS and the pre-paint script can restore both before first paint (no FOUC).
 * Toggles and the resize handle independently read/write that DOM state +
 * localStorage — no shared React state needed.
 */
type Bounds = { min: number; max: number; default: number; collapsed: number };

function readStoredWidth(key: string, bounds: Bounds): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return bounds.default;
    return clampWidth(Number.parseInt(raw, 10), bounds);
  } catch {
    return bounds.default;
  }
}

function setWidthVar(cssVar: string, px: number) {
  document.documentElement.style.setProperty(cssVar, `${px}px`);
}

function useCollapse(
  collapseKey: string,
  attr: string,
  widthVar: string,
  widthKey: string,
  bounds: Bounds,
) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute(attr) === "true");
  }, [attr]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      const el = document.documentElement;
      el.setAttribute(attr, next ? "true" : "false");
      setWidthVar(widthVar, next ? bounds.collapsed : readStoredWidth(widthKey, bounds));
      try {
        window.localStorage.setItem(collapseKey, next ? "true" : "false");
      } catch {
        // storage blocked — DOM state is set for this session anyway
      }
      return next;
    });
  }, [collapseKey, attr, widthVar, widthKey, bounds]);

  return { collapsed, toggle };
}

/**
 * Read-only reactive view of the nav's collapsed state for consumers that need
 * to render differently when collapsed (e.g. `SideNav` shows hover tooltips on
 * the icon-only items). Collapse lives on `<html data-nav-collapsed>` (set by
 * the pre-paint script + the toggle), so we mirror it into React via a
 * `MutationObserver` rather than lifting it into shared state.
 */
export function useNavCollapsed(): boolean {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setCollapsed(el.getAttribute(NAV_COLLAPSED_ATTR) === "true");
    read();
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: [NAV_COLLAPSED_ATTR] });
    return () => observer.disconnect();
  }, []);
  return collapsed;
}

interface DrawerTabConfig {
  /** Which panel edge the tab hugs (and the open/close direction). */
  side: "left" | "right";
  collapseKey: string;
  attr: string;
  widthVar: string;
  widthKey: string;
  bounds: Bounds;
  labelExpanded: string;
  labelCollapsed: string;
  /** Min breakpoint at which the panel (and tab) exist. */
  breakpoint: "lg" | "xl";
}

/**
 * Drawer pull-tab — a small handle pinned to a panel's inner edge, centred
 * vertically (the canonical drawer-handle pattern). Lives OUTSIDE the panel
 * (rendered in AppShell, `fixed`) so it survives the panel collapsing, and
 * slides with the panel's width var. The 44×56 button keeps a full touch
 * target while the visible pill stays small. Shared by both the left nav and
 * the right rail — same system, mirrored.
 */
function DrawerTab({
  side,
  collapseKey,
  attr,
  widthVar,
  widthKey,
  bounds,
  labelExpanded,
  labelCollapsed,
  breakpoint,
}: DrawerTabConfig) {
  const { collapsed, toggle } = useCollapse(collapseKey, attr, widthVar, widthKey, bounds);
  const isRight = side === "right";
  const label = collapsed ? labelCollapsed : labelExpanded;
  // Collapsed chevron points the way the panel will open: the right rail opens
  // leftward (←), the left nav opens rightward (→).
  const Icon = collapsed
    ? isRight
      ? ChevronLeft
      : ChevronRight
    : isRight
      ? ChevronRight
      : ChevronLeft;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      style={isRight ? { right: `var(${widthVar})` } : { left: `var(${widthVar})` }}
      className={`group fixed top-1/2 z-40 hidden h-14 w-11 -translate-y-1/2 items-center duration-200 ease-out focus-visible:outline-none ${
        breakpoint === "xl" ? "xl:flex" : "lg:flex"
      } ${isRight ? "justify-end transition-[right]" : "justify-start transition-[left]"}`}
    >
      <span
        className={`flex h-12 w-5 items-center justify-center border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-muted)] shadow-[var(--elevation-popover)] transition-colors group-hover:bg-[var(--color-interactive-hover)] group-hover:text-[var(--color-text-primary)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-border-focus)] ${
          isRight ? "rounded-l-[8px] border-r-0" : "rounded-r-[8px] border-l-0"
        }`}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
    </button>
  );
}

export function NavDrawerTab() {
  return (
    <DrawerTab
      side="left"
      collapseKey={NAV_COLLAPSED_KEY}
      attr={NAV_COLLAPSED_ATTR}
      widthVar={NAV_WIDTH_VAR}
      widthKey={NAV_WIDTH_KEY}
      bounds={NAV_WIDTH}
      labelExpanded="Colapsar menú"
      labelCollapsed="Expandir menú"
      breakpoint="lg"
    />
  );
}

export function RailDrawerTab() {
  return (
    <DrawerTab
      side="right"
      collapseKey={RAIL_COLLAPSED_KEY}
      attr={RAIL_COLLAPSED_ATTR}
      widthVar={RAIL_WIDTH_VAR}
      widthKey={RAIL_WIDTH_KEY}
      bounds={RAIL_WIDTH}
      labelExpanded="Ocultar panel lateral"
      labelCollapsed="Mostrar panel lateral"
      breakpoint="xl"
    />
  );
}

interface PanelResizeHandleProps {
  /** Which edge of the panel the handle sits on (and the grow direction). */
  side: "left" | "right";
  widthVar: string;
  widthKey: string;
  bounds: Bounds;
  ariaLabel: string;
  className?: string;
}

/**
 * Draggable splitter for a side panel. ARIA window-splitter pattern
 * (`role="separator"` + `aria-valuenow/min/max`), keyboard arrows (Shift = big
 * step, Home/End = min/max), double-click resets to default. Width is written
 * to the panel's CSS var live during drag and persisted on release.
 */
export function PanelResizeHandle({
  side,
  widthVar,
  widthKey,
  bounds,
  ariaLabel,
  className,
}: PanelResizeHandleProps) {
  const [width, setWidth] = useState(bounds.default);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setWidth(readStoredWidth(widthKey, bounds));
  }, [widthKey, bounds]);

  const apply = useCallback(
    (px: number, persist: boolean) => {
      const w = clampWidth(px, bounds);
      setWidthVar(widthVar, w);
      if (persist) {
        // Sync React state + persist only on commit (release / keyboard) — the
        // live drag writes the CSS var alone, avoiding a render per pointermove.
        setWidth(w);
        try {
          window.localStorage.setItem(widthKey, String(w));
        } catch {
          // storage blocked — var is set for this session
        }
      }
    },
    [widthVar, widthKey, bounds],
  );

  const widthFromPointer = useCallback(
    (clientX: number) => (side === "right" ? clientX : window.innerWidth - clientX),
    [side],
  );

  // Drag tracking via window listeners while `dragging` — the effect's cleanup
  // detaches them (idiomatic React drag; no manual pointer-capture juggling).
  useEffect(() => {
    if (!dragging) return;
    const move = (ev: PointerEvent) => apply(widthFromPointer(ev.clientX), false);
    const up = (ev: PointerEvent) => {
      apply(widthFromPointer(ev.clientX), true);
      setDragging(false);
    };
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = prevUserSelect;
    };
  }, [dragging, apply, widthFromPointer]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 32 : 16;
      const grow = side === "right" ? "ArrowRight" : "ArrowLeft";
      const shrink = side === "right" ? "ArrowLeft" : "ArrowRight";
      if (e.key === grow) {
        e.preventDefault();
        apply(width + step, true);
      } else if (e.key === shrink) {
        e.preventDefault();
        apply(width - step, true);
      } else if (e.key === "Home") {
        e.preventDefault();
        apply(bounds.min, true);
      } else if (e.key === "End") {
        e.preventDefault();
        apply(bounds.max, true);
      }
    },
    [apply, side, width, bounds],
  );

  const onDoubleClick = useCallback(() => apply(bounds.default, true), [apply, bounds]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuenow={width}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      className={`group absolute top-0 z-30 h-full w-2 cursor-col-resize touch-none select-none focus-visible:outline-none ${side === "right" ? "right-0" : "left-0"} ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-[var(--color-border-strong)] group-focus-visible:bg-[var(--color-border-focus)]"
      />
    </div>
  );
}

/** Nav resizer — bound to the sidebar's right edge + width var. */
export function NavResizeHandle() {
  return (
    <PanelResizeHandle
      side="right"
      widthVar={NAV_WIDTH_VAR}
      widthKey={NAV_WIDTH_KEY}
      bounds={NAV_WIDTH}
      ariaLabel="Ajustar ancho del menú"
      className="shell-nav-resizer"
    />
  );
}

/** Rail resizer — bound to the rail's left edge + width var. */
export function RailResizeHandle() {
  return (
    <PanelResizeHandle
      side="left"
      widthVar={RAIL_WIDTH_VAR}
      widthKey={RAIL_WIDTH_KEY}
      bounds={RAIL_WIDTH}
      ariaLabel="Ajustar ancho del panel de publicación"
      className="shell-rail-resizer"
    />
  );
}
