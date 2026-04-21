import {
  PoiProviderConfigError,
  type LocalPoiProvider,
} from "./provider";
import { MapTilerPlacesProvider } from "./maptiler-provider";
import { MockPlacesProvider } from "./mock-provider";

// ── Factory ──
//
// Provider selection is env-driven via `LOCAL_POI_PROVIDER` (default
// `maptiler`). In `NODE_ENV !== "production"` any missing upstream config
// (e.g. `MAPTILER_API_KEY`) falls back to `mock` — so the dev stack is
// always usable without credentials. In production the factory throws
// `PoiProviderConfigError` so a misconfigured deploy fails at request time
// with a clear error, not with a silent mock.

let cachedProvider: LocalPoiProvider | null = null;
let cachedFingerprint: string | null = null;

/** Resolve the active POI provider. Cached per-fingerprint so tests that
 * mutate env between calls get a fresh resolve, but the common case (prod,
 * long-lived process) hits the cache. Tests inject via
 * `__setLocalPoiProviderForTests`, which pins the fingerprint to `"__test__"`
 * and short-circuits the env check. */
export function resolveLocalPoiProvider(): LocalPoiProvider {
  if (cachedProvider && cachedFingerprint === "__test__") {
    return cachedProvider;
  }
  const fingerprint = `${process.env.NODE_ENV ?? ""}|${
    process.env.LOCAL_POI_PROVIDER ?? ""
  }|${process.env.MAPTILER_API_KEY ? "key" : "no-key"}`;
  if (cachedProvider && cachedFingerprint === fingerprint) {
    return cachedProvider;
  }

  const envChoice = (process.env.LOCAL_POI_PROVIDER ?? "maptiler")
    .trim()
    .toLowerCase();
  const isProd = process.env.NODE_ENV === "production";

  if (envChoice === "mock") {
    cachedProvider = new MockPlacesProvider();
  } else if (envChoice === "maptiler") {
    const apiKey = process.env.MAPTILER_API_KEY?.trim();
    if (!apiKey) {
      if (isProd) {
        throw new PoiProviderConfigError(
          "LOCAL_POI_PROVIDER=maptiler requires MAPTILER_API_KEY",
        );
      }
      console.warn(
        "[places] MAPTILER_API_KEY not set — using mock provider (dev/test only).",
      );
      cachedProvider = new MockPlacesProvider();
    } else {
      cachedProvider = new MapTilerPlacesProvider(apiKey);
    }
  } else {
    throw new PoiProviderConfigError(
      `Unknown LOCAL_POI_PROVIDER value: "${envChoice}"`,
    );
  }

  cachedFingerprint = fingerprint;
  return cachedProvider;
}

/** Test hook: inject a provider (any shape conforming to `LocalPoiProvider`)
 * for the duration of a test. Pass `null` to reset cache. */
export function __setLocalPoiProviderForTests(
  override: LocalPoiProvider | null,
): void {
  cachedProvider = override;
  cachedFingerprint = override ? "__test__" : null;
}

/** Drop cached provider so env changes take effect on the next resolve.
 * Useful in tests that mutate `process.env.LOCAL_POI_PROVIDER`. */
export function __resetLocalPoiProviderCache(): void {
  cachedProvider = null;
  cachedFingerprint = null;
}

export type { LocalPoiProvider, PoiSuggestion, SearchParams, ProviderMetadata } from "./provider";
export {
  PoiProviderConfigError,
  PoiProviderUnavailableError,
  PoiSuggestionSchema,
  ProviderMetadataSchema,
} from "./provider";
export { MockPlacesProvider } from "./mock-provider";
export { haversineMeters, formatDistance } from "./distance";
