/**
 * Static, slug-independent assets the public guide depends on across all
 * properties (rama 10I). Hand-curated on purpose — Next's build output is
 * not stable to parse from a script, and this list is small and changes
 * rarely. The invariant test (`guide-sw-precache-manifest.test.ts`)
 * fs-checks each entry on disk so a removed/renamed icon fails CI before
 * shipping a manifest that references a 404.
 *
 * Both the manifest endpoint (theme/install icons) and the SW
 * (cache-first runtime caching) consume these paths. Adding a new static
 * asset that the PWA depends on means: drop the file under `public/`,
 * append its public path here, ship the test green.
 */

export const GUIDE_PWA_ICON_PATHS = [
  "/icons/guide-192.png",
  "/icons/guide-512.png",
  "/icons/guide-512-maskable.png",
] as const;

export const GUIDE_PWA_STATIC_ASSETS: ReadonlyArray<string> = [
  ...GUIDE_PWA_ICON_PATHS,
];
