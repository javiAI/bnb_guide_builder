"use client";

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type SyntheticEvent,
} from "react";
import { useRouter } from "next/navigation";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Loader2, Search, X } from "lucide-react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  confirmParkingPlacesBulkAction,
  searchNearbyParkingsAction,
} from "@/lib/actions/parking.actions";
import type { ParkingSuggestion } from "@/lib/services/parking-discovery.service";
import type { SubsystemSlide } from "./subsystem-card.types";
import { MultiPinMap, type MultiPinSpec } from "./multi-pin-map";

// The library's default Slide union covers image + video. We extend it locally
// with two synthetic types: "video-url" (a plain <video src=> we render via
// render.slide so we don't depend on the Video plugin), and "live-map" (the
// parking interactive map). Both are flagged by `type` and resolved in the
// render.slide callback below — the library treats unknown types as opaque.
type LiveMapSlide = {
  type: "live-map";
  id: string;
  title: string;
  alt: string;
  anchor: { latitude: number; longitude: number };
  pins: MultiPinSpec[];
};

type VideoUrlSlide = {
  type: "video-url";
  id: string;
  title: string;
  alt: string;
  src: string;
};

type LightboxSlide = Slide | LiveMapSlide | VideoUrlSlide;

interface Props {
  slides: readonly SubsystemSlide[];
  /** When `null`, the lightbox is closed. When a number, opens at that index. */
  index: number | null;
  onIndexChange: (idx: number) => void;
  onClose: () => void;
  /** When set, live-map slides render an interactive discovery overlay
   * (search + bulk-confirm as free/paid) tied to this property. Only the
   * parking subsystem passes it; other surfaces get the plain MultiPinMap. */
  parkingDiscovery?: { propertyId: string };
}

export function MediaLightbox({
  slides,
  index,
  onIndexChange,
  onClose,
  parkingDiscovery,
}: Props) {
  const lightboxSlides = useMemo<LightboxSlide[]>(() => {
    return slides
      .map((s): LightboxSlide | null => {
        if (s.kind === "image" || s.kind === "map") {
          return {
            type: "image",
            src: s.url,
            alt: s.alt || s.title,
          };
        }
        if (s.kind === "video") {
          return {
            type: "video-url",
            id: s.id,
            title: s.title,
            alt: s.alt || s.title,
            src: s.url,
          };
        }
        if (s.kind === "live-map") {
          if (!s.liveAnchor) return null;
          const pins: MultiPinSpec[] = (s.livePins ?? []).map((p) => ({
            id: p.id,
            latitude: p.latitude,
            longitude: p.longitude,
            kind:
              p.feeType === "free"
                ? "confirmed-free"
                : p.feeType === "paid"
                  ? "confirmed-paid"
                  : "confirmed-unknown",
            label: p.label,
          }));
          return {
            type: "live-map",
            id: s.id,
            title: s.title,
            alt: s.alt || s.title,
            anchor: s.liveAnchor,
            pins,
          };
        }
        return null;
      })
      .filter((s): s is LightboxSlide => s !== null);
  }, [slides]);

  if (index === null || lightboxSlides.length === 0) return null;

  return (
    <Lightbox
      open
      close={onClose}
      index={Math.min(index, lightboxSlides.length - 1)}
      slides={lightboxSlides as Slide[]}
      on={{ view: ({ index: i }) => onIndexChange(i) }}
      controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
      animation={{ fade: 200, swipe: 280 }}
      carousel={{ finite: false, padding: "16px", spacing: "24px" }}
      render={{
        slide: ({ slide }) => {
          const s = slide as LightboxSlide;
          if ("type" in s && s.type === "live-map") {
            // 75vh covers "almost the whole screen" while leaving room for
            // the toolbar/counter. MapLibre takes its container's height so
            // we hand it a fixed pixel value via a CSS calc inline.
            // stopPropagation on pointer/touch events so MapLibre's drag-to-pan
            // doesn't double as the lightbox's drag-to-next-slide gesture.
            const stop = (e: SyntheticEvent) => e.stopPropagation();
            const mapHeight = Math.round(
              Math.min(window.innerHeight * 0.82, 900),
            );
            return (
              <div
                style={{ width: "min(95vw, 1400px)", height: "min(82vh, 900px)" }}
                className="relative overflow-hidden rounded-[12px]"
                onPointerDown={stop}
                onPointerMove={stop}
                onPointerUp={stop}
                onTouchStart={stop}
                onTouchMove={stop}
                onTouchEnd={stop}
                onMouseDown={stop}
                onMouseMove={stop}
                onMouseUp={stop}
              >
                {parkingDiscovery ? (
                  <LiveMapDiscoverySlide
                    propertyId={parkingDiscovery.propertyId}
                    anchor={s.anchor}
                    basePins={s.pins}
                    height={mapHeight}
                  />
                ) : (
                  <MultiPinMap
                    anchor={s.anchor}
                    pins={s.pins}
                    height={mapHeight}
                    interactive={true}
                  />
                )}
              </div>
            );
          }
          if ("type" in s && s.type === "video-url") {
            return (
              <video
                src={s.src}
                controls
                playsInline
                preload="metadata"
                aria-label={s.alt}
                style={{
                  maxWidth: "min(95vw, 1400px)",
                  maxHeight: "min(82vh, 900px)",
                }}
                className="rounded-[12px] bg-black"
              />
            );
          }
          return undefined;
        },
      }}
      styles={{
        container: { backgroundColor: "var(--color-background-scrim)" },
      }}
    />
  );
}

