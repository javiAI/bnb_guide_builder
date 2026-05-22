"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  deleteParkingPlaceAction,
  updateParkingPlaceAction,
} from "@/lib/actions/parking.actions";
import { updateArrivalOptionAction } from "@/lib/actions/arrival.actions";
import type { ParkingSuggestion } from "@/lib/services/parking-discovery.service";
import type { ParkingPlace, PropertyCoords } from "../access-form";
import { useParkingDiscovery } from "./use-parking-discovery";
import { feeTypeToPinKind, type MultiPinSpec } from "./multi-pin-map";
import {
  pinIdForArrival,
  pinIdForPlace,
  pinIdForSuggestion,
} from "./pin-ids";

export type FeeType = "free" | "paid" | null;
export type BinaryFee = NonNullable<FeeType>;

interface UseParkingManagementInput {
  /** When `null`, the hook still initializes (so non-parking consumers can
   * call it unconditionally) but every action that needs the property scope
   * — manual-add and reverse-geocode — early-returns. Other mutations
   * (rename, fee, relocate, delete) key off placeId and remain operative. */
  propertyId: string | null;
  places: ParkingPlace[];
  propertyCoords: PropertyCoords | null;
  initialSuggestions: ParkingSuggestion[];
  /** Operator-selected discovery radius (meters). Single shared value across
   * all cockpit discovery (parking + arrival modes). */
  radiusMeters: number;
}

/** State + handlers for the cockpit map editor — parking pins (move, delete,
 * rename, fee/recommend) and intercity arrival pins (move only). Shared
 * between the in-section editor and the lightbox side-panel so both surfaces
 * stay in lockstep. Manual placement of new pins lives in the unified "+"
 * picker on the cockpit MultiPinMap (16E.6), not here.
 *
 * Parking and arrival relocate are mutually exclusive: arming one cancels the
 * other so the operator can't get confused about which pin the next map click
 * targets. The map-click dispatcher reads both refs in order and routes to
 * whichever is armed. */
