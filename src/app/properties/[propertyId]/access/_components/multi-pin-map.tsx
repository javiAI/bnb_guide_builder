"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, ZoomIn } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/cn";
import { readCssVar, resolveCssColor } from "@/lib/css-var";
import { addCollapsedAttribution } from "@/lib/maplibre-attribution";
import { createPropertyPinElement } from "@/lib/property-pin-element";
import { useTilesStyleUrl } from "@/hooks/use-tiles-style-url";
import { buildCirclePolygon } from "@/lib/utils/geo";
import { Tooltip } from "@/components/ui/tooltip";
import type { ArrivalMode } from "@/lib/services/arrival-discovery.service";

/** Modes the cockpit "+" button can arm. Mirrors the intercity tab strip
 * (`parking` is the UI alias for the parking-cockpit subsystem). Last-mile
 * (metro/urban_bus/taxi/walk) is delegated to the directional Maps deep link
 * from the arrival point to the property — no manual pins for those modes. */
export type ManualAddMode = "parking" | ArrivalMode;

export type ArrivalPinMode = "train" | "bus" | "airport";

export interface MultiPinSpec {
  id: string;
  latitude: number;
  longitude: number;
  /** anchor = property location · confirmed-* = saved LocalPlace (variants by
   * fee type so free/paid are visually distinct on the map) · confirmed-arrival
   * = saved arrival option (transit mode in `arrivalMode`) · suggestion-arrival
   * = unsaved arrival hit (active tab only, muted style) · suggestion-parking
   * = unsaved parking hit · draft = manual-form preview */
  kind:
    | "anchor"
    | "confirmed-free"
    | "confirmed-paid"
    | "confirmed-unknown"
    | "confirmed-arrival"
    | "suggestion-arrival"
    | "suggestion-parking"
    | "draft";
  /** For `confirmed-arrival` and `suggestion-arrival` pins — which transit
   * mode this option is. */
  arrivalMode?: ArrivalPinMode;
  /** Recommended pins render with a highlight ring. */
  isRecommended?: boolean;
  label?: string;
}

/** Map a saved place's `feeType` to the matching `confirmed-*` pin kind.
 * Shared by every surface that renders confirmed parking pins from a row
 * with `{ feeType: "free" | "paid" | null }`. */
export function feeTypeToPinKind(
  feeType: "free" | "paid" | null | undefined,
): "confirmed-free" | "confirmed-paid" | "confirmed-unknown" {
  if (feeType === "free") return "confirmed-free";
  if (feeType === "paid") return "confirmed-paid";
  return "confirmed-unknown";
}

