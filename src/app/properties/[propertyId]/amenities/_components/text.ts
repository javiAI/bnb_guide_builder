/**
 * Text helpers shared across the equipamiento module's client components.
 *
 * Both client-side search (`amenity-selector`) and custom-amenity key
 * generation (`custom-amenity-input`) need the same accent-insensitive,
 * lowercase fold; `slugifyLabel` builds the key on top of it so the
 * diacritic-stripping logic lives in exactly one place.
 */

/** Accent-insensitive, lowercase fold for client-side search comparison. */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Slug for a custom amenity key: fold to ASCII-ish lowercase, collapse any run
 * of non-alphanumerics to a single underscore, and trim leading/trailing
 * underscores. Returns "" when nothing usable remains (caller guards on empty).
 */
export function slugifyLabel(value: string): string {
  return fold(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