export function useParkingManagement({
  propertyId,
  places,
  propertyCoords,
  initialSuggestions,
  radiusMeters,
}: UseParkingManagementInput) {
  const router = useRouter();
  const [mutating, startMutateTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** When non-null, the next map click moves this confirmed pin instead of
   * setting the new-pin draft. Cleared after a successful relocate or by
   * the operator's explicit cancel. */
  const [relocatingId, setRelocatingId] = useState<string | null>(null);
  /** Ref mirrors `relocatingId` so the map-click handler — bound once when the
   * map mounts and read via a stable ref inside MultiPinMap — always sees the
   * fresh value without depending on closure invalidation. */
  const relocatingIdRef = useRef(relocatingId);
  relocatingIdRef.current = relocatingId;

  /** Arrival relocate is mutex with parking relocate — see hook docstring. */
  const [relocatingArrivalId, setRelocatingArrivalId] = useState<string | null>(
    null,
  );
  const relocatingArrivalIdRef = useRef(relocatingArrivalId);
  relocatingArrivalIdRef.current = relocatingArrivalId;

  const {
    suggestions,
    searchMeta,
    nameOverrides,
    feeOverrides,
    refreshing,
    mutating: discoveryMutating,
    refresh,
    setNameOverride,
    setFeeOverride,
    confirmOne,
  } = useParkingDiscovery({
    propertyId,
    initialSuggestions,
    onError: setActionError,
    radiusMeters,
  });

  const anyMutating = mutating || discoveryMutating;

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
        latitude?: number;
        longitude?: number;
      },
    ) => {
      setActionError(null);
      startMutateTransition(async () => {
        const res = await updateParkingPlaceAction({ placeId, ...patch });
        if (!res.success) {
          setActionError(res.error ?? "No se pudo guardar los cambios");
          return;
        }
        router.refresh();
      });
    },
    [router],
  );

  const handleRelocateRequest = useCallback((placeId: string) => {
    setActionError(null);
    setRelocatingArrivalId(null);
    setRelocatingId((current) => (current === placeId ? null : placeId));
  }, []);

  const handleRelocateCancel = useCallback(() => {
    setRelocatingId(null);
  }, []);

  const handleArrivalRelocateRequest = useCallback((arrivalId: string) => {
    setActionError(null);
    setRelocatingId(null);
    setRelocatingArrivalId((current) =>
      current === arrivalId ? null : arrivalId,
    );
  }, []);

  const handleArrivalRelocateCancel = useCallback(() => {
    setRelocatingArrivalId(null);
  }, []);

  const handleArrivalRelocateCommit = useCallback(
    (arrivalId: string, latitude: number, longitude: number) => {
      setActionError(null);
      setRelocatingArrivalId(null);
      startMutateTransition(async () => {
        const res = await updateArrivalOptionAction({
          placeId: arrivalId,
          latitude,
          longitude,
        });
        if (!res.success) {
          setActionError(res.error ?? "No se pudo mover el pin");
          return;
        }
        router.refresh();
      });
    },
    [router],
  );

  const handleRelocateCommit = useCallback(
    (placeId: string, latitude: number, longitude: number) => {
      setActionError(null);
      setRelocatingId(null);
      startMutateTransition(async () => {
        const res = await updateParkingPlaceAction({
          placeId,
          latitude,
          longitude,
        });
        if (!res.success) {
          setActionError(res.error ?? "No se pudo mover el pin");
          return;
        }
        router.refresh();
      });
    },
    [router],
  );

  const handleMapClick = useCallback(
    (latitude: number, longitude: number) => {
      const armedParkingId = relocatingIdRef.current;
      if (armedParkingId) {
        handleRelocateCommit(armedParkingId, latitude, longitude);
        return;
      }
      const armedArrivalId = relocatingArrivalIdRef.current;
      if (armedArrivalId) {
        handleArrivalRelocateCommit(armedArrivalId, latitude, longitude);
      }
    },
    [handleRelocateCommit, handleArrivalRelocateCommit],
  );

  const mapPins = useMemo<MultiPinSpec[]>(() => {
    const out: MultiPinSpec[] = [];
    for (const p of places) {
      if (p.latitude === null || p.longitude === null) continue;
      out.push({
        id: pinIdForPlace(p.id),
        latitude: p.latitude,
        longitude: p.longitude,
        kind: feeTypeToPinKind(p.feeType),
        label: p.name,
      });
    }
    for (const s of suggestions) {
      out.push({
        id: pinIdForSuggestion(s.providerPlaceId),
        latitude: s.latitude,
        longitude: s.longitude,
        kind: "suggestion-parking",
        label: s.name,
      });
    }
    return out;
  }, [places, suggestions]);

  const hiddenCount = searchMeta
    ? Math.max(0, searchMeta.totalBeforeCap - suggestions.length)
    : 0;

  /** Effective `activeId` for the map: when a pin is armed for relocate, force
   * the highlight onto it so the operator sees which pin they're about to
   * move. Otherwise echo whatever was hovered/focused last. Parking takes
   * precedence over arrival because the mutex above can't both be set. */
  const effectiveActiveId =
    relocatingId !== null
      ? pinIdForPlace(relocatingId)
      : relocatingArrivalId !== null
        ? pinIdForArrival(relocatingArrivalId)
        : activeId;

  const isArmedForRelocate =
    relocatingId !== null || relocatingArrivalId !== null;

  return {
    places,
    propertyCoords,

    // discovery passthrough
    suggestions,
    searchMeta,
    nameOverrides,
    feeOverrides,
    refreshing,
    refresh,
    setNameOverride,
    setFeeOverride,
    confirmOne,
    hiddenCount,

    // state
    actionError,
    setActionError,
    activeId,
    setActiveId,
    relocatingId,
    relocatingArrivalId,
    isArmedForRelocate,
    mapPins,
    anyMutating,
    effectiveActiveId,

    // handlers
    handleDelete,
    handleUpdate,
    handleRelocateRequest,
    handleRelocateCancel,
    handleArrivalRelocateRequest,
    handleArrivalRelocateCancel,
    handleMapClick,
  };
}

export type UseParkingManagementReturn = ReturnType<typeof useParkingManagement>;

// ── ParkingStateProvider — shared state for editor + lightbox ──────────────
// SubsystemCard wraps its render in this provider only for the parking
// cockpit. Both the inline ParkingPlacesEditor (rendered as children) and
// the MediaLightbox (mounted next to the cover carousel) consume the same
// `useParkingManagement` instance via context — so the operator sees their
// activeId / relocatingId persist when they jump between the section editor
// and the full-screen lightbox.

const ParkingStateContext = createContext<UseParkingManagementReturn | null>(null);

export function ParkingStateProvider({
  propertyId,
  places,
  propertyCoords,
  initialSuggestions,
  radiusMeters,
  children,
}: UseParkingManagementInput & { children: ReactNode }) {
  const state = useParkingManagement({
    propertyId,
    places,
    propertyCoords,
    initialSuggestions,
    radiusMeters,
  });
  return (
    <ParkingStateContext.Provider value={state}>
      {children}
    </ParkingStateContext.Provider>
  );
}

export function useParkingStateContext(): UseParkingManagementReturn | null {
  return useContext(ParkingStateContext);
}
