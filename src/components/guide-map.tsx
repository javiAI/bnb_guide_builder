"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GuideMapData, GuideMapPin } from "@/lib/types/guide-map";
import { escapeHtml } from "@/lib/utils/html-escape";
import { formatDistance } from "@/lib/services/places";
import { distanceBucketLabel } from "@/lib/services/places/distance-bucket";

type FilterMode = "all" | "places" | "events";

interface Props {
  data: GuideMapData;
}

const METERS_PER_DEG_LAT = 111320;
const CIRCLE_SEGMENTS = 64;
const ZONE_SOURCE_ID = "guide-zone";
const ZONE_FILL_LAYER_ID = "guide-zone-fill";
const ZONE_LINE_LAYER_ID = "guide-zone-line";

/**
 * Client island for `gs.local`. Never SSR-imported — MapLibre touches
 * `window` on load. A 503 from `/api/geo/tiles-config` (no
 * `MAPTILER_API_KEY`) degrades to a textual fallback rather than a broken
 * canvas.
 */
export function GuideMap({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [styleUrl, setStyleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FilterMode>("all");

  // Memoed because it gates an imperative `useEffect` below — a new array
  // identity on every render would re-run marker rebuild unnecessarily.
  const { places, events, visiblePins } = useMemo(() => {
    const places: GuideMapPin[] = [];
    const events: GuideMapPin[] = [];
    for (const p of data.pins) {
      if (p.kind === "place") places.push(p);
      else if (p.kind === "event") events.push(p);
    }
    const visiblePins =
      mode === "places" ? places : mode === "events" ? events : data.pins;
    return { places, events, visiblePins };
  }, [data.pins, mode]);

  const placeCount = places.length;
  const eventCount = events.length;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo/tiles-config")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        if (typeof body.styleUrl === "string") setStyleUrl(body.styleUrl);
        else setError("Mapa no disponible");
      })
      .catch(() => {
        if (!cancelled) setError("Mapa no disponible");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize map (once per styleUrl). Reacting to anchor/pins happens in
  // the separate effects below — rebuilding the map on data changes would
  // flash the user's pan/zoom away.
  useEffect(() => {
    if (!styleUrl || !containerRef.current || mapRef.current) return;

    const initial = pickInitialView(data);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: initial.center,
      zoom: initial.zoom,
      attributionControl: false,
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );

    mapRef.current = map;

    map.on("load", () => {
      drawAnchorZone(map, data);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // Intentionally only depends on `styleUrl` — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  // Rebuild pin markers when the filter mode changes. MapLibre doesn't let
  // you toggle marker visibility cleanly without re-adding, so clear + re-add
  // is simpler and stays crisp on an island this small.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    for (const pin of visiblePins) {
      const el = buildPinElement(pin);
      const popup = new maplibregl.Popup({ offset: 18, closeButton: false })
        .setHTML(buildPopupHtml(pin));
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    }

    // Refit bounds to the currently-visible pins. Without this, filtering to
    // a subset whose pins lie outside the initial viewport would leave the
    // map centered on the original bounds with the filtered pins off-screen.
    fitToCoords(map, collectCoords(data.anchor, visiblePins));
  }, [visiblePins, data.anchor]);

  if (error) {
    return <GuideMapFallback reason={error} />;
  }
  if (!styleUrl) {
    return <GuideMapFallback reason="Cargando mapa…" variant="loading" />;
  }

  return (
    <div className="guide-map">
      <div
        className="guide-map__toggle"
        role="group"
        aria-label="Filtro de puntos del mapa"
      >
        <button
          type="button"
          aria-pressed={mode === "all"}
          className={`guide-map__toggle-btn${mode === "all" ? " is-active" : ""}`}
          onClick={() => setMode("all")}
        >
          Todos
          <span className="guide-map__toggle-count">{data.pins.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={mode === "places"}
          className={`guide-map__toggle-btn${mode === "places" ? " is-active" : ""}`}
          onClick={() => setMode("places")}
        >
          Lugares
          <span className="guide-map__toggle-count">{placeCount}</span>
        </button>
        <button
          type="button"
          aria-pressed={mode === "events"}
          className={`guide-map__toggle-btn${mode === "events" ? " is-active" : ""}`}
          onClick={() => setMode("events")}
        >
          Eventos
          <span className="guide-map__toggle-count">{eventCount}</span>
        </button>
      </div>
      <div
        ref={containerRef}
        className="guide-map__canvas"
        role="region"
        aria-label="Mapa de la zona de la propiedad"
      />
      {data.anchor?.obfuscated ? (
        <p className="guide-map__zone-note">
          La zona mostrada es aproximada. La dirección exacta se entrega al
          confirmar la reserva.
        </p>
      ) : null}
    </div>
  );
}

function GuideMapFallback({
  reason,
  variant = "error",
}: {
  reason: string;
  variant?: "error" | "loading";
}) {
  return (
    <div
      className={`guide-map__fallback guide-map__fallback--${variant}`}
      role={variant === "error" ? "status" : undefined}
    >
      {reason}
    </div>
  );
}

function pickInitialView(data: GuideMapData): {
  center: [number, number];
  zoom: number;
} {
  if (data.anchor) {
    // Pick a zoom that accommodates the event-search radius so the dashed
    // outer circle is visible on first paint. Fallback to zoom 14 when no
    // radius is configured.
    const zoom = zoomForRadius(data.eventSearchRadiusMeters);
    return { center: [data.anchor.lng, data.anchor.lat], zoom };
  }
  if (data.pins.length > 0) {
    const first = data.pins[0];
    return { center: [first.lng, first.lat], zoom: 13 };
  }
  return { center: [-3.7, 40.4], zoom: 5 };
}

// Maps an event-search radius in meters to a map zoom level that fits the
// full diameter with a margin. Derived empirically from Web Mercator scale
// (~156543 m/px at z=0 at the equator); each zoom level doubles resolution.
// Clamped to [9, 14] so extreme configured values don't produce unusable
// global or street-level views.
function zoomForRadius(radiusMeters: number | null): number {
  if (radiusMeters == null || radiusMeters <= 0) return 14;
  if (radiusMeters <= 1_000) return 14;
  if (radiusMeters <= 2_500) return 13;
  if (radiusMeters <= 5_000) return 12;
  if (radiusMeters <= 10_000) return 11;
  if (radiusMeters <= 25_000) return 10;
  if (radiusMeters <= 50_000) return 9;
  return 9;
}

function collectCoords(
  anchor: GuideMapData["anchor"],
  pins: GuideMapPin[],
): [number, number][] {
  const coords: [number, number][] = [];
  if (anchor) coords.push([anchor.lng, anchor.lat]);
  for (const pin of pins) coords.push([pin.lng, pin.lat]);
  return coords;
}

function fitToCoords(map: maplibregl.Map, coords: [number, number][]) {
  if (coords.length === 0) return;
  // `fitBounds` over a zero-area bounds produces undefined zoom in MapLibre
  // — `jumpTo` at a sensible zoom is the correct recovery for filter modes
  // that leave exactly one visible pin (e.g. "events" with a single event).
  if (coords.length === 1) {
    map.jumpTo({ center: coords[0], zoom: 14 });
    return;
  }
  const bounds = coords.reduce(
    (acc, c) => acc.extend(c),
    new maplibregl.LngLatBounds(coords[0], coords[0]),
  );
  map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
}

function drawAnchorZone(map: maplibregl.Map, data: GuideMapData) {
  if (!data.anchor) return;

  // Internal audience keeps a precise pin for operator use. Guest/AI never
  // get an exact-coord marker — `data.anchor.obfuscated` is true for them
  // and the anchor lat/lng are already jittered by `obfuscateAnchor`.
  if (!data.anchor.obfuscated) {
    const el = document.createElement("div");
    el.className = "guide-map__pin guide-map__pin--anchor-exact";
    new maplibregl.Marker({ element: el })
      .setLngLat([data.anchor.lng, data.anchor.lat])
      .addTo(map);
  }

  // One solid filled zone. Represents the configured event-search radius
  // when available (so the guest sees the area from which upcoming events
  // are drawn); falls back to the obfuscation-disk radius when the host
  // hasn't set a radius — which is enough to convey approximate location.
  const zoneRadiusMeters =
    data.eventSearchRadiusMeters && data.eventSearchRadiusMeters > 0
      ? data.eventSearchRadiusMeters
      : data.anchor.obfuscated
        ? data.anchor.radiusMeters
        : null;
  if (zoneRadiusMeters == null) return;

  const circle = buildCircleGeoJSON(
    data.anchor.lat,
    data.anchor.lng,
    zoneRadiusMeters,
  );
  map.addSource(ZONE_SOURCE_ID, { type: "geojson", data: circle });
  map.addLayer({
    id: ZONE_FILL_LAYER_ID,
    type: "fill",
    source: ZONE_SOURCE_ID,
    paint: { "fill-color": "#6366f1", "fill-opacity": 0.15 },
  });
  map.addLayer({
    id: ZONE_LINE_LAYER_ID,
    type: "line",
    source: ZONE_SOURCE_ID,
    paint: { "line-color": "#4f46e5", "line-width": 2, "line-opacity": 0.6 },
  });
}

function buildCircleGeoJSON(
  lat: number,
  lng: number,
  radiusMeters: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const metersPerDegLngHere =
    METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const coords: [number, number][] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const theta = (i / CIRCLE_SEGMENTS) * 2 * Math.PI;
    const offsetEast = radiusMeters * Math.cos(theta);
    const offsetNorth = radiusMeters * Math.sin(theta);
    const dLat = offsetNorth / METERS_PER_DEG_LAT;
    const dLng = metersPerDegLngHere === 0 ? 0 : offsetEast / metersPerDegLngHere;
    coords.push([lng + dLng, lat + dLat]);
  }
  coords.push(coords[0]);
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: {},
  };
}

function buildPinElement(pin: GuideMapPin): HTMLButtonElement {
  // Real <button> (not div role=button) so native Enter/Space activation
  // fires the click → popup, and focus styles are handled by the UA.
  // Category-specific iconography lives in the React listing; the marker
  // itself stays a colored dot whose `kind` tells place vs event.
  const el = document.createElement("button");
  el.type = "button";
  el.className = `guide-map__pin guide-map__pin--${pin.kind}`;
  el.setAttribute("aria-label", pin.label);
  return el;
}

function buildPopupHtml(pin: GuideMapPin): string {
  const safeLabel = escapeHtml(pin.label);
  if (pin.kind === "place") {
    // Prefer exact meters when the payload was built for internal audience;
    // otherwise fall back to the coarse bucket label emitted for guest/ai.
    // See `guide-map.service.ts` for the triangulation rationale.
    const distance =
      pin.distanceMeters != null
        ? formatDistance(pin.distanceMeters)
        : pin.distanceBucketKey
          ? distanceBucketLabel(pin.distanceBucketKey)
          : null;
    return `
      <div class="guide-map__popup">
        <p class="guide-map__popup-title">${safeLabel}</p>
        ${distance ? `<p class="guide-map__popup-meta">${escapeHtml(distance)}</p>` : ""}
      </div>
    `.trim();
  }
  const whenLabel = formatDate(pin.startsAt);
  return `
    <div class="guide-map__popup">
      <p class="guide-map__popup-title">${safeLabel}</p>
      <p class="guide-map__popup-meta">${escapeHtml(whenLabel)}</p>
    </div>
  `.trim();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
