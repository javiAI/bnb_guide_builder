/**
 * Public media proxy variants — `thumb`/`md`/`full` are the three sizes the
 * public guide can request via `/g/:slug/media/:assetId-:hashPrefix/:variant`.
 * Currently all three passthrough to the original binary; a later branch will
 * plug real transformation behind the same interface.
 *
 * `full` always serves the original unchanged, so it's also the fallback when
 * a variant generator is offline.
 */
export const MEDIA_VARIANT_KEYS = ["thumb", "md", "full"] as const;

export type MediaVariantKey = (typeof MEDIA_VARIANT_KEYS)[number];

export const VARIANT_DIMENSIONS: Record<MediaVariantKey, { maxWidthPx: number | null }> = {
  thumb: { maxWidthPx: 256 },
  md: { maxWidthPx: 800 },
  full: { maxWidthPx: null },
};

export function isMediaVariantKey(value: string): value is MediaVariantKey {
  return (MEDIA_VARIANT_KEYS as readonly string[]).includes(value);
}

/** Length of the content-hash prefix embedded in public URLs. */
export const HASH_PREFIX_LENGTH = 8;