interface MultiPinMapProps {
  anchor: { latitude: number; longitude: number };
  pins: readonly MultiPinSpec[];
  /** Highlight applied imperatively, so toggling it does not rebuild markers. */
  activeId?: string | null;
  onPinClick?: (id: string) => void;
  /** When set, clicking the map surface (not a pin) fires with the lat/lng
   * the operator clicked. Used by the manual-pin form to drop a draft pin. */
  onMapClick?: (latitude: number, longitude: number) => void;
  /** When true the canvas cursor flips to `crosshair`, signalling "click to
   * place / move". When false MapLibre's default grab/grabbing cursor takes
   * over so the map reads as draggable. The click handler always fires —
   * gating which clicks count happens in the parent. */
  armed?: boolean;
  /** Optional preview pin overlay — a "draft" marker shown while the
   * operator is composing a manual pin. Independent of `pins` so swapping
   * it doesn't trigger a fitBounds. */
  previewPin?: { latitude: number; longitude: number } | null;
  height?: number;
  /** Whether MapLibre handles its own pointer/wheel/keyboard events. When
   * false the map renders as a static, display-only canvas: NavigationControl
   * is omitted, the click handler is not attached, and pan/zoom/rotate are
   * fully disabled — pointer events pass through to the parent (e.g. the
   * carousel can swipe over the map slide). Default true preserves the
   * existing editor behavior. */
  interactive?: boolean;
  /** Opt-in to the unified manual-add affordance (rama 16E.6): renders a "+"
   * button over the map. The button arms placement for the *currently
   * selected* mode (driven by the active intercity tab in the parent) — no
   * picker. When `mode` is null (or `disabled`), the button greys out and
   * surfaces `disabledReason` via tooltip. Internal armed state takes
   * precedence over the external `armed`/`onMapClick` pair while active —
   * the two flows are mutually exclusive (the operator can't relocate a pin
   * and place a new one at the same time). */
  manualAdd?: {
    mode: ManualAddMode | null;
    disabled: boolean;
    disabledReason?: string;
    /** Tab-specific copy for the "+" affordance. When omitted, the button
     * falls back to neutral "Añade un pin manualmente" / "Toca el mapa para
     * colocar el pin". Two strings so the parent controls Spanish gender
     * and article placement without us baking grammar rules here. */
    addTooltip?: string;
    armedHint?: string;
    onPlace: (
      mode: ManualAddMode,
      latitude: number,
      longitude: number,
    ) => void;
  };
  /** Fires when the operator hovers a pin (or moves off it). `null` on
   * mouseleave. Used by the cockpit to sync map ↔ list highlight without
   * round-tripping through React state. */
  onPinHover?: (id: string | null) => void;
  /** When provided, renders a magnifier button at the top-left of the map.
   * Wired by the cockpit to open the lightbox at the live-map slide — the
   * operator jumps from "I'm looking at this map" to "I'm managing it
   * full-screen" without going through the carousel. */
  onExpand?: () => void;
  /** Optional overlay rendered above the map canvas (e.g. relocate "Pulsa
   * para ubicar" chip). Receives no props — owners read their own context. */
  overlay?: ReactNode;
  /** Optional radius visualization (meters). When provided, the map renders a
   * faded fill + thin stroke around the anchor at the given radius. Used by
   * the cockpit to communicate the active search radius without crowding the
   * canvas. */
  radiusMeters?: number;
}

const PIN_VISUAL: Record<
  MultiPinSpec["kind"],
  { bg: string; ring: string; size: number }
> = {
  // Anchor uses a teardrop silhouette so it reads as "the property" at a glance
  // against the round parking discs. Its visuals live in the shared
  // `createPropertyPinElement`; this entry only satisfies the Record's key set.
  anchor: {
    bg: "var(--color-action-primary)",
    ring: "var(--color-text-on-accent)",
    size: 36,
  },
  // Confirmed parking pins share a single hue (blue / info-solid) regardless
  // of fee — the operator tells free from paid by the glyph (P vs meter),
  // not the color. Unknown stays muted gray so it reads as "fix me".
  "confirmed-free": {
    bg: "var(--color-status-info-solid)",
    ring: "var(--color-background-elevated)",
    size: 24,
  },
  "confirmed-paid": {
    bg: "var(--color-status-info-solid)",
    ring: "var(--color-background-elevated)",
    size: 24,
  },
  "confirmed-unknown": {
    bg: "var(--color-text-secondary)",
    ring: "var(--color-background-elevated)",
    size: 16,
  },
  // Transit arrival pins — the bg is replaced per-mode by `ARRIVAL_MODE_BG`
  // before the marker DOM is created; this entry only seeds size/ring defaults.
  "confirmed-arrival": {
    bg: "var(--color-action-primary)",
    ring: "var(--color-background-elevated)",
    size: 26,
  },
  // Suggestion arrival pins — smaller, muted, dashed-border variant of the
  // confirmed-arrival disc. Bg replaced per-mode like the confirmed variant.
  "suggestion-arrival": {
    bg: "var(--color-action-primary)",
    ring: "var(--color-background-elevated)",
    size: 18,
  },
  "suggestion-parking": {
    bg: "var(--color-status-warning-solid)",
    ring: "var(--color-background-elevated)",
    size: 14,
  },
  draft: {
    bg: "var(--color-action-primary)",
    ring: "var(--color-background-elevated)",
    size: 18,
  },
};

