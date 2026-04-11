"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface LocationMapProps {
  lat: number | null;
  lng: number | null;
  onPositionChange: (lat: number, lng: number) => void;
}

export function LocationMap({ lat, lng, onPositionChange }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const [styleUrl, setStyleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/geo/tiles-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.styleUrl) setStyleUrl(data.styleUrl);
        else setError("Mapa no disponible");
      })
      .catch(() => setError("Error al cargar configuración del mapa"));
  }, []);

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
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    if (lat != null && lng != null) {
      const marker = new maplibregl.Marker({ draggable: true, color: "#6366f1" })
        .setLngLat([lng, lat])
        .addTo(map);

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
        const marker = new maplibregl.Marker({ draggable: true, color: "#6366f1" })
          .setLngLat([clickLng, clickLat])
          .addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLngLat();
          onPositionChangeRef.current(pos.lat, pos.lng);
        });

        markerRef.current = marker;
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [styleUrl]);

  // Update marker when lat/lng change externally (geocode result)
  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) return;

    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else {
      const marker = new maplibregl.Marker({ draggable: true, color: "#6366f1" })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);

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
      <div className="flex h-48 items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] text-sm text-[var(--color-neutral-500)]">
        {error}
      </div>
    );
  }

  if (!styleUrl) {
    return (
      <div className="flex h-48 items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] text-sm text-[var(--color-neutral-500)]">
        Cargando mapa...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden"
    />
  );
}
