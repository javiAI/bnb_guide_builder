"use client";

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Globe,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconButton } from "@/components/ui/icon-button";
import {
  addManualParkingPlaceAction,
  confirmParkingPlaceAction,
  deleteParkingPlaceAction,
  searchNearbyParkingsAction,
  updateParkingPlaceAction,
} from "@/lib/actions/parking.actions";
import type {
  ParkingDiscoveryResult,
  ParkingSuggestion,
} from "@/lib/services/parking-discovery.service";
import { formatDistance } from "@/lib/services/places/distance";
import type { ParkingPlace, PropertyCoords } from "../access-form";
import { MultiPinMap, type MultiPinSpec } from "./multi-pin-map";

interface ParkingPlacesEditorProps {
  propertyId: string;
  places: ParkingPlace[];
  propertyCoords: PropertyCoords | null;
}

export function ParkingPlacesEditor({
  propertyId,
  places,
  propertyCoords,
}: ParkingPlacesEditorProps) {
  const router = useRouter();
  const [searching, startSearchTransition] = useTransition();
  const [mutating, startMutateTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<ParkingSuggestion[] | null>(null);
  const [searchMeta, setSearchMeta] = useState<{
    warningKey: ParkingDiscoveryResult["warningKey"];
    totalBeforeCap: number;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  const handleSearch = useCallback(() => {
    setActionError(null);
    startSearchTransition(async () => {
      const res = await searchNearbyParkingsAction(propertyId, "es");
      if (!res.success || !res.data) {
        setActionError(res.error ?? "Error desconocido");
        return;
      }
      setSuggestions(res.data.suggestions);
      setSearchMeta({
        warningKey: res.data.warningKey,
        totalBeforeCap: res.data.totalBeforeCap,
      });
    });
  }, [propertyId]);

  const handleConfirm = useCallback(
    (suggestion: ParkingSuggestion) => {
      setActionError(null);
      startMutateTransition(async () => {
        const res = await confirmParkingPlaceAction({
          propertyId,
          provider: suggestion.provider,
          providerPlaceId: suggestion.providerPlaceId,
          name: suggestion.name,
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          address: suggestion.address,
          website: suggestion.website,
          distanceMeters: suggestion.distanceMeters,
          providerMetadata: suggestion.providerMetadata,
        });
        if (!res.success) {
          setActionError(res.error ?? "No se pudo confirmar el pin");
          return;
        }
        setSuggestions((prev) =>
          prev
            ? prev.filter((s) => s.providerPlaceId !== suggestion.providerPlaceId)
            : null,
        );
        router.refresh();
      });
    },
    [propertyId, router],
  );

  const handleDelete = useCallback(
    (placeId: string) => {
      setActionError(null);
      startMutateTransition(async () => {
        const res = await deleteParkingPlaceAction({ placeId });
        if (!res.success) {
          setActionError(res.error ?? "No se pudo eliminar el pin");
          return;
        }
        router.refresh();
      });
    },
    [router],
  );

  const handleUpdate = useCallback(
    (
      placeId: string,
      patch: {
        name?: string;
        shortNote?: string | null;
      },
    ) => {
      setActionError(null);
      startMutateTransition(async () => {
        const res = await updateParkingPlaceAction({ placeId, ...patch });
        if (!res.success) {
          setActionError(res.error ?? "No se pudo guardar los cambios");
          return;
        }
        setEditingId(null);
        router.refresh();
      });
    },
    [router],
  );

  const handleManualAdd = useCallback(
    (input: {
      name: string;
      latitude: number;
      longitude: number;
      address: string | null;
      shortNote: string | null;
    }) => {
      setActionError(null);
      startMutateTransition(async () => {
        const res = await addManualParkingPlaceAction({ propertyId, ...input });
        if (!res.success) {
          setActionError(res.error ?? "No se pudo añadir el pin");
          return;
        }
        setShowManualForm(false);
        router.refresh();
      });
    },
    [propertyId, router],
  );

  const mapPins = useMemo<MultiPinSpec[]>(() => {
    const out: MultiPinSpec[] = [];
    for (const p of places) {
      if (p.latitude === null || p.longitude === null) continue;
      out.push({
        id: `place-${p.id}`,
        latitude: p.latitude,
        longitude: p.longitude,
        kind: "confirmed",
        label: p.name,
      });
    }
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
  }, [places, suggestions]);

  if (!propertyCoords) {
    return (
      <div className="rounded-[12px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-subtle)] px-3 py-3 text-[12px] text-[var(--color-text-secondary)]">
        Para descubrir parkings cercanos, añade primero la dirección de la propiedad
        — el descubrimiento usa esas coordenadas como punto de búsqueda.
      </div>
    );
  }

  const hiddenCount =
    searchMeta && suggestions
      ? Math.max(0, searchMeta.totalBeforeCap - suggestions.length)
      : 0;

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
          Pines de aparcamiento{" "}
          <span className="font-normal text-[var(--color-text-tertiary)]">
            ({places.length})
          </span>
        </h4>
      </header>

      <MultiPinMap
        anchor={propertyCoords}
        pins={mapPins}
        activeId={activeId}
        onPinClick={setActiveId}
        height={280}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSearch}
          disabled={searching || mutating}
        >
          {searching ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <Search size={14} aria-hidden="true" />
          )}
          {suggestions === null ? "Buscar parkings cercanos" : "Buscar de nuevo"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowManualForm((v) => !v)}
          disabled={mutating}
        >
          <Plus size={14} aria-hidden="true" />
          {showManualForm ? "Cancelar pin manual" : "Añadir pin manual"}
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-[8px] border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2 text-[12px] text-[var(--color-status-error-text)]"
        >
          {actionError}
        </div>
      )}

      {searchMeta?.warningKey === "few_results" && (
        <div className="flex items-start gap-2 rounded-[8px] bg-[var(--color-background-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
          <AlertTriangle
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--color-status-warning-icon)]"
          />
          <span>
            Pocos resultados — añade un pin manual si conoces uno que falte.
          </span>
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="text-[12px] text-[var(--color-text-tertiary)]">
          +{hiddenCount} sugerencias adicionales ocultas tras el cap.
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <SuggestionRow
              key={s.providerPlaceId}
              suggestion={s}
              onConfirm={() => handleConfirm(s)}
              onActivate={() => setActiveId(`sug-${s.providerPlaceId}`)}
              onDeactivate={() =>
                setActiveId((id) => (id === `sug-${s.providerPlaceId}` ? null : id))
              }
              disabled={mutating}
            />
          ))}
        </ul>
      )}

      {suggestions !== null && suggestions.length === 0 && places.length === 0 && (
        <p className="text-[12px] text-[var(--color-text-tertiary)]">
          Sin resultados cercanos. Puedes añadir un pin manual.
        </p>
      )}

      {showManualForm && (
        <ManualPinForm
          anchor={propertyCoords}
          onSubmit={handleManualAdd}
          onCancel={() => setShowManualForm(false)}
          disabled={mutating}
        />
      )}

      {places.length > 0 && (
        <ul className="space-y-2">
          {places.map((p) => (
            <PlaceRow
              key={p.id}
              place={p}
              isEditing={editingId === p.id}
              onEdit={() => setEditingId(p.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(patch) => handleUpdate(p.id, patch)}
              onDelete={() => handleDelete(p.id)}
              onActivate={() => setActiveId(`place-${p.id}`)}
              onDeactivate={() =>
                setActiveId((id) => (id === `place-${p.id}` ? null : id))
              }
              disabled={mutating}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SuggestionRow({
  suggestion,
  onConfirm,
  onActivate,
  onDeactivate,
  disabled,
}: {
  suggestion: ParkingSuggestion;
  onConfirm: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  disabled: boolean;
}) {
  const distance =
    suggestion.distanceMeters !== null
      ? formatDistance(suggestion.distanceMeters)
      : null;
  return (
    <li
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className="flex items-start gap-3 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2"
    >
      <span
        aria-hidden="true"
        className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: "var(--color-status-warning-solid)" }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-[var(--color-text-primary)]">
          {suggestion.name}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[var(--color-text-secondary)]">
          {distance && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} aria-hidden="true" />
              {distance}
            </span>
          )}
          {suggestion.address && <span>{suggestion.address}</span>}
          {suggestion.website && (
            <a
              href={suggestion.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--color-text-link)] hover:underline"
            >
              <Globe size={11} aria-hidden="true" />
              Web
            </a>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={onConfirm}
        disabled={disabled}
      >
        <Check size={14} aria-hidden="true" />
        Confirmar
      </Button>
    </li>
  );
}

interface PlaceRowProps {
  place: ParkingPlace;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: { name?: string; shortNote?: string | null }) => void;
  onDelete: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  disabled: boolean;
}

function PlaceRow({
  place,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onActivate,
  onDeactivate,
  disabled,
}: PlaceRowProps) {
  const [name, setName] = useState(place.name);
  const [shortNote, setShortNote] = useState(place.shortNote ?? "");

  const distance =
    place.distanceMeters !== null ? formatDistance(place.distanceMeters) : null;

  if (isEditing) {
    return (
      <li className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-3">
        <div className="space-y-2">
          <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
            Nombre
            <Input
              size="sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
            Nota corta (opcional)
            <Textarea
              value={shortNote}
              onChange={(e) => setShortNote(e.target.value)}
              rows={2}
              className="mt-1 text-[13px]"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() =>
                onSave({
                  name: name.trim(),
                  shortNote: shortNote.trim() === "" ? null : shortNote.trim(),
                })
              }
              disabled={disabled || name.trim() === ""}
            >
              Guardar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              disabled={disabled}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className="flex items-start gap-3 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-2"
    >
      <span
        aria-hidden="true"
        className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: "var(--color-status-success-solid)" }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-[var(--color-text-primary)]">
          {place.name}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[var(--color-text-secondary)]">
          {distance && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} aria-hidden="true" />
              {distance}
            </span>
          )}
          {place.address && <span>{place.address}</span>}
          {place.shortNote && <span>· {place.shortNote}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          icon={Pencil}
          size="sm"
          onClick={onEdit}
          aria-label={`Editar ${place.name}`}
          disabled={disabled}
        />
        <IconButton
          icon={Trash2}
          size="sm"
          onClick={onDelete}
          aria-label={`Eliminar ${place.name}`}
          disabled={disabled}
        />
      </div>
    </li>
  );
}

function ManualPinForm({
  anchor,
  onSubmit,
  onCancel,
  disabled,
}: {
  anchor: PropertyCoords;
  onSubmit: (input: {
    name: string;
    latitude: number;
    longitude: number;
    address: string | null;
    shortNote: string | null;
  }) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState(anchor.latitude.toFixed(6));
  const [lng, setLng] = useState(anchor.longitude.toFixed(6));
  const [address, setAddress] = useState("");
  const [shortNote, setShortNote] = useState("");

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const valid =
    name.trim() !== "" &&
    Number.isFinite(latNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    Number.isFinite(lngNum) &&
    lngNum >= -180 &&
    lngNum <= 180;

  return (
    <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h5 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
          Nuevo pin manual
        </h5>
        <IconButton
          icon={X}
          size="sm"
          onClick={onCancel}
          aria-label="Cancelar"
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
          Nombre *
          <Input
            size="sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
            placeholder="p. ej. Parking Plaza Mayor"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
            Latitud *
            <Input
              size="sm"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="mt-1"
              inputMode="decimal"
            />
          </label>
          <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
            Longitud *
            <Input
              size="sm"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="mt-1"
              inputMode="decimal"
            />
          </label>
        </div>
        <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
          Dirección (opcional)
          <Input
            size="sm"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
          Nota corta (opcional)
          <Textarea
            value={shortNote}
            onChange={(e) => setShortNote(e.target.value)}
            rows={2}
            className="mt-1 text-[13px]"
          />
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!valid || disabled}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                latitude: latNum,
                longitude: lngNum,
                address: address.trim() === "" ? null : address.trim(),
                shortNote: shortNote.trim() === "" ? null : shortNote.trim(),
              })
            }
          >
            Añadir pin
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={disabled}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