// Lucide `CircleParking` (inner ring + "P") — free pins. Mirrors the same
// Lucide icon used by ParkingFeeBadge in the list so the map and list show
// identical glyphs.
const PARKING_FREE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>`;

// Lucide `ParkingMeter` (post + meter head + base) — paid pins. Same 16px box.
const PARKING_PAID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9a3 3 0 1 1 6 0"/><path d="M12 12v3"/><path d="M11 15h2"/><path d="M19 9a7 7 0 1 0-13.6 2.3C6.4 14 8 16 8 18v3h8v-3c0-2 1.6-4 2.6-6.7A7 7 0 0 0 19 9"/><path d="M12 18H8"/></svg>`;

const PIN_ICON_SVG: Partial<Record<MultiPinSpec["kind"], string>> = {
  "confirmed-free": PARKING_FREE_SVG,
  "confirmed-paid": PARKING_PAID_SVG,
};

// Per-mode bg color for transit arrival pins. Picked from semantic status +
// accent tokens so dark mode + brand themes still hold. Exported so list
// rows (arrival-row.tsx) render the same hues as the map pins.
//
// Intercity quartet (the four cockpit tabs) — each hue is 50°+ apart on the
// OKLCH wheel from every other intercity pin and from the property anchor
// (olive 130°) so the operator can tell modes apart from color alone:
//   parking → info-solid (blue 235°)   ← lives in PIN_VISUAL["confirmed-*"]
//   train   → error-solid (red 25°)    — RENFE Cercanías cultural cue
//   bus     → warning-solid (orange 78°)
//   airport → accent-default (terracotta 40°)
export const ARRIVAL_MODE_BG: Record<ArrivalPinMode, string> = {
  train: "var(--color-status-error-solid)",
  bus: "var(--color-status-warning-solid)",
  airport: "var(--color-accent-default)",
};

// Lucide glyphs (stroke-width 1.75, 14×14 box) inline so the marker DOM stays
// a single <div>. Each fits inside a 26px circle with 4px inset padding.
// Train uses `TrainFrontTunnel` (train framed by a tunnel arch) and bus uses
// `BusFront` (front view with distinctive side mirrors) — both swapped from
// their previous `TrainFront`/`Bus` paths because at this size the older
// glyphs read ambiguously (train looked bus-shaped, bus looked tram-shaped).
const ARRIVAL_MODE_SVG: Record<ArrivalPinMode, string> = {
  train: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 22V12a10 10 0 1 1 20 0v10"/><path d="M15 6.8v1.4a3 2.8 0 1 1-6 0V6.8"/><path d="M10 15h.01"/><path d="M14 15h.01"/><path d="M10 19a4 4 0 0 1-4-4v-3a6 6 0 1 1 12 0v3a4 4 0 0 1-4 4Z"/><path d="m9 19-2 3"/><path d="m15 19 2 3"/></svg>`,
  bus: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/></svg>`,
  airport: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`,
};

function createAnchorElement(spec: MultiPinSpec, clickable: boolean): HTMLDivElement {
  // The property anchor is the shared property pin (single source) so it reads
  // identically here and on the Propiedad location map.
  return createPropertyPinElement({ label: spec.label, clickable });
}

// Suggestion pins (both parking and arrival) share a single neutral hue +
// plain filled circle (no glyph, no per-mode color) so they read uniformly
// as "candidate, not yet added" regardless of which tab is active. The
// active tab already scopes which mode of suggestion is visible — color
// would be redundant. Kept thin solid border for legibility on basemaps.
const SUGGESTION_PIN_BG = "var(--color-text-muted)";

