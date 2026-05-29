"use client";

import { AlertTriangle } from "lucide-react";
import { Banner } from "@/components/ui/banner";
import {
  useParkingStateContext,
  type BinaryFee,
} from "./use-parking-management";
import { useArrivalCockpitOptional } from "./arrival-modes-editor";
import {
  CockpitEmptyState,
  CockpitListColumn,
  CockpitListContainer,
} from "./cockpit-list-column";
import {
  ConfirmedRow,
  DraftParkingRow,
  SuggestionRow,
  cycleFee,
} from "./parking-row";
import { RadiusInput } from "./radius-input";
import { RefreshIconButton } from "./refresh-icon-button";
import { pinIdForPlace, pinIdForSuggestion } from "./pin-ids";

// Lists + columns only. The unified map (with "+" picker, zoom-to-lightbox
// button and relocate overlay) lives one level up in ArrivalCockpitMap so a
// single MultiPinMap shows parking + every transit mode at once.
export function ParkingPlacesEditor({
  searchRadiusMeters,
  onChangeSearchRadiusMeters,
}: {
  searchRadiusMeters: number;
  onChangeSearchRadiusMeters: (meters: number) => void;
}) {
  const parkingState = useParkingStateContext();
  if (!parkingState) {
    throw new Error(
      "ParkingPlacesEditor must be rendered inside ParkingStateProvider (parking SubsystemCard)",
    );
  }
  const {
    places,
    propertyCoords,
    suggestions,
    searchMeta,
    nameOverrides,
    feeOverrides,
    refreshing,
    refresh: handleRefresh,
    setNameOverride: handleSetNameOverride,
    setFeeOverride: handleSetFeeOverride,
    confirmOne: handleConfirmOne,
    hiddenCount,
    actionError,
    setActionError,
    activeId,
    setActiveId,
    relocatingId,
    anyMutating,
    handleDelete,
    handleUpdate,
    handleRelocateRequest,
  } = parkingState;

  const cockpit = useArrivalCockpitOptional();
  const draft =
    cockpit?.draftPin?.mode === "parking" ? cockpit.draftPin : null;

  if (!propertyCoords) {
    return (
      <div className="rounded-[12px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-subtle)] px-3 py-3 text-[12px] text-[var(--color-text-secondary)]">
        Para descubrir parkings cercanos, añade primero la dirección de la propiedad
        — el descubrimiento usa esas coordenadas como punto de búsqueda.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {actionError && (
        <Banner
          type="danger"
          message={actionError}
          onDismiss={() => setActionError(null)}
        />
      )}

      {draft && cockpit?.draftError && (
        <Banner
          type="danger"
          message={cockpit.draftError}
          onDismiss={cockpit.clearDraftError}
        />
      )}

      {searchMeta?.warningKey === "few_results" && (
        <div className="flex items-start gap-2 rounded-[8px] bg-[var(--color-background-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
          <AlertTriangle
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--color-status-warning-icon)]"
          />
          <span>
            Pocos resultados — usa el botón + del mapa para añadir uno que falte.
          </span>
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="text-[12px] text-[var(--color-text-subtle)]">
          +{hiddenCount} sugerencias adicionales ocultas tras el cap.
        </p>
      )}

      <CockpitListContainer>
        <CockpitListColumn
          label="Añadidos"
          count={places.length + (draft ? 1 : 0)}
        >
          {places.length > 0 || draft ? (
            <ul className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
              {draft && cockpit && (
                <DraftParkingRow
                  name={draft.name}
                  address={draft.address}
                  distanceMeters={draft.distanceMeters}
                  fee={draft.feeType}
                  resolving={draft.resolving}
                  onRename={cockpit.setDraftName}
                  onToggleFee={() =>
                    cockpit.setDraftFeeType(cycleFee(draft.feeType))
                  }
                  onConfirm={cockpit.confirmDraft}
                  onCancel={cockpit.clearDraft}
                  pending={cockpit.confirmingDraft}
                  disabled={anyMutating}
                />
              )}
              {places.map((p) => (
                <ConfirmedRow
                  key={p.id}
                  place={p}
                  onRename={(name) => handleUpdate(p.id, { name })}
                  onSetFee={(feeType) => handleUpdate(p.id, { feeType })}
                  onDelete={() => handleDelete(p.id)}
                  onRelocateRequest={() => handleRelocateRequest(p.id)}
                  relocating={relocatingId === p.id}
                  onActivate={() => setActiveId(pinIdForPlace(p.id))}
                  onDeactivate={() =>
                    setActiveId((id) =>
                      id === pinIdForPlace(p.id) ? null : id,
                    )
                  }
                  isActive={activeId === pinIdForPlace(p.id)}
                  disabled={anyMutating}
                />
              ))}
            </ul>
          ) : (
            <CockpitEmptyState>
              Sin pines confirmados. Usa el botón + del mapa para añadir uno manualmente.
            </CockpitEmptyState>
          )}
        </CockpitListColumn>
        <CockpitListColumn
          label="Sugeridos"
          count={suggestions.length}
          action={
            <div className="inline-flex items-center gap-1.5">
              <RadiusInput
                value={searchRadiusMeters}
                onChange={onChangeSearchRadiusMeters}
              />
              <RefreshIconButton
                onClick={handleRefresh}
                disabled={refreshing || anyMutating}
                loading={refreshing}
                tooltip="Buscar cercanos"
              />
            </div>
          }
        >
          {suggestions.length > 0 ? (
            <ul className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
              {suggestions.map((s) => {
                const displayName = nameOverrides.get(s.providerPlaceId) ?? s.name;
                const resolvedFee: BinaryFee | null =
                  feeOverrides.get(s.providerPlaceId) ?? s.parkingFee;
                return (
                  <SuggestionRow
                    key={s.providerPlaceId}
                    name={displayName}
                    address={s.address}
                    website={s.website}
                    distanceMeters={s.distanceMeters}
                    fee={resolvedFee}
                    onRename={(name) =>
                      handleSetNameOverride(s.providerPlaceId, name)
                    }
                    onToggleFee={() =>
                      handleSetFeeOverride(
                        s.providerPlaceId,
                        cycleFee(resolvedFee),
                      )
                    }
                    onAdd={() => handleConfirmOne(s.providerPlaceId)}
                    onActivate={() =>
                      setActiveId(pinIdForSuggestion(s.providerPlaceId))
                    }
                    onDeactivate={() =>
                      setActiveId((id) =>
                        id === pinIdForSuggestion(s.providerPlaceId)
                          ? null
                          : id,
                      )
                    }
                    isActive={
                      activeId === pinIdForSuggestion(s.providerPlaceId)
                    }
                    disabled={anyMutating}
                  />
                );
              })}
            </ul>
          ) : (
            <CockpitEmptyState>
              Sin resultados cercanos. Pulsa Buscar cercanos o usa el botón + del mapa.
            </CockpitEmptyState>
          )}
        </CockpitListColumn>
      </CockpitListContainer>
    </section>
  );
}

