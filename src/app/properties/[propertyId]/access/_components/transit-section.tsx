"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  confirmArrivalOptionsBulkAction,
  deleteArrivalOptionAction,
  discoverArrivalSuggestionsAction,
  updateArrivalOptionAction,
} from "@/lib/actions/arrival.actions";
import type { ArrivalSearchResult } from "@/lib/actions/arrival.actions";
import type {
  ArrivalMode,
  ArrivalSuggestion,
} from "@/lib/services/arrival-discovery.service";
import { Banner } from "@/components/ui/banner";
import {
  ArrivalConfirmedRow,
  ArrivalDraftRow,
  ArrivalSuggestionRow,
} from "./arrival-row";
import {
  useArrivalCockpitOptional,
  type ArrivalOption,
} from "./arrival-modes-editor";
import {
  CockpitEmptyState,
  CockpitListColumn,
  CockpitListContainer,
} from "./cockpit-list-column";
import { SectionShell } from "./section-shell";
import { RadiusInput } from "./radius-input";
import { RefreshIconButton } from "./refresh-icon-button";
import { pinIdForArrival, pinIdForArrivalSuggestion } from "./pin-ids";

// TransitSection — per-mode discovery + confirm + list block. Reused by:
//   • Intercity tabs (airport / train / bus) in `arrival-modes-editor.tsx`.
//   • Last-mile toggles (metro / urban_bus / taxi) in `last-mile-block.tsx`.
// The component knows its mode but not its parent context — pins are shared
// across intercity tabs because both surfaces read the same `arrivalOptions`
// list filtered by `mode`.

interface TransitSectionProps {
  /** `label` is the tab/mode-of-travel label ("Tren", "Avión"). `sectionLabel`
   * is the on-section header label ("Estación de tren", "Aeropuerto") — what
   * the operator is actually managing. */
  meta: {
    key: ArrivalMode;
    label: string;
    sectionLabel: string;
    icon: LucideIcon;
  };
  propertyId: string;
  propertyCoords: { latitude: number; longitude: number } | null;
  options: ArrivalOption[];
  initialSuggestions: ArrivalSuggestion[];
  /** When provided, each confirmed row exposes a Move icon. The next map
   * click on the unified cockpit map commits a relocate via the parking
   * hook's dispatcher (see use-parking-management.tsx). */
  relocatingArrivalId?: string | null;
  onRequestRelocate?: (arrivalId: string) => void;
  /** Per-mode enable state. When false the section body collapses to a
   * one-line hint and the inline toggle (rendered into `headerAction`) is
   * the only affordance. */
  enabled?: boolean;
  /** Optional inline action rendered in the SectionShell header — used by
   * the cockpit to surface the enable/disable toggle next to the title. */
  headerAction?: ReactNode;
  /** Shared activeId for bidirectional hover sync with the unified map.
   * Row IDs come from `pinIdForArrival` / `pinIdForArrivalSuggestion`
   * (see `pin-ids.ts`). */
  activeId?: string | null;
  onSetActiveId?: (id: string | null) => void;
  /** Emitted whenever the post-filter suggestion pool changes, so the parent
   * cockpit can render the active tab's suggestions as pins on the map. */
  onSuggestionsChange?: (
    mode: ArrivalMode,
    suggestions: ArrivalSuggestion[],
  ) => void;
  /** Discovery radius (meters). Single shared value across the cockpit. */
  radiusMeters: number;
  /** Setter for the shared discovery radius. Used by the inline RadiusInput
   * placed next to the refresh button in the Sugeridos column header. When
   * absent (e.g. last-mile blocks that don't expose a radius control), the
   * inline input simply isn't rendered. */
  onChangeRadiusMeters?: (meters: number) => void;
}

