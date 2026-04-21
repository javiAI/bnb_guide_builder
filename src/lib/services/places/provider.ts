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

export interface LocalPoiProvider {
  /** Stable identifier persisted in `LocalPlace.provider`. Must never change
   * once rows reference it — the `(propertyId, provider, providerPlaceId)`
   * uniqueness contract depends on it. */
  readonly name: string;
  search(params: SearchParams): Promise<PoiSuggestion[]>;
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
