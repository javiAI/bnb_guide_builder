"use client";

import {
  useCallback,
  useId,
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
import { Banner } from "@/components/ui/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconButton } from "@/components/ui/icon-button";
import {
  addManualParkingPlaceAction,
  confirmParkingPlaceAction,
  confirmParkingPlacesBulkAction,
  deleteParkingPlaceAction,
  reverseGeocodeForParkingAction,
  searchNearbyParkingsAction,
  setParkingMapInCoverAction,
  updateParkingPlaceAction,
} from "@/lib/actions/parking.actions";
import type {
  ParkingDiscoveryResult,
  ParkingSuggestion,
} from "@/lib/services/parking-discovery.service";
import { formatDistance } from "@/lib/services/places/distance";
import type { ParkingPlace, PropertyCoords } from "../access-form";
import { MultiPinMap, type MultiPinSpec } from "./multi-pin-map";

type FeeType = "free" | "paid" | null;

interface ManualFormState {
  name: string;
  lat: string;
  lng: string;
  address: string;
  shortNote: string;
  feeType: FeeType;
}

function emptyManualForm(anchor: PropertyCoords): ManualFormState {
  return {
    name: "",
    lat: anchor.latitude.toFixed(6),
    lng: anchor.longitude.toFixed(6),
    address: "",
    shortNote: "",
    feeType: null,
  };
}

function feeBadgeText(feeType: FeeType): string | null {
  if (feeType === "free") return "Aparcamiento gratuito";
  if (feeType === "paid") return "Aparcamiento de pago";
  return null;
}

interface ParkingPlacesEditorProps {
  propertyId: string;
  places: ParkingPlace[];
  propertyCoords: PropertyCoords | null;
  parkingMapInCover: boolean;
}

export function ParkingPlacesEditor({
  propertyId,
  places,
  propertyCoords,
  parkingMapInCover,
}: ParkingPlacesEditorProps) {
  const router = useRouter();
  const [searching, startSearchTransition] = useTransition();
  const [mutating, startMutateTransition] = useTransition();
  const [coverToggling, startCoverTransition] = useTransition();
  const [reverseLoading, setReverseLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ParkingSuggestion[] | null>(null);
  const [searchMeta, setSearchMeta] = useState<{
    warningKey: ParkingDiscoveryResult["warningKey"];
    totalBeforeCap: number;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<ManualFormState>(() =>
    propertyCoords
      ? emptyManualForm(propertyCoords)
      : { name: "", lat: "", lng: "", address: "", shortNote: "", feeType: null },
  );
  const [selectedProviderPlaceIds, setSelectedProviderPlaceIds] = useState<
    Set<string>
  >(() => new Set());

  const handleSearch = useCallback(() => {
    setActionError(null);
    setSelectedProviderPlaceIds(new Set());
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

  const handleToggleSelected = useCallback((providerPlaceId: string) => {
    setSelectedProviderPlaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(providerPlaceId)) next.delete(providerPlaceId);
      else next.add(providerPlaceId);
      return next;
    });
  }, []);

  const handleBulkConfirm = useCallback(() => {
    if (selectedProviderPlaceIds.size === 0 || !suggestions) return;
    setActionError(null);
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
      const res = await confirmParkingPlacesBulkAction({ items });
      if (!res.success || !res.data) {
        setActionError(res.error ?? "No se pudieron guardar los pines");
        return;
      }
      const consumed = new Set(selectedProviderPlaceIds);
      for (const id of res.data.skippedProviderPlaceIds) consumed.add(id);
      setSuggestions((prev) =>
        prev ? prev.filter((s) => !consumed.has(s.providerPlaceId)) : null,
      );
      setSelectedProviderPlaceIds(new Set());
      router.refresh();
    });
  }, [propertyId, router, selectedProviderPlaceIds, suggestions]);

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
        setSelectedProviderPlaceIds((prev) => {
          if (!prev.has(suggestion.providerPlaceId)) return prev;
          const next = new Set(prev);
          next.delete(suggestion.providerPlaceId);
          return next;
        });
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
        feeType?: FeeType;
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
      feeType: FeeType;
    }) => {
      setActionError(null);
      startMutateTransition(async () => {
        const res = await addManualParkingPlaceAction({ propertyId, ...input });
        if (!res.success) {
          setActionError(res.error ?? "No se pudo añadir el pin");
          return;
        }
        if (propertyCoords) setManualForm(emptyManualForm(propertyCoords));
        router.refresh();
      });
    },
    [propertyId, propertyCoords, router],
  );

  const handleToggleMapInCover = useCallback(
    (enabled: boolean) => {
      setActionError(null);
      startCoverTransition(async () => {
        const res = await setParkingMapInCoverAction({ propertyId, enabled });
        if (!res.success) {
          setActionError(res.error ?? "No se pudo actualizar la portada");
          return;
        }
        router.refresh();
      });
    },
    [propertyId, router],
  );

  const handleToggleManualForm = useCallback(() => {
    setShowManualForm((open) => {
      const next = !open;
      if (next && propertyCoords) setManualForm(emptyManualForm(propertyCoords));
      return next;
    });
  }, [propertyCoords]);

  const handleMapClick = useCallback(
    (latitude: number, longitude: number) => {
      if (!showManualForm) return;
      setManualForm((prev) => ({
        ...prev,
        lat: latitude.toFixed(6),
        lng: longitude.toFixed(6),
      }));
      setReverseLoading(true);
      void reverseGeocodeForParkingAction({
        propertyId,
        latitude,
        longitude,
        language: "es",
      })
        .then((res) => {
          if (res.success && res.data?.match) {
            setManualForm((prev) => {
              const wantsName = prev.name.trim() === "";
              const wantsAddress = prev.address.trim() === "";
              if (!wantsName && !wantsAddress) return prev;
              return {
                ...prev,
                name: wantsName ? res.data!.match!.name : prev.name,
                address: wantsAddress
                  ? res.data!.match!.address ?? prev.address
                  : prev.address,
              };
            });
          }
        })
        .finally(() => setReverseLoading(false));
    },
    [propertyId, showManualForm],
  );

  const previewPin = useMemo<{ latitude: number; longitude: number } | null>(() => {
    if (!showManualForm) return null;
    const latNum = Number(manualForm.lat);
    const lngNum = Number(manualForm.lng);
    if (
      !Number.isFinite(latNum) ||
      !Number.isFinite(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      return null;
    }
    return { latitude: latNum, longitude: lngNum };
  }, [showManualForm, manualForm.lat, manualForm.lng]);

  const mapPins = useMemo<MultiPinSpec[]>(() => {
    const out: MultiPinSpec[] = [];
    for (const p of places) {
      if (p.latitude === null || p.longitude === null) continue;
      const kind: MultiPinSpec["kind"] =
        p.feeType === "free"
          ? "confirmed-free"
          : p.feeType === "paid"
            ? "confirmed-paid"
            : "confirmed-unknown";
      out.push({
        id: `place-${p.id}`,
        latitude: p.latitude,
        longitude: p.longitude,
        kind,
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
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
          Pines de aparcamiento{" "}
          <span className="font-normal text-[var(--color-text-tertiary)]">
            ({places.length})
          </span>
        </h4>
        {places.length > 0 && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={parkingMapInCover}
              onChange={(e) => handleToggleMapInCover(e.target.checked)}
              disabled={coverToggling}
              className="h-4 w-4 cursor-pointer accent-[var(--color-action-primary)]"
            />
            Usar mapa como portada de la tarjeta
          </label>
        )}
      </header>

      <MultiPinMap
        anchor={propertyCoords}
        pins={mapPins}
        activeId={activeId}
        onPinClick={setActiveId}
        onMapClick={showManualForm ? handleMapClick : undefined}
        previewPin={previewPin}
        height={280}
      />

      {showManualForm && (
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          Haz clic en el mapa para colocar el pin — autorrellenará nombre y
          dirección si encontramos un POI cercano.
        </p>
      )}

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
          onClick={handleToggleManualForm}
          disabled={mutating}
        >
          <Plus size={14} aria-hidden="true" />
          {showManualForm ? "Cancelar pin manual" : "Añadir pin manual"}
        </Button>
      </div>

      {actionError && <Banner type="danger" message={actionError} />}

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
        <>
          {selectedProviderPlaceIds.size > 0 && (
            <div className="flex items-center justify-between rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-subtle)] px-3 py-2">
              <span className="text-[12px] text-[var(--color-text-secondary)]">
                {selectedProviderPlaceIds.size} seleccionado
                {selectedProviderPlaceIds.size === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProviderPlaceIds(new Set())}
                  disabled={mutating}
                >
                  Limpiar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleBulkConfirm}
                  disabled={mutating}
                >
                  <Check size={14} aria-hidden="true" />
                  Guardar {selectedProviderPlaceIds.size} seleccionado
                  {selectedProviderPlaceIds.size === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          )}
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <SuggestionRow
                key={s.providerPlaceId}
                suggestion={s}
                selected={selectedProviderPlaceIds.has(s.providerPlaceId)}
                onToggleSelected={() => handleToggleSelected(s.providerPlaceId)}
                onConfirm={() => handleConfirm(s)}
                onActivate={() =>
                  setActiveId((id) =>
                    id === `sug-${s.providerPlaceId}` ? id : `sug-${s.providerPlaceId}`,
                  )
                }
                onDeactivate={() =>
                  setActiveId((id) => (id === `sug-${s.providerPlaceId}` ? null : id))
                }
                disabled={mutating}
              />
            ))}
          </ul>
        </>
      )}

      {suggestions !== null && suggestions.length === 0 && places.length === 0 && (
        <p className="text-[12px] text-[var(--color-text-tertiary)]">
          Sin resultados cercanos. Puedes añadir un pin manual.
        </p>
      )}

      {showManualForm && (
        <ManualPinForm
          form={manualForm}
          onChange={setManualForm}
          onSubmit={handleManualAdd}
          onCancel={() => setShowManualForm(false)}
          disabled={mutating}
          reverseLoading={reverseLoading}
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
              onActivate={() =>
                setActiveId((id) => (id === `place-${p.id}` ? id : `place-${p.id}`))
              }
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
  selected,
  onToggleSelected,
  onConfirm,
  onActivate,
  onDeactivate,
  disabled,
}: {
  suggestion: ParkingSuggestion;
  selected: boolean;
  onToggleSelected: () => void;
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
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelected}
        disabled={disabled}
        aria-label={`Seleccionar ${suggestion.name}`}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-action-primary)]"
      />
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
  onSave: (patch: {
    name?: string;
    shortNote?: string | null;
    feeType?: FeeType;
  }) => void;
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
  const [feeType, setFeeType] = useState<FeeType>(place.feeType);

  const distance =
    place.distanceMeters !== null ? formatDistance(place.distanceMeters) : null;
  const feeLabel = feeBadgeText(place.feeType);

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
          <FeeTypeRadio value={feeType} onChange={setFeeType} disabled={disabled} />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() =>
                onSave({
                  name: name.trim(),
                  shortNote: shortNote.trim() === "" ? null : shortNote.trim(),
                  feeType,
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
            {place.name}
          </span>
          {feeLabel && <FeeBadge feeType={place.feeType} />}
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

function FeeBadge({ feeType }: { feeType: FeeType }) {
  const label = feeBadgeText(feeType);
  if (label === null) return null;
  return <Badge tone={feeType === "free" ? "success" : "warning"} label={label} />;
}

function FeeTypeRadio({
  value,
  onChange,
  disabled,
}: {
  value: FeeType;
  onChange: (next: FeeType) => void;
  disabled: boolean;
}) {
  const groupName = useId();
  const options: Array<{ key: "free" | "paid" | "unset"; label: string }> = [
    { key: "free", label: "Gratuito" },
    { key: "paid", label: "De pago" },
    { key: "unset", label: "Sin especificar" },
  ];
  const current: "free" | "paid" | "unset" = value === null ? "unset" : value;
  return (
    <fieldset className="block">
      <legend className="text-[12px] font-medium text-[var(--color-text-secondary)]">
        Tipo de aparcamiento
      </legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = current === opt.key;
          return (
            <label
              key={opt.key}
              className={
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors " +
                (checked
                  ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary-subtle)] text-[var(--color-text-primary)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]")
              }
            >
              <input
                type="radio"
                name={groupName}
                value={opt.key}
                checked={checked}
                onChange={() =>
                  onChange(opt.key === "unset" ? null : opt.key)
                }
                disabled={disabled}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ManualPinForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  disabled,
  reverseLoading,
}: {
  form: ManualFormState;
  onChange: (next: ManualFormState) => void;
  onSubmit: (input: {
    name: string;
    latitude: number;
    longitude: number;
    address: string | null;
    shortNote: string | null;
    feeType: FeeType;
  }) => void;
  onCancel: () => void;
  disabled: boolean;
  reverseLoading: boolean;
}) {
  const latNum = Number(form.lat);
  const lngNum = Number(form.lng);
  const valid =
    form.name.trim() !== "" &&
    Number.isFinite(latNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    Number.isFinite(lngNum) &&
    lngNum >= -180 &&
    lngNum <= 180;

  const set = (patch: Partial<ManualFormState>) => onChange({ ...form, ...patch });

  return (
    <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h5 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
          Nuevo pin manual{" "}
          {reverseLoading && (
            <Loader2
              size={12}
              aria-hidden="true"
              className="ml-1 inline-block animate-spin text-[var(--color-text-tertiary)]"
            />
          )}
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
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className="mt-1"
            placeholder="p. ej. Parking Plaza Mayor"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
            Latitud *
            <Input
              size="sm"
              value={form.lat}
              onChange={(e) => set({ lat: e.target.value })}
              className="mt-1"
              inputMode="decimal"
            />
          </label>
          <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
            Longitud *
            <Input
              size="sm"
              value={form.lng}
              onChange={(e) => set({ lng: e.target.value })}
              className="mt-1"
              inputMode="decimal"
            />
          </label>
        </div>
        <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
          Dirección (opcional)
          <Input
            size="sm"
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="block text-[12px] font-medium text-[var(--color-text-secondary)]">
          Nota corta (opcional)
          <Textarea
            value={form.shortNote}
            onChange={(e) => set({ shortNote: e.target.value })}
            rows={2}
            className="mt-1 text-[13px]"
          />
        </label>
        <FeeTypeRadio
          value={form.feeType}
          onChange={(feeType) => set({ feeType })}
          disabled={disabled}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!valid || disabled}
            onClick={() =>
              onSubmit({
                name: form.name.trim(),
                latitude: latNum,
                longitude: lngNum,
                address: form.address.trim() === "" ? null : form.address.trim(),
                shortNote:
                  form.shortNote.trim() === "" ? null : form.shortNote.trim(),
                feeType: form.feeType,
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
