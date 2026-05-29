"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmParkingPlacesBulkAction,
  refreshParkingSuggestionsAction,
} from "@/lib/actions/parking.actions";
import type {
  ParkingDiscoveryResult,
  ParkingSuggestion,
} from "@/lib/services/parking-discovery.service";

interface UseParkingDiscoveryConfig {
  propertyId: string | null;
  initialSuggestions: ParkingSuggestion[];
  onError: (message: string | null) => void;
  /** Search radius (meters) threaded from the cockpit. The server clamps to
   * `[1, MAX_DISCOVERY_RADIUS_M]`; the hook just forwards. */
  radiusMeters: number;
}

export function useParkingDiscovery({
  propertyId,
  initialSuggestions,
  onError,
  radiusMeters,
}: UseParkingDiscoveryConfig) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<ParkingSuggestion[]>(initialSuggestions);
  const [searchMeta, setSearchMeta] = useState<{
    warningKey: ParkingDiscoveryResult["warningKey"];
    totalBeforeCap: number;
  } | null>(null);
  // Per-row operator overrides keyed by providerPlaceId. Cleared per-row on
  // successful confirm; cleared globally on a refresh.
  const [nameOverrides, setNameOverrides] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [feeOverrides, setFeeOverrides] = useState<Map<string, "free" | "paid">>(
    () => new Map(),
  );
  const [refreshing, startRefreshTransition] = useTransition();
  const [mutating, startMutateTransition] = useTransition();

  const refresh = useCallback(() => {
    if (!propertyId) return;
    onError(null);
    setNameOverrides(new Map());
    setFeeOverrides(new Map());
    startRefreshTransition(async () => {
      const res = await refreshParkingSuggestionsAction(
        propertyId,
        "es",
        radiusMeters,
      );
      if (!res.success || !res.data) {
        onError(res.error ?? "Error desconocido");
        return;
      }
      setSuggestions(res.data.suggestions);
      setSearchMeta({
        warningKey: res.data.warningKey,
        totalBeforeCap: res.data.totalBeforeCap,
      });
      router.refresh();
    });
  }, [propertyId, onError, router, radiusMeters]);

  const setNameOverride = useCallback((providerPlaceId: string, name: string) => {
    setNameOverrides((prev) => {
      const trimmed = name.trim();
      const next = new Map(prev);
      if (trimmed === "") next.delete(providerPlaceId);
      else next.set(providerPlaceId, trimmed);
      return next;
    });
  }, []);

  const setFeeOverride = useCallback(
    (providerPlaceId: string, feeType: "free" | "paid" | null) => {
      setFeeOverrides((prev) => {
        const next = new Map(prev);
        if (feeType === null) next.delete(providerPlaceId);
        else next.set(providerPlaceId, feeType);
        return next;
      });
    },
    [],
  );

  // Confirm a single suggestion directly. Fee is whatever the operator chose
  // (override) or whatever the provider hinted; if neither, `null` persists
  // "unclassified" — the operator can refine later. We never silently default
  // to "free" because that misrepresents what the operator actually saw.
  const confirmOne = useCallback(
    (providerPlaceId: string) => {
      if (!propertyId) return;
      const s = suggestions.find((x) => x.providerPlaceId === providerPlaceId);
      if (!s) return;
      onError(null);
      const nameOverride = nameOverrides.get(providerPlaceId);
      const feeOverride = feeOverrides.get(providerPlaceId);
      const feeType: "free" | "paid" | null =
        feeOverride ?? s.parkingFee ?? null;
      const item = {
        propertyId,
        provider: s.provider,
        providerPlaceId: s.providerPlaceId,
        name: nameOverride ?? s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        address: s.address,
        website: s.website,
        distanceMeters: s.distanceMeters,
        feeType,
        providerMetadata: s.providerMetadata,
      };
      startMutateTransition(async () => {
        const res = await confirmParkingPlacesBulkAction({ items: [item] });
        if (!res.success || !res.data) {
          onError(res.error ?? "No se pudo guardar el pin");
          return;
        }
        const consumed = new Set<string>([
          providerPlaceId,
          ...res.data.skippedProviderPlaceIds,
        ]);
        setSuggestions((prev) =>
          prev.filter((s) => !consumed.has(s.providerPlaceId)),
        );
        setNameOverrides((prev) => {
          const next = new Map(prev);
          for (const id of consumed) next.delete(id);
          return next;
        });
        setFeeOverrides((prev) => {
          const next = new Map(prev);
          for (const id of consumed) next.delete(id);
          return next;
        });
        if (res.data.created.length > 0) router.refresh();
      });
    },
    [propertyId, suggestions, nameOverrides, feeOverrides, onError, router],
  );

  return {
    suggestions,
    searchMeta,
    nameOverrides,
    feeOverrides,
    refreshing,
    mutating,
    refresh,
    setNameOverride,
    setFeeOverride,
    confirmOne,
  };
}
