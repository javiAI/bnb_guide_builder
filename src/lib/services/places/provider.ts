import { z } from "zod";
import { isLocalPlaceCategoryKey } from "@/lib/taxonomy-loader";

// ── DTO ──

/** Sanitized, fixed-shape metadata persisted in `LocalPlace.providerMetadata`.
 * Does not carry raw provider payloads — each field is explicitly shaped so a
 * future provider (Google Places) replaces these with its own canonical
 * values without dragging vendor-specific shapes into the rest of the code. */
export const ProviderMetadataSchema = z
  .object({
    /** Provider-native category string (e.g. MapTiler "restaurant"). For
     * debugging only — never consumed by host/guest UI. */
    nativeCategory: z.string().nullable(),
    /** Provider-native type tags (e.g. MapTiler `place_type` or
     * `properties.categories`). Preserved for future re-mapping. */
    placeTypes: z.array(z.string()),
    /** Provider confidence/relevance score in [0,1] when exposed. */
    confidence: z.number().min(0).max(1).nullable(),
    /** ISO-8601 timestamp of the upstream fetch. */
    retrievedAt: z.string().datetime(),
    /** Operator-assigned fee classification for parking pins. Optional —
     * older rows persisted before this field existed parse as `undefined`;
     * `null` means the operator has not yet classified the pin. Persisted on
     * `LocalPlace.providerMetadata` (Json column) instead of a dedicated
     * Prisma column to avoid a migration in scope. */
    feeType: z.enum(["free", "paid"]).nullable().optional(),
  })
  .strict();

export type ProviderMetadata = z.infer<typeof ProviderMetadataSchema>;

/** Canonical POI suggestion returned by every provider implementation. Every
 * field is provider-agnostic. `categoryKey` MUST be a registered `lp.*` key
 * (validated by `findLocalPlaceCategory`) — providers that cannot map a
 * result to a known category drop the result instead of emitting a raw key. */
export const PoiSuggestionSchema = z
  .object({
    provider: z.string().min(1),
    providerPlaceId: z.string().min(1),
    name: z.string().min(1),
    categoryKey: z
      .string()
      .refine(isLocalPlaceCategoryKey, {
        message: "categoryKey must be a registered lp.* key",
      }),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    address: z.string().optional(),
    website: z.string().url().optional(),
    distanceMeters: z.number().int().min(0).optional(),
    /** Provider-emitted fee hint for `lp.parking` results. `null` (or omitted)
     * when the provider cannot determine it (MapTiler today). Google Places
     * Details (`parkingOptions.paidParkingLot`) and OSM Overpass (`fee=yes/no`)
     * can populate this. The operator may still override at confirm time —
     * the canonical persisted value lives in `LocalPlace.providerMetadata.feeType`. */
    parkingFee: z.enum(["free", "paid"]).nullable().optional(),
    providerMetadata: ProviderMetadataSchema,
  })
  .strict();

export type PoiSuggestion = z.infer<typeof PoiSuggestionSchema>;

// ── Provider contract ──

export interface SearchParams {
  query: string;
  anchor: { latitude: number; longitude: number };
  language: "es" | "en";
  limit?: number;
  signal?: AbortSignal;
}

export interface ReverseParams {
  latitude: number;
  longitude: number;
  language: "es" | "en";
  /** When set, prefer the closest feature whose `categoryKey` matches.
   * Falls back to the closest feature regardless of category if no match. */
  preferCategoryKey?: string;
  signal?: AbortSignal;
}

/** Result of a reverse-geocode lookup. Unlike `PoiSuggestion`, `categoryKey`
 * may be `null` because reverse queries return address features (streets,
 * buildings) that don't map to any `lp.*` category — those are still useful
 * for autofilling a manual pin's name/address. */
export interface ReverseGeoResult {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  /** `null` when the closest feature is a street/address with no LP category
   * mapping; populated when the feature mapped to a registered `lp.*` key. */
  categoryKey: string | null;
}

/**
 * Plug-and-play contract for local POI providers.
 *
 * **Adding a new provider** (e.g. Google Places, OSM Overpass):
 *
 * 1. Implement this interface in a new file `<provider>-provider.ts`
 *    (see `maptiler-provider.ts` as reference).
 * 2. Map provider-native category strings to registered `lp.*` keys
 *    (validated by `isLocalPlaceCategoryKey`). Drop results that don't
 *    map — never emit raw provider keys. For parking, populate the
 *    optional `parkingFee` field when the upstream exposes it:
 *      - Google Places Details: `parkingOptions.paidParkingLot` (true → "paid",
 *        false → "free").
 *      - OSM Overpass: tag `fee=yes` → "paid", `fee=no` → "free".
 *      - MapTiler: not exposed today → emit `null` (or omit).
 *    The operator can still override at confirm time; the canonical
 *    persisted value lives in `LocalPlace.providerMetadata.feeType`
 *    (see `mergeFeeTypeIntoMetadata` in `parking.actions.ts`).
 * 3. Add the env value to the factory in `src/lib/services/places/index.ts`
 *    (e.g. `else if (envChoice === "google") { ... }`). Honor the dev/test
 *    fallback to `MockPlacesProvider` when credentials are missing; fail-fast
 *    in production.
 * 4. The `name` field is persisted in `LocalPlace.provider` — pick a stable
 *    string ("google", "osm", etc.) and never change it.
 *
 * **What the rest of the stack assumes** (do not break these):
 * - All emitted `PoiSuggestion`s have a `categoryKey` that passes
 *   `isLocalPlaceCategoryKey()` (validated by Zod at the discovery boundary).
 * - `providerPlaceId` is stable across calls for the same upstream entity.
 *   The `(propertyId, provider, providerPlaceId)` uniqueness on `LocalPlace`
 *   depends on it.
 * - `providerMetadata.retrievedAt` is an ISO-8601 timestamp set at fetch time.
 */
export interface LocalPoiProvider {
  /** Stable identifier persisted in `LocalPlace.provider`. Must never change
   * once rows reference it — the `(propertyId, provider, providerPlaceId)`
   * uniqueness contract depends on it. */
  readonly name: string;
  search(params: SearchParams): Promise<PoiSuggestion[]>;
  /** Optional reverse-geocoding lookup at a coordinate. Providers that don't
   * implement it return `undefined` from this method (consumers must guard);
   * `null` from a returned promise means "no match found, query succeeded". */
  reverse?(params: ReverseParams): Promise<ReverseGeoResult | null>;
}

// ── Errors ──

/** Thrown when factory cannot construct a provider in the current environment
 * (e.g. missing API key in `NODE_ENV=production`). Surface as HTTP 503. */
export class PoiProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PoiProviderConfigError";
  }
}

/** Thrown when the upstream provider call fails (network, non-2xx, parse).
 * Surface as HTTP 502. Callers should not retry automatically. */
export class PoiProviderUnavailableError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
  ) {
    super(message);
    this.name = "PoiProviderUnavailableError";
  }
}