// ── Live-map discovery overlay ───────────────────────────────────────────
//
// Ephemeral parking-discovery surface that lives entirely inside the lightbox.
// State (suggestions, selection) is local — closing the lightbox throws it
// away. Confirmed pins persist via `confirmParkingPlacesBulkAction` +
// `router.refresh()`, so on close the cockpit map slide already shows them.
//
// Pin click toggles selection. We use the `activeId` highlight to show the
// most-recently-clicked one and render a compact selected-chips strip in
// the panel so the operator sees the full multi-selection without needing
// a new pin variant.

function LiveMapDiscoverySlide({
  propertyId,
  anchor,
  basePins,
  height,
}: {
  propertyId: string;
  anchor: { latitude: number; longitude: number };
  basePins: readonly MultiPinSpec[];
  height: number;
}) {
  const router = useRouter();
  const [searching, startSearchTransition] = useTransition();
  const [mutating, startMutateTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<ParkingSuggestion[] | null>(
    null,
  );
  const [selectedProviderPlaceIds, setSelectedProviderPlaceIds] = useState<
    Set<string>
  >(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(() => {
    setError(null);
    setSelectedProviderPlaceIds(new Set());
    startSearchTransition(async () => {
      const res = await searchNearbyParkingsAction(propertyId, "es");
      if (!res.success || !res.data) {
        setError(res.error ?? "Error desconocido");
        return;
      }
      setSuggestions(res.data.suggestions);
    });
  }, [propertyId]);

  const handlePinClick = useCallback((id: string) => {
    setActiveId(id);
    if (!id.startsWith("sug-")) return;
    const providerPlaceId = id.slice(4);
    setSelectedProviderPlaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(providerPlaceId)) next.delete(providerPlaceId);
      else next.add(providerPlaceId);
      return next;
    });
  }, []);

  const handleDeselect = useCallback((providerPlaceId: string) => {
    setSelectedProviderPlaceIds((prev) => {
      if (!prev.has(providerPlaceId)) return prev;
      const next = new Set(prev);
      next.delete(providerPlaceId);
      return next;
    });
  }, []);

  const handleBulkConfirm = useCallback(
    (feeType: "free" | "paid") => {
      if (selectedProviderPlaceIds.size === 0 || !suggestions) return;
      setError(null);
      const items = suggestions
        .filter((s) => selectedProviderPlaceIds.has(s.providerPlaceId))
        .map((s) => ({
          propertyId,
          provider: s.provider,
          providerPlaceId: s.providerPlaceId,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          address: s.address,
          website: s.website,
          distanceMeters: s.distanceMeters,
          providerMetadata: s.providerMetadata,
        }));
      if (items.length === 0) return;
      startMutateTransition(async () => {
        const res = await confirmParkingPlacesBulkAction({ items, feeType });
        if (!res.success || !res.data) {
          setError(res.error ?? "No se pudieron guardar los pines");
          return;
        }
        const consumed = new Set(selectedProviderPlaceIds);
        for (const id of res.data.skippedProviderPlaceIds) consumed.add(id);
        setSuggestions((prev) =>
          prev ? prev.filter((s) => !consumed.has(s.providerPlaceId)) : null,
        );
        setSelectedProviderPlaceIds(new Set());
        // The cockpit cover map reads from props sourced server-side, so
        // refresh re-fetches the confirmed pins. The lightbox stays open;
        // the operator continues searching/adding without re-zooming.
        router.refresh();
      });
    },
    [propertyId, router, selectedProviderPlaceIds, suggestions],
  );

  const mapPins: MultiPinSpec[] = useMemo(() => {
    const out: MultiPinSpec[] = [...basePins];
    if (suggestions) {
      for (const s of suggestions) {
        out.push({
          id: `sug-${s.providerPlaceId}`,
          latitude: s.latitude,
          longitude: s.longitude,
          kind: "suggestion",
          label: s.name,
        });
      }
    }
    return out;
  }, [basePins, suggestions]);

  const selectedSuggestions = useMemo(() => {
    if (!suggestions) return [];
    return suggestions.filter((s) =>
      selectedProviderPlaceIds.has(s.providerPlaceId),
    );
  }, [suggestions, selectedProviderPlaceIds]);

  const selectedCount = selectedSuggestions.length;
  const busy = searching || mutating;

  return (
    <div className="absolute inset-0">
      <MultiPinMap
        anchor={anchor}
        pins={mapPins}
        height={height}
        interactive={true}
        activeId={activeId}
        onPinClick={handlePinClick}
      />
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
        <div className="pointer-events-auto flex max-w-full flex-col gap-2 rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-3 shadow-[var(--elevation-surface-md)]">
          {error && <Banner type="danger" message={error} />}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSearch}
              disabled={busy}
            >
              {searching ? (
                <Loader2
                  size={14}
                  aria-hidden="true"
                  className="animate-spin"
                />
              ) : (
                <Search size={14} aria-hidden="true" />
              )}
              {suggestions === null
                ? "Buscar parkings cercanos"
                : "Buscar de nuevo"}
            </Button>
            {selectedCount > 0 && (
              <>
                <span className="text-[12px] text-[var(--color-text-secondary)]">
                  {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}
                </span>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleBulkConfirm("free")}
                  disabled={mutating}
                >
                  Añadir como gratuitos
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleBulkConfirm("paid")}
                  disabled={mutating}
                >
                  Añadir como de pago
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProviderPlaceIds(new Set())}
                  disabled={mutating}
                >
                  Limpiar
                </Button>
              </>
            )}
          </div>
          {suggestions !== null && suggestions.length === 0 && (
            <p className="text-[12px] text-[var(--color-text-subtle)]">
              Sin resultados cercanos.
            </p>
          )}
          {selectedSuggestions.length > 0 && (
            <ul className="flex max-w-[760px] flex-wrap gap-1.5">
              {selectedSuggestions.map((s) => (
                <li
                  key={s.providerPlaceId}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-background-subtle)] px-2 py-0.5 text-[12px] text-[var(--color-text-primary)]"
                >
                  <span className="max-w-[180px] truncate">{s.name}</span>
                  <button
                    type="button"
                    aria-label={`Quitar ${s.name} de la selección`}
                    onClick={() => handleDeselect(s.providerPlaceId)}
                    disabled={mutating}
                    className="grid h-4 w-4 place-items-center rounded-full text-[var(--color-text-subtle)] hover:bg-[var(--color-background-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {suggestions !== null && suggestions.length > 0 && selectedCount === 0 && (
            <p className="text-[12px] text-[var(--color-text-subtle)]">
              Toca un pin amarillo para seleccionarlo, luego añádelos como
              gratuitos o de pago.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
