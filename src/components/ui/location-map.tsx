"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ZoomIn, X, Move } from "lucide-react";
import { cn } from "@/lib/cn";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTilesStyleUrl } from "@/hooks/use-tiles-style-url";
import { addCollapsedAttribution } from "@/lib/maplibre-attribution";
import { createPropertyPinElement } from "@/lib/property-pin-element";

interface LocationMapProps {
  lat: number | null;
  lng: number | null;
  onPositionChange: (lat: number, lng: number) => void;
}

function createMarker(map: maplibregl.Map, lng: number, lat: number): maplibregl.Marker {
  // Shared property pin (teardrop + Home glyph), anchored at its tip — the same
  // marker the Access cockpit map uses, so the property reads identically.
  return new maplibregl.Marker({
    element: createPropertyPinElement({ clickable: true }),
    anchor: "bottom",
    draggable: true,
  })
    .setLngLat([lng, lat])
    .addTo(map);
}

const FALLBACK_BOX =
  "flex w-full items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-subtle)] text-sm text-[var(--color-text-muted)]";

/** The MapLibre canvas + draggable pin. Standalone so the same map can render at
 * card size and, identically, inside the in-page zoom dialog. `overlay` is drawn
 * over the canvas (e.g. the zoom affordance) only once the style is ready. */
function MapCanvas({
  lat,
  lng,
  onPositionChange,
  heightClass,
  overlay,
}: LocationMapProps & { heightClass: string; overlay?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const { styleUrl, error } = useTilesStyleUrl();
  // Manual-pin mode: the pin only moves on a map click while "armed" (after the
  // operator taps the pin button). Idle clicks do nothing — so panning/exploring
  // never relocates the property by accident. Dragging the existing pin is always
  // allowed (an unambiguous, deliberate gesture).
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(armed);
  armedRef.current = armed;

  useEffect(() => {
    if (!styleUrl || !containerRef.current || mapRef.current) return;

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
    const disposeAttribution = addCollapsedAttribution(map);

    const attachMarker = (mLng: number, mLat: number) => {
      const marker = createMarker(map, mLng, mLat);
      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        onPositionChangeRef.current(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    };

    if (lat != null && lng != null) attachMarker(lng, lat);

    map.on("click", (e) => {
      if (!armedRef.current) return; // only place the pin when armed
      const { lat: clickLat, lng: clickLng } = e.lngLat;
      onPositionChangeRef.current(clickLat, clickLng);
      setArmed(false); // one placement per arm
      if (markerRef.current) markerRef.current.setLngLat([clickLng, clickLat]);
      else attachMarker(clickLng, clickLat);
    });

    mapRef.current = map;

    return () => {
      disposeAttribution();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Map mounts once per style URL; coordinate updates run in the effect below.
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

  if (error) return <div className={`${heightClass} ${FALLBACK_BOX}`}>{error}</div>;
  if (!styleUrl) return <div className={`${heightClass} ${FALLBACK_BOX}`}>Cargando mapa...</div>;

  return (
    <div className={`relative ${heightClass} w-full`}>
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)]" />
      <button
        type="button"
        onClick={() => setArmed((a) => !a)}
        aria-label="Colocar el pin manualmente"
        aria-pressed={armed}
        className={cn(
          "absolute bottom-3 right-3 z-[2] grid h-11 w-11 place-items-center rounded-full shadow-[var(--shadow-md)] backdrop-blur-[2px] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-elevated)]",
          armed
            ? "bg-[var(--color-action-primary)] text-[var(--color-action-primary-fg)]"
            : "bg-[var(--color-background-overlay)] text-[var(--color-text-on-overlay)] hover:bg-[color-mix(in_oklch,var(--color-background-overlay)_70%,black)]",
        )}
      >
        <Move size={18} aria-hidden="true" />
      </button>
      {overlay}
      {armed && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-[2] max-w-[200px] -translate-x-1/2 rounded-[var(--radius-lg)] bg-[var(--color-background-overlay)] px-3 py-1 text-center text-[12px] font-medium text-[var(--color-text-on-overlay)] shadow-[var(--shadow-md)] backdrop-blur-[2px]">
          Toca el mapa para colocar el pin
        </div>
      )}
    </div>
  );
}

/** Circular "ampliar" affordance — replicates the access cockpit map's zoom
 * control (in-page lightbox, not the browser's fullscreen API). */
function ZoomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ampliar mapa"
      className="absolute left-3 top-3 z-[2] grid h-11 w-11 place-items-center rounded-full bg-[var(--color-background-overlay)] text-[var(--color-text-on-overlay)] shadow-[var(--shadow-md)] backdrop-blur-[2px] transition-colors duration-100 hover:bg-[color-mix(in_oklch,var(--color-background-overlay)_70%,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background-elevated)]"
    >
      <ZoomIn size={18} aria-hidden="true" />
    </button>
  );
}

export function LocationMap({ lat, lng, onPositionChange }: LocationMapProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <MapCanvas
        lat={lat}
        lng={lng}
        onPositionChange={onPositionChange}
        heightClass="h-64"
        overlay={<ZoomButton onClick={() => setExpanded(true)} />}
      />

      <Dialog.Root open={expanded} onOpenChange={setExpanded}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-background-overlay)]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-background-elevated)] shadow-[var(--shadow-lg)] focus:outline-none sm:inset-6 md:inset-10"
          >
            <Dialog.Title className="sr-only">Ubicación de la propiedad</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="absolute right-3 top-3 z-[2] grid h-11 w-11 place-items-center rounded-full bg-[var(--color-background-overlay)] text-[var(--color-text-on-overlay)] shadow-[var(--shadow-md)] backdrop-blur-[2px] transition-colors duration-100 hover:bg-[color-mix(in_oklch,var(--color-background-overlay)_70%,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
            {/* A second map instance renders large; both share lat/lng/onChange,
                so moving the pin here updates the form + the card map. */}
            {expanded && (
              <MapCanvas lat={lat} lng={lng} onPositionChange={onPositionChange} heightClass="h-full" />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
