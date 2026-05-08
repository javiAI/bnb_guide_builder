"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MultiPinSpec {
  id: string;
  latitude: number;
  longitude: number;
  /** anchor = property location · confirmed-* = saved LocalPlace (variants by
   * fee type so free/paid are visually distinct on the map) · suggestion =
   * unsaved provider hit · draft = manual-form preview */
  kind:
    | "anchor"
    | "confirmed-free"
    | "confirmed-paid"
    | "confirmed-unknown"
    | "suggestion"
    | "draft";
  label?: string;
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
  /** Optional preview pin overlay — a "draft" marker shown while the
   * operator is composing a manual pin. Independent of `pins` so swapping
   * it doesn't trigger a fitBounds. */
  previewPin?: { latitude: number; longitude: number } | null;
  height?: number;
}

const PIN_VISUAL: Record<
  MultiPinSpec["kind"],
  { bg: string; ring: string; size: number }
> = {
  // Anchor uses a teardrop silhouette (rendered separately below) so it reads
  // as "the property" at a glance against the round parking discs. `bg`/`ring`
  // here only seed the teardrop fill / icon stroke colors.
  anchor: {
    bg: "var(--color-action-primary)",
    ring: "var(--color-text-on-accent)",
    size: 36,
  },
  // Free/paid carry distinct glyphs (P-in-circle vs parking-meter) on top of
  // the color cue — colorblind operators relied on icon shape alone.
  "confirmed-free": {
    bg: "var(--color-status-success-solid)",
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
  suggestion: {
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

// Inline Lucide `Home` glyph (currentColor stroke) — sits inside the anchor
// teardrop head so the property reads as "home" against the parking discs.
const ANCHOR_HOME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

// Lucide `CircleParking` (filled "P" disc) — free pins. Sized to fit the
// 24px disc with a 4px inset.
const PARKING_FREE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>`;

// Lucide `ParkingMeter` (post + meter head + base) — paid pins. Same 16px box.
const PARKING_PAID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9a3 3 0 1 1 6 0"/><path d="M12 12v3"/><path d="M11 15h2"/><path d="M19 9a7 7 0 1 0-13.6 2.3C6.4 14 8 16 8 18v3h8v-3c0-2 1.6-4 2.6-6.7A7 7 0 0 0 19 9"/><path d="M12 18H8"/></svg>`;

const PIN_ICON_SVG: Partial<Record<MultiPinSpec["kind"], string>> = {
  "confirmed-free": PARKING_FREE_SVG,
  "confirmed-paid": PARKING_PAID_SVG,
};

function createAnchorElement(spec: MultiPinSpec, clickable: boolean): HTMLDivElement {
  const v = PIN_VISUAL.anchor;
  const height = Math.round(v.size * 1.25);
  const el = document.createElement("div");
  el.style.width = `${v.size}px`;
  el.style.height = `${height}px`;
  el.style.position = "relative";
  el.style.cursor = clickable ? "pointer" : "default";
  el.style.outlineOffset = "2px";
  el.style.color = v.ring;
  el.style.filter = "drop-shadow(var(--shadow-md))";
  // Teardrop SVG (single path: round head + tapered tail). The icon overlays
  // the head via absolute positioning so the SVG itself stays anchored to the
  // marker's geographic point (tip at (0,0) in the SVG's coordinate system).
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${v.size}" height="${height}" viewBox="0 0 24 30" aria-hidden="true" style="position:absolute;inset:0;">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 7.5 9 16 11.3 18 .4.3 1 .3 1.4 0C15 28 24 19.5 24 12 24 5.4 18.6 0 12 0Z" fill="${v.bg}" stroke="${v.ring}" stroke-width="1.5"/>
    </svg>
    <span style="position:absolute;top:5px;left:0;right:0;display:grid;place-items:center;height:24px;color:${v.ring};">${ANCHOR_HOME_SVG}</span>
  `;
  if (spec.label) {
    el.title = spec.label;
    el.setAttribute("aria-label", spec.label);
  }
  return el;
}

function createPinElement(spec: MultiPinSpec, clickable: boolean): HTMLDivElement {
  if (spec.kind === "anchor") return createAnchorElement(spec, clickable);
  const v = PIN_VISUAL[spec.kind];
  const el = document.createElement("div");
  el.style.width = `${v.size}px`;
  el.style.height = `${v.size}px`;
  el.style.borderRadius = "9999px";
  el.style.background = v.bg;
  el.style.border = `2px solid ${v.ring}`;
  el.style.boxShadow = "var(--shadow-md)";
  el.style.cursor = clickable ? "pointer" : "default";
  el.style.outlineOffset = "2px";
  const iconSvg = PIN_ICON_SVG[spec.kind];
  if (iconSvg) {
    el.style.display = "grid";
    el.style.placeItems = "center";
    el.style.color = v.ring;
    el.innerHTML = iconSvg;
  }
  if (spec.label) {
    el.title = spec.label;
    el.setAttribute("aria-label", spec.label);
  }
  return el;
}

const ACTIVE_OUTLINE = "3px solid var(--color-border-focus)";

export function MultiPinMap({
  anchor,
  pins,
  activeId = null,
  onPinClick,
  onMapClick,
  previewPin = null,
  height = 280,
}: MultiPinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
  const elementsByIdRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const [styleUrl, setStyleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `mapReady` flips after the map instance is created in the mount effect.
  // The marker effect gates on it so that when `styleUrl` resolves
  // asynchronously after the first render, markers re-attach to the freshly
  // mounted map — without this gate the marker effect runs once with a null
  // `mapRef`, bails, and never re-runs because its data deps are unchanged.
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo/tiles-config")
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.styleUrl) setStyleUrl(data.styleUrl);
        else setError("Mapa no disponible");
      })
      .catch(() => {
        if (!cancelled) setError("Error al cargar el mapa");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!styleUrl || !containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [anchor.longitude, anchor.latitude],
      zoom: 14,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    map.on("click", (ev) => {
      onMapClickRef.current?.(ev.lngLat.lat, ev.lngLat.lng);
    });
    if (onMapClickRef.current) {
      map.on("load", () => {
        map.getCanvas().style.cursor = "crosshair";
      });
    }
    mapRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      previewMarkerRef.current = null;
      elementsByIdRef.current.clear();
      setMapReady(false);
    };
    // The map mounts once per style URL — anchor/pin updates run in the
    // effect below so the user's pan/zoom is preserved across re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    elementsByIdRef.current.clear();

    const anchorSpec: MultiPinSpec = {
      id: "__anchor__",
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      kind: "anchor",
      label: "Propiedad",
    };
    const anchorMarker = new maplibregl.Marker({
      element: createPinElement(anchorSpec, false),
      // Teardrop tip points to the property — align it with the geo point.
      anchor: "bottom",
    })
      .setLngLat([anchor.longitude, anchor.latitude])
      .addTo(map);
    markersRef.current.push(anchorMarker);

    for (const pin of pins) {
      const clickable = Boolean(onPinClickRef.current);
      const el = createPinElement(pin, clickable);
      if (clickable) {
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onPinClickRef.current?.(pin.id);
        });
      }
      elementsByIdRef.current.set(pin.id, el);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    }

    if (pins.length > 0) {
      const bounds = new maplibregl.LngLatBounds(
        [anchor.longitude, anchor.latitude],
        [anchor.longitude, anchor.latitude],
      );
      for (const pin of pins) bounds.extend([pin.longitude, pin.latitude]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 600 });
    }
  }, [mapReady, anchor.latitude, anchor.longitude, pins]);

  useEffect(() => {
    for (const [id, el] of elementsByIdRef.current) {
      el.style.outline = id === activeId ? ACTIVE_OUTLINE : "";
    }
  }, [activeId]);

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

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)]"
      style={{ height }}
    />
  );
}
