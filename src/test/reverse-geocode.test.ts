import { afterEach, describe, expect, it } from "vitest";
import {
  __setLocalPoiProviderForTests,
  PoiProviderConfigError,
  PoiProviderUnavailableError,
  type LocalPoiProvider,
  type ReverseGeoResult,
} from "@/lib/services/places";
import { reverseGeocodeAddressForPin } from "@/lib/services/places/reverse-geocode";

/**
 * Failure-path coverage for the shared reverse-geocode helper called by
 * arrival.actions / parking.actions / editor.actions whenever a manual pin
 * or relocate needs an address backfill. The contract is "best-effort":
 *
 *   • known provider failures (config / unavailable / abort / timeout)
 *     → return null so the caller proceeds with a null address
 *   • provider missing reverse() altogether → return null
 *   • provider miss (no nearby feature) → return null
 *   • happy path → return the matched address
 *   • unknown errors → propagate (so the calling action surfaces them)
 *
 * If any of these legs degrade, the calling actions silently drop addresses
 * on manual pins or — worse — propagate noisy errors to the operator UI.
 */

const COORDS = { latitude: 40.4168, longitude: -3.7038 };

function providerThatReturns(
  result: ReverseGeoResult | null,
): LocalPoiProvider {
  return {
    name: "mock",
    search: async () => [],
    reverse: async () => result,
  };
}

function providerThatThrows(err: unknown): LocalPoiProvider {
  return {
    name: "mock",
    search: async () => [],
    reverse: async () => {
      throw err;
    },
  };
}

const providerWithoutReverse: LocalPoiProvider = {
  name: "mock",
  search: async () => [],
};

afterEach(() => {
  __setLocalPoiProviderForTests(null);
});

describe("reverseGeocodeAddressForPin — happy paths", () => {
  it("returns the provider-emitted address on a clean hit", async () => {
    __setLocalPoiProviderForTests(
      providerThatReturns({
        name: "Calle Mayor",
        address: "Calle Mayor 1, Madrid",
        categoryKey: "lp.transport",
        latitude: COORDS.latitude,
        longitude: COORDS.longitude,
      }),
    );
    const result = await reverseGeocodeAddressForPin(COORDS);
    expect(result).toBe("Calle Mayor 1, Madrid");
  });

  it("returns null when provider hits a feature without an address", async () => {
    __setLocalPoiProviderForTests(
      providerThatReturns({
        name: "Unnamed feature",
        address: null,
        categoryKey: "lp.transport",
        latitude: COORDS.latitude,
        longitude: COORDS.longitude,
      }),
    );
    const result = await reverseGeocodeAddressForPin(COORDS);
    expect(result).toBeNull();
  });

  it("returns null when provider has no nearby feature (miss)", async () => {
    __setLocalPoiProviderForTests(providerThatReturns(null));
    const result = await reverseGeocodeAddressForPin(COORDS);
    expect(result).toBeNull();
  });
});

describe("reverseGeocodeAddressForPin — failure paths return null (best-effort)", () => {
  it("returns null when provider does not implement reverse()", async () => {
    __setLocalPoiProviderForTests(providerWithoutReverse);
    const result = await reverseGeocodeAddressForPin(COORDS);
    expect(result).toBeNull();
  });

  it("returns null on PoiProviderConfigError (e.g. missing API key)", async () => {
    __setLocalPoiProviderForTests(
      providerThatThrows(new PoiProviderConfigError("missing API key")),
    );
    const result = await reverseGeocodeAddressForPin(COORDS);
    expect(result).toBeNull();
  });

  it("returns null on PoiProviderUnavailableError (upstream failure)", async () => {
    __setLocalPoiProviderForTests(
      providerThatThrows(new PoiProviderUnavailableError("502", "mock")),
    );
    const result = await reverseGeocodeAddressForPin(COORDS);
    expect(result).toBeNull();
  });

  it("returns null on AbortError (signal aborted)", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    __setLocalPoiProviderForTests(providerThatThrows(abortErr));
    const result = await reverseGeocodeAddressForPin(COORDS);
    expect(result).toBeNull();
  });

  it("returns null on TimeoutError (signal timeout fired)", async () => {
    const timeoutErr = new Error("timed out");
    timeoutErr.name = "TimeoutError";
    __setLocalPoiProviderForTests(providerThatThrows(timeoutErr));
    const result = await reverseGeocodeAddressForPin(COORDS);
    expect(result).toBeNull();
  });
});

describe("reverseGeocodeAddressForPin — unknown errors propagate", () => {
  it("re-throws errors that aren't config / unavailable / abort / timeout", async () => {
    __setLocalPoiProviderForTests(
      providerThatThrows(new Error("unexpected explosion")),
    );
    await expect(reverseGeocodeAddressForPin(COORDS)).rejects.toThrow(
      "unexpected explosion",
    );
  });

  it("re-throws TypeErrors (would indicate a programmer bug, not a provider miss)", async () => {
    __setLocalPoiProviderForTests(providerThatThrows(new TypeError("oops")));
    await expect(reverseGeocodeAddressForPin(COORDS)).rejects.toThrow(
      TypeError,
    );
  });
});

describe("reverseGeocodeAddressForPin — calls the provider with the right args", () => {
  it("forwards preferCategoryKey and language to the provider", async () => {
    const captured: { preferCategoryKey?: string; language?: string } = {};
    __setLocalPoiProviderForTests({
      name: "mock",
      search: async () => [],
      reverse: async ({ preferCategoryKey, language }) => {
        captured.preferCategoryKey = preferCategoryKey;
        captured.language = language;
        return null;
      },
    });

    await reverseGeocodeAddressForPin({
      ...COORDS,
      preferCategoryKey: "lp.arrival_train",
      language: "en",
    });
    expect(captured).toEqual({
      preferCategoryKey: "lp.arrival_train",
      language: "en",
    });
  });

  it("defaults language to 'es' when caller omits it", async () => {
    const captured: { language?: string } = {};
    __setLocalPoiProviderForTests({
      name: "mock",
      search: async () => [],
      reverse: async ({ language }) => {
        captured.language = language;
        return null;
      },
    });
    await reverseGeocodeAddressForPin(COORDS);
    expect(captured.language).toBe("es");
  });
});
