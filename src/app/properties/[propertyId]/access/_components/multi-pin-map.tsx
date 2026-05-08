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
  anchor: {
    bg: "var(--color-action-primary)",
    ring: "var(--color-text-on-accent)",
    size: 30,
  },
  "confirmed-free": {
    bg: "var(--color-status-success-solid)",
    ring: "var(--color-background-elevated)",
    size: 16,
  },
  "confirmed-paid": {
    bg: "var(--color-status-info-solid)",
    ring: "var(--color-background-elevated)",
    size: 16,
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

// Inline SVG (Lucide `MapPinHouse` flavor) — house glyph centered inside a
// pin shape. The anchor marker uses this to read as "your property" at a
// glance, distinct from the round dots used for parking pins.
const ANCHOR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.4 12 3l9 7.4V21H3z"/><path d="M9 21v-7h6v7"/></svg>`;

function createPinElement(spec: MultiPinSpec, clickable: boolean): HTMLDivElement {
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
  if (spec.kind === "anchor") {
    el.style.display = "grid";
    el.style.placeItems = "center";
    el.style.color = "var(--color-text-on-accent)";
    el.innerHTML = ANCHOR_ICON_SVG;
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
