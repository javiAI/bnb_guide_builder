import {
  PoiProviderConfigError,
  PoiProviderUnavailableError,
  resolveLocalPoiProvider,
} from "@/lib/services/places";

// Best-effort reverse-geocode for a coordinate just dropped on the map.
// Used by manual-pin add flows + relocate flows to backfill the address
// column without forcing the operator to type it. Returns `null` on:
//   • provider miss (no close feature)
//   • provider not implementing reverse()
//   • provider config / unavailable errors
//   • abort / timeout
// Unknown errors propagate so the calling action surfaces them — matches
// the inline pattern previously duplicated in updateParkingPlaceAction.

export async function reverseGeocodeAddressForPin(params: {
  latitude: number;
  longitude: number;
  preferCategoryKey?: string;
  language?: "es" | "en";
  timeoutMs?: number;
}): Promise<string | null> {
  const provider = resolveLocalPoiProvider();
  if (typeof provider.reverse !== "function") return null;
  try {
    const hit = await provider.reverse({
      latitude: params.latitude,
      longitude: params.longitude,
      language: params.language ?? "es",
      preferCategoryKey: params.preferCategoryKey,
      signal: AbortSignal.timeout(params.timeoutMs ?? 2000),
    });
    return hit?.address ?? null;
  } catch (err) {
    if (
      err instanceof PoiProviderConfigError ||
      err instanceof PoiProviderUnavailableError
    ) {
      return null;
    }
    const name = (err as { name?: string }).name;
    if (name === "AbortError" || name === "TimeoutError") return null;
    throw err;
  }
}