export function TransitSection({
  meta,
  propertyId,
  propertyCoords,
  options,
  initialSuggestions,
  relocatingArrivalId,
  onRequestRelocate,
  enabled = true,
  headerAction,
  activeId = null,
  onSetActiveId,
  onSuggestionsChange,
  radiusMeters,
  onChangeRadiusMeters,
}: TransitSectionProps) {
  const [suggestions, setSuggestions] =
    useState<ArrivalSuggestion[]>(initialSuggestions);
  const [warningKey, setWarningKey] = useState<
    ArrivalSearchResult["warningKey"]
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [searchPending, startSearch] = useTransition();
  const [confirmPending, startConfirm] = useTransition();
  const [updatePending, startUpdate] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [nameOverrides, setNameOverrides] = useState<
    ReadonlyMap<string, string>
  >(new Map());

  const cockpit = useArrivalCockpitOptional();
  const draft =
    cockpit?.draftPin?.mode === meta.key ? cockpit.draftPin : null;

  const handleSearch = useCallback(() => {
    if (!propertyCoords) {
      setError("Configura la dirección de la propiedad primero.");
      return;
    }
    setError(null);
    startSearch(async () => {
      const res = await discoverArrivalSuggestionsAction(
        propertyId,
        meta.key,
        "es",
        radiusMeters,
      );
      if (!res.success || !res.data) {
        setError(res.success ? null : (res.error ?? "Error en la búsqueda"));
        setSuggestions([]);
        setWarningKey(null);
        return;
      }
      setSuggestions(res.data.suggestions);
      setWarningKey(res.data.warningKey);
    });
  }, [meta.key, propertyCoords, propertyId, radiusMeters]);

  const confirmedProviderPlaceIds = useMemo(
    () =>
      new Set(
        options
          .map((o) => o.providerPlaceId)
          .filter((id): id is string => id !== null && id !== ""),
      ),
    [options],
  );
  const filteredSuggestions = useMemo(
    () =>
      suggestions.filter(
        (s) => !confirmedProviderPlaceIds.has(s.providerPlaceId),
      ),
    [suggestions, confirmedProviderPlaceIds],
  );

  useEffect(() => {
    onSuggestionsChange?.(meta.key, filteredSuggestions);
  }, [meta.key, filteredSuggestions, onSuggestionsChange]);

  const handleSetSuggestionName = useCallback(
    (providerPlaceId: string, name: string) => {
      setNameOverrides((prev) => {
        const next = new Map(prev);
        const trimmed = name.trim();
        if (trimmed === "") next.delete(providerPlaceId);
        else next.set(providerPlaceId, trimmed);
        return next;
      });
    },
    [],
  );

  const handleConfirmOne = useCallback(
    (s: ArrivalSuggestion) => {
      setError(null);
      setConfirmingId(s.providerPlaceId);
      const overridden = nameOverrides.get(s.providerPlaceId);
      const finalName = overridden && overridden !== "" ? overridden : s.name;
      startConfirm(async () => {
        const res = await confirmArrivalOptionsBulkAction({
          items: [
            {
              propertyId,
              mode: meta.key,
              provider: s.provider,
              providerPlaceId: s.providerPlaceId,
              name: finalName,
              latitude: s.latitude,
              longitude: s.longitude,
              address: s.address ?? null,
              website: s.website ?? null,
              distanceMeters: s.distanceMeters ?? 0,
              providerMetadata: s.providerMetadata,
            },
          ],
        });
        setConfirmingId(null);
        if (!res.success) {
          setError(res.error ?? "Error al confirmar");
          return;
        }
        setSuggestions((prev) =>
          prev.filter((p) => p.providerPlaceId !== s.providerPlaceId),
        );
        setNameOverrides((prev) => {
          if (!prev.has(s.providerPlaceId)) return prev;
          const next = new Map(prev);
          next.delete(s.providerPlaceId);
          return next;
        });
      });
    },
    [meta.key, nameOverrides, propertyId],
  );

  const handleDelete = useCallback((placeId: string) => {
    startUpdate(async () => {
      await deleteArrivalOptionAction({ placeId });
    });
  }, []);

  const handleRenameOption = useCallback((placeId: string, name: string) => {
    startUpdate(async () => {
      await updateArrivalOptionAction({ placeId, name });
    });
  }, []);

  const summary =
    options.length > 0
      ? `${options.length} añadido${options.length === 1 ? "" : "s"}`
      : null;

  return (
    <SectionShell
      icon={meta.icon}
      label={meta.sectionLabel}
      summary={summary}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((v) => !v)}
      action={headerAction}
    >
      {!enabled ? (
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          Activa este modo de llegada para configurarlo.
        </p>
      ) : (
        <>
      {error && (
        <p className="text-[12px] text-[var(--color-status-error-text)]">
          {error}
        </p>
      )}
      {draft && cockpit?.draftError && (
        <Banner
          type="danger"
          message={cockpit.draftError}
          onDismiss={cockpit.clearDraftError}
        />
      )}
      <CockpitListContainer>
        <CockpitListColumn
          label="Añadidos"
          count={options.length + (draft ? 1 : 0)}
        >
          {options.length > 0 || draft ? (
            <ul className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
              {draft && cockpit && (
                <ArrivalDraftRow
                  mode={meta.key}
                  icon={meta.icon}
                  name={draft.name}
                  address={draft.address}
                  distanceMeters={draft.distanceMeters}
                  resolving={draft.resolving}
                  onRename={cockpit.setDraftName}
                  onConfirm={cockpit.confirmDraft}
                  onCancel={cockpit.clearDraft}
                  pending={cockpit.confirmingDraft}
                  disabled={updatePending || confirmPending}
                />
              )}
              {options.map((opt) => {
                const relocating = relocatingArrivalId === opt.id;
                const rowId = pinIdForArrival(opt.id);
                return (
                  <ArrivalConfirmedRow
                    key={opt.id}
                    mode={meta.key}
                    icon={meta.icon}
                    name={opt.name}
                    address={opt.address}
                    distanceMeters={opt.distanceMeters}
                    onRename={(name) => handleRenameOption(opt.id, name)}
                    onDelete={() => handleDelete(opt.id)}
                    onRelocateRequest={() => onRequestRelocate?.(opt.id)}
                    relocating={relocating}
                    onActivate={() => onSetActiveId?.(rowId)}
                    onDeactivate={() => onSetActiveId?.(null)}
                    isActive={activeId === rowId}
                    disabled={updatePending}
                  />
                );
              })}
            </ul>
          ) : (
            <CockpitEmptyState>
              Sin {meta.sectionLabel.toLowerCase()} añadidos. Pulsa el icono
              de refresco o usa el botón + del mapa.
            </CockpitEmptyState>
          )}
        </CockpitListColumn>
        <CockpitListColumn
          label="Sugeridos"
          count={filteredSuggestions.length}
          action={
            <div className="inline-flex items-center gap-1.5">
              {onChangeRadiusMeters && (
                <RadiusInput
                  value={radiusMeters}
                  onChange={onChangeRadiusMeters}
                />
              )}
              <RefreshIconButton
                onClick={handleSearch}
                disabled={searchPending || !propertyCoords}
                loading={searchPending}
                tooltip="Buscar cercanos"
              />
            </div>
          }
        >
          {filteredSuggestions.length > 0 ? (
            <ul className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
              {filteredSuggestions.map((s) => {
                const displayName =
                  nameOverrides.get(s.providerPlaceId) ?? s.name;
                const rowId = pinIdForArrivalSuggestion(s.providerPlaceId);
                return (
                  <ArrivalSuggestionRow
                    key={s.providerPlaceId}
                    mode={meta.key}
                    icon={meta.icon}
                    name={displayName}
                    address={s.address ?? null}
                    website={s.website ?? null}
                    distanceMeters={s.distanceMeters ?? null}
                    onRename={(name) =>
                      handleSetSuggestionName(s.providerPlaceId, name)
                    }
                    onAdd={() => handleConfirmOne(s)}
                    adding={
                      confirmingId === s.providerPlaceId && confirmPending
                    }
                    onActivate={() => onSetActiveId?.(rowId)}
                    onDeactivate={() => onSetActiveId?.(null)}
                    isActive={activeId === rowId}
                    disabled={
                      confirmPending && confirmingId !== s.providerPlaceId
                    }
                  />
                );
              })}
            </ul>
          ) : warningKey === "none" ? (
            <CockpitEmptyState>
              No se han encontrado opciones cercanas. Usa el botón + del
              mapa.
            </CockpitEmptyState>
          ) : warningKey === "few_results" ? (
            <CockpitEmptyState>
              Pocas opciones cercanas. Añade manualmente las que falten.
            </CockpitEmptyState>
          ) : (
            <CockpitEmptyState>
              Pulsa el icono de refresco para buscar opciones cercanas.
            </CockpitEmptyState>
          )}
        </CockpitListColumn>
      </CockpitListContainer>
        </>
      )}
    </SectionShell>
  );
}