function createPinElement(spec: MultiPinSpec, clickable: boolean): HTMLDivElement {
  if (spec.kind === "anchor") return createAnchorElement(spec, clickable);
  const v = PIN_VISUAL[spec.kind];
  const isArrivalKind =
    spec.kind === "confirmed-arrival" || spec.kind === "suggestion-arrival";
  const size = v.size;
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "9999px";
  const isSuggestion =
    spec.kind === "suggestion-arrival" || spec.kind === "suggestion-parking";
  if (isSuggestion) {
    el.style.background = SUGGESTION_PIN_BG;
    el.style.border = `1.5px solid ${v.ring}`;
    el.style.opacity = "0.65";
    el.dataset.suggestion = "true";
  } else if (isArrivalKind && spec.arrivalMode) {
    el.style.background = ARRIVAL_MODE_BG[spec.arrivalMode];
    el.style.border = spec.isRecommended
      ? `3px solid var(--color-status-warning-solid)`
      : `2px solid ${v.ring}`;
  } else {
    el.style.background = v.bg;
    el.style.border = `2px solid ${v.ring}`;
  }
  el.style.boxShadow = isSuggestion ? "none" : "var(--shadow-md)";
  el.style.cursor = clickable ? "pointer" : "default";
  el.style.outlineOffset = "2px";
  // Suggestions render as plain filled discs — no glyph. Confirmed pins keep
  // the per-mode / per-fee glyph for at-a-glance differentiation.
  if (!isSuggestion) {
    const iconSvg = isArrivalKind && spec.arrivalMode
      ? ARRIVAL_MODE_SVG[spec.arrivalMode]
      : PIN_ICON_SVG[spec.kind];
    if (iconSvg) {
      el.style.display = "grid";
      el.style.placeItems = "center";
      el.style.color = v.ring;
      el.innerHTML = iconSvg;
    }
  }
  if (spec.label) {
    el.title = spec.label;
    el.setAttribute("aria-label", spec.label);
  }
  return el;
}

const ACTIVE_OUTLINE = "3px solid var(--color-border-focus)";

/** Encodes a pin's visual identity (kind + recommended ring + label). The
 * marker effect keeps the existing marker when this key matches across
 * renders. `arrivalMode` is part of `kind`-derived styling but doesn't change
 * for a given id, so it's folded into the same key implicitly via `kind`. */
function pinIdentityKey(pin: MultiPinSpec): string {
  return `${pin.kind}|${pin.isRecommended ? 1 : 0}|${pin.label ?? ""}|${pin.arrivalMode ?? ""}`;
}

