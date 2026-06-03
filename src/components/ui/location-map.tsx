"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { readCssVar } from "@/lib/css-var";
import { useTilesStyleUrl } from "@/hooks/use-tiles-style-url";

interface LocationMapProps {
  lat: number | null;
  lng: number | null;
  onPositionChange: (lat: number, lng: number) => void;
}

function createMarker(map: maplibregl.Map, lng: number, lat: number): maplibregl.Marker {
  const primaryColor = readCssVar("--color-action-primary");
  const options: maplibregl.MarkerOptions = { draggable: true };
  if (primaryColor) options.color = primaryColor;
  return new maplibregl.Marker(options).setLngLat([lng, lat]).addTo(map);
}

export function LocationMap({ lat, lng, onPositionChange }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const { styleUrl, error } = useTilesStyleUrl();

  useEffect(() => {
    if (!styleUrl || !containerRef.current) return;
    if (mapRef.current) return;

    const center: [number, number] = lng != null && lat != null ? [lng, lat] : [-3.7, 40.4];
    const zoom = lng != null && lat != null ? 15 : 5;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    // MapLibre's compact AttributionControl ships EXPANDED on mount and on every
    // style/source change. Close it on mount + after load/styledata so the
    // "OpenStreetMap contributors" banner starts collapsed — parity with the
    // Access cockpit map (`multi-pin-map.tsx`). No MutationObserver (it would
    // ping-pong against MapLibre's own DOM writes).
    const collapseAttribution = () => {
      containerRef.current?.querySelectorAll(".maplibregl-ctrl-attrib").forEach((el) => {
        if (el instanceof HTMLDetailsElement && el.open) el.open = false;
        if (el.classList.contains("maplibregl-compact-show")) {
          el.classList.remove("maplibregl-compact-show");
        }
      });
    };
    collapseAttribution();
    const rafId = requestAnimationFrame(collapseAttribution);
    map.on("load", collapseAttribution);
    map.on("styledata", collapseAttribution);

    if (lat != null && lng != null) {
      const marker = createMarker(map, lng, lat);
      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        onPositionChangeRef.current(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }

    map.on("click", (e) => {
      const { lat: clickLat, lng: clickLng } = e.lngLat;
      onPositionChangeRef.current(clickLat, clickLng);

      if (markerRef.current) {
        markerRef.current.setLngLat([clickLng, clickLat]);
      } else {
        const marker = createMarker(map, clickLng, clickLat);
        marker.on("dragend", () => {
          const pos = marker.getLngLat();
          onPositionChangeRef.current(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }
    });

    mapRef.current = map;

    return () => {
      cancelAnimationFrame(rafId);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Initial map setup depends on `styleUrl` only — re-creating the map on
    // every lat/lng change would flicker and lose user interaction. Coordinate
    // updates are handled by the separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) return;

    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else {
      const marker = createMarker(mapRef.current, lng, lat);
      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        onPositionChangeRef.current(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }

    mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
  }, [lat, lng]);

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-subtle)] text-sm text-[var(--color-text-muted)]">
        {error}
      </div>
    );
  }

  if (!styleUrl) {
    return (
      <div className="flex h-48 items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-subtle)] text-sm text-[var(--color-text-muted)]">
        Cargando mapa...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded-[var(--radius-lg)] border border-[var(--color-border-default)] overflow-hidden"
    />
  );
}