export function MultiPinMap({
  anchor,
  pins,
  activeId = null,
  onPinClick,
  onMapClick,
  armed = false,
  previewPin = null,
  height = 280,
  interactive = true,
  manualAdd,
  onPinHover,
  onExpand,
  overlay,
  radiusMeters,
}: MultiPinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const anchorMarkerRef = useRef<maplibregl.Marker | null>(null);
  /** id → { marker, key } where `key` encodes the pin's visual identity
   * (kind|isRecommended|label). When `key` matches across renders the marker
   * is reused; when only position changed we call `setLngLat`. Both cases
   * skip the create-element / re-bind-listeners work that re-adding does. */
  const markersByIdRef = useRef<
    Map<string, { marker: maplibregl.Marker; key: string }>
  >(new Map());
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
  const elementsByIdRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // Track whether we already auto-fit the viewport so subsequent pin changes
  // (adding/removing suggestions, confirming a hit) don't yank the operator
  // away from their current pan/zoom. Reset to false when the map is rebuilt.
  const hasAutoFitRef = useRef(false);
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;
  const onPinHoverRef = useRef(onPinHover);
  onPinHoverRef.current = onPinHover;
  // Internal manual-add armed state. When true the next map click commits
  // `manualAdd.onPlace(mode, lat, lng)` for the parent-supplied `mode`
  // instead of the external `onMapClick` (used by parking relocate).
  const [armedLocal, setArmedLocal] = useState(false);
  const armedLocalRef = useRef(armedLocal);
  armedLocalRef.current = armedLocal;
  const manualAddRef = useRef(manualAdd);
  manualAddRef.current = manualAdd;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const previewPinRef = useRef(previewPin);
  previewPinRef.current = previewPin;
  // Composite click handler — gates on internal armed state first; while a
  // draft preview is showing the next click also re-routes to manualAdd
  // (so the operator can re-position the draft without re-arming "+");
  // otherwise falls back to the external `onMapClick`. Held in a ref so the
  // MapLibre click listener captured at mount stays current without rebinding.
  const handleMapClickRef = useRef<(lat: number, lng: number) => void>(() => {});
  handleMapClickRef.current = (lat: number, lng: number) => {
    if (armedLocalRef.current) {
      const m = manualAddRef.current;
      if (m && m.mode && !m.disabled) {
        m.onPlace(m.mode, lat, lng);
      }
      setArmedLocal(false);
      return;
    }
    if (previewPinRef.current) {
      const m = manualAddRef.current;
      if (m && m.mode && !m.disabled) {
        m.onPlace(m.mode, lat, lng);
        return;
      }
    }
    onMapClickRef.current?.(lat, lng);
  };
  // Cancel armed state whenever the parent switches the active mode or
  // flips it to disabled — otherwise a stale arm placed a pin on the wrong
  // tab after tab-switch.
  useEffect(() => {
    setArmedLocal(false);
  }, [manualAdd?.mode, manualAdd?.disabled]);
  const { styleUrl, error } = useTilesStyleUrl();
  // `mapReady` flips after the map instance is created in the mount effect.
  // The marker effect gates on it so that when `styleUrl` resolves
  // asynchronously after the first render, markers re-attach to the freshly
  // mounted map — without this gate the marker effect runs once with a null
  // `mapRef`, bails, and never re-runs because its data deps are unchanged.
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!styleUrl || !containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [anchor.longitude, anchor.latitude],
      zoom: 14,
      attributionControl: false,
      // When `interactive` is false MapLibre disables drag-pan, scroll-zoom,
      // touch-zoom-rotate, double-click-zoom and keyboard handlers as a unit
      // — pointer events fall through to the parent (e.g. carousel swipe).
      interactive,
    });
    if (interactive) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    }
    // Compact attribution that starts (and stays) collapsed at bottom-left —
    // shared with LocationMap. The per-mode visibility chip strip lives in the
    // same corner with fully-opaque backgrounds and renders ABOVE the control
    // via z-10, covering the compact "ⓘ" icon.
    const disposeAttribution = addCollapsedAttribution(map);
    if (interactive) {
      map.on("click", (ev) => {
        handleMapClickRef.current(ev.lngLat.lat, ev.lngLat.lng);
      });
    }
    mapRef.current = map;
    setMapReady(true);

    return () => {
      disposeAttribution();
      map.remove();
      mapRef.current = null;
      anchorMarkerRef.current = null;
      markersByIdRef.current.clear();
      previewMarkerRef.current = null;
      elementsByIdRef.current.clear();
      hasAutoFitRef.current = false;
      setMapReady(false);
    };
    // The map mounts once per style URL — anchor/pin updates run in the
    // effect below so the user's pan/zoom is preserved across re-renders.
    // `interactive` is a deliberate dep: flipping it must rebuild the map
    // because MapLibre's interaction handlers can only be configured at
    // construction time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl, interactive]);

  // Anchor: one marker, rebuilt only when its coords change. Splitting this
  // from the pin-diff effect avoids tearing down + recreating the anchor
  // DOM node every time the `pins` array identity changes (which happens
  // on most parent re-renders).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    anchorMarkerRef.current?.remove();
    const anchorSpec: MultiPinSpec = {
      id: "__anchor__",
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      kind: "anchor",
      label: "Propiedad",
    };
    anchorMarkerRef.current = new maplibregl.Marker({
      element: createPinElement(anchorSpec, false),
      // Teardrop tip points to the property — align it with the geo point.
      anchor: "bottom",
    })
      .setLngLat([anchor.longitude, anchor.latitude])
      .addTo(map);
  }, [mapReady, anchor.latitude, anchor.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Pin diff: reuse markers whose visual identity hasn't changed (same id +
    // same kind/isRecommended/label). Position-only changes call `setLngLat`.
    // Identity changes (e.g. suggestion → confirmed) tear down + rebuild the
    // marker for that id so the new pin element + listeners take effect.
    const nextById = new Map<string, MultiPinSpec>();
    for (const pin of pins) nextById.set(pin.id, pin);

    for (const [id, entry] of markersByIdRef.current) {
      const newPin = nextById.get(id);
      if (!newPin || pinIdentityKey(newPin) !== entry.key) {
        entry.marker.remove();
        markersByIdRef.current.delete(id);
        elementsByIdRef.current.delete(id);
      } else {
        entry.marker.setLngLat([newPin.longitude, newPin.latitude]);
      }
    }

    for (const pin of pins) {
      if (markersByIdRef.current.has(pin.id)) continue;
      const clickable = Boolean(onPinClickRef.current);
      const el = createPinElement(pin, clickable);
      if (clickable) {
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onPinClickRef.current?.(pin.id);
        });
      }
      el.addEventListener("mouseenter", () => {
        onPinHoverRef.current?.(pin.id);
      });
      el.addEventListener("mouseleave", () => {
        onPinHoverRef.current?.(null);
      });
      elementsByIdRef.current.set(pin.id, el);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map);
      markersByIdRef.current.set(pin.id, {
        marker,
        key: pinIdentityKey(pin),
      });
    }

    if (pins.length > 0 && !hasAutoFitRef.current) {
      const bounds = new maplibregl.LngLatBounds(
        [anchor.longitude, anchor.latitude],
        [anchor.longitude, anchor.latitude],
      );
      for (const pin of pins) bounds.extend([pin.longitude, pin.latitude]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 600 });
      hasAutoFitRef.current = true;
    }
  }, [mapReady, anchor.latitude, anchor.longitude, pins]);

  useEffect(() => {
    for (const [id, el] of elementsByIdRef.current) {
      const isActive = id === activeId;
      el.style.outline = isActive ? ACTIVE_OUTLINE : "";
      // Suggestion pins ghost at 0.4 opacity by default; when the operator
      // is hovering them (active = matching row or pin), raise to full so
      // the highlight outline wraps a fully visible disc.
      if (el.dataset.suggestion === "true") {
        el.style.opacity = isActive ? "1" : "0.4";
      }
    }
  }, [activeId]);

  // Flip the canvas cursor reactively. Setting it to "" hands control back to
  // MapLibre's stylesheet, which restores the default grab/grabbing cursors.
  // Either external `armed` (relocate) or internal manual-add arm puts
  // the canvas in click-to-place mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !interactive) return;
    const armedAny = armed || armedLocal;
    map.getCanvas().style.cursor = armedAny ? "crosshair" : "";
  }, [mapReady, armed, armedLocal, interactive]);

  // Radius visualization — faded fill + thin stroke ring around the anchor.
  // Idempotent: source/layers are added once and updated via `setData` when
  // anchor or radius changes; removed when `radiusMeters` is null/zero.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const SOURCE_ID = "discovery-radius";
    const FILL_LAYER_ID = "discovery-radius-fill";
    const LINE_LAYER_ID = "discovery-radius-line";

    const removeRadius = () => {
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };

    if (!radiusMeters || radiusMeters <= 0) {
      removeRadius();
      return;
    }

    const data = buildCirclePolygon(anchor, radiusMeters);

    const existing = map.getSource(SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }

    // MapLibre paint expressions don't read CSS variables — resolve the token
    // to a literal at effect time so the radius ring tracks `--color-status-info-solid`
    // (same hue used by the confirmed parking pin). The opacity is the
    // dominant "discreet" cue (6% fill + 35% dashed stroke).
    const tint = resolveCssColor(readCssVar("--color-status-info-solid"));
    const addLayers = () => {
      if (!mapRef.current) return;
      if (mapRef.current.getSource(SOURCE_ID)) return;
      mapRef.current.addSource(SOURCE_ID, { type: "geojson", data });
      mapRef.current.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": tint, "fill-opacity": 0.06 },
      });
      mapRef.current.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": tint,
          "line-width": 1.25,
          "line-opacity": 0.35,
          "line-dasharray": [3, 3],
        },
      });
    };

    if (map.isStyleLoaded()) {
      addLayers();
      return;
    }
    map.once("load", addLayers);
    return () => {
      map.off("load", addLayers);
    };
  }, [mapReady, anchor.latitude, anchor.longitude, radiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!previewPin) {
      previewMarkerRef.current?.remove();
      previewMarkerRef.current = null;
      return;
    }
    if (previewMarkerRef.current) {
      previewMarkerRef.current.setLngLat([previewPin.longitude, previewPin.latitude]);
      return;
    }
    const el = createPinElement(
      {
        id: "__draft__",
        latitude: previewPin.latitude,
        longitude: previewPin.longitude,
        kind: "draft",
        label: "Pin manual",
      },
      false,
    );
    el.style.outline = ACTIVE_OUTLINE;
    previewMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([previewPin.longitude, previewPin.latitude])
      .addTo(map);
  }, [mapReady, previewPin]);

  if (error) {
    return (
      <div
        className="grid place-items-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-subtle)] text-sm text-[var(--color-text-muted)]"
        style={{ height }}
      >
        {error}
      </div>
    );
  }

  if (!styleUrl) {
    return (
      <div
        className="grid place-items-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-subtle)] text-sm text-[var(--color-text-muted)]"
        style={{ height }}
      >
        Cargando mapa…
      </div>
    );
  }

  const buttonDisabled =
    !manualAdd || manualAdd.disabled || manualAdd.mode === null;
  const tooltipText = buttonDisabled
    ? (manualAdd?.disabledReason ?? "No disponible")
    : (manualAdd?.addTooltip ?? "Añade un pin manualmente");
  const armedHintText =
    manualAdd?.armedHint ?? "Toca el mapa para colocar el pin";
  return (
    <div className="relative w-full" style={{ height }}>
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)]"
      />
      {/* Top-LEFT: zoom-to-lightbox affordance. NavigationControl (+/− zoom)
         sits top-right and would collide if we placed this there. Always-on
         (no hover gate) so the operator never has to discover it. */}
      {onExpand && interactive && (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Ampliar mapa"
          className={cn(
            "absolute left-3 top-3 z-[2] grid h-11 w-11 place-items-center rounded-full",
            "bg-[var(--color-background-overlay)] text-[var(--color-text-on-overlay)] backdrop-blur-[2px]",
            "shadow-[var(--shadow-md)] transition-colors duration-100",
            "hover:bg-[color-mix(in_oklch,var(--color-background-overlay)_70%,black)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-elevated)]",
          )}
        >
          <ZoomIn size={18} aria-hidden="true" />
        </button>
      )}
      {/* Bottom-RIGHT: unified "+" add-pin affordance. Direct-arms for the
         parent-supplied mode (no picker) — one click of "+", one click on
         the map. When disabled (e.g. the active tab's mode is off), the
         button greys out and surfaces the reason via tooltip. */}
      {manualAdd && interactive && (
        <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex flex-col items-end gap-2">
          {armedLocal && (
            <div className="pointer-events-auto inline-flex min-h-[36px] items-center gap-2 rounded-full bg-[var(--color-background-elevated)] px-3 text-[12px] font-medium text-[var(--color-text-primary)] shadow-[var(--shadow-md)]">
              <span>{armedHintText}</span>
              <button
                type="button"
                onClick={() => setArmedLocal(false)}
                className="text-[12px] font-semibold text-[var(--color-text-link)] hover:underline"
              >
                Cancelar
              </button>
            </div>
          )}
          {!armedLocal && (
            <div className="pointer-events-auto">
              <Tooltip text={tooltipText}>
                <button
                  type="button"
                  onClick={() => {
                    if (buttonDisabled) return;
                    setArmedLocal(true);
                  }}
                  disabled={buttonDisabled}
                  aria-label={tooltipText}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full",
                    "bg-[var(--color-background-overlay)] text-[var(--color-text-on-overlay)] backdrop-blur-[2px]",
                    "shadow-[var(--shadow-md)] transition-colors duration-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-elevated)]",
                    buttonDisabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-[color-mix(in_oklch,var(--color-background-overlay)_70%,black)]",
                  )}
                >
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      )}
      {overlay}
    </div>
  );
}
