import { getBrandPair } from "@/config/brand-palette";
import { GUIDE_PWA_ICON_PATHS } from "@/lib/client/sw-precache-manifest";

const SHORT_NAME_MAX = 12;

const ICON_DEFINITIONS: ReadonlyArray<{
  src: (typeof GUIDE_PWA_ICON_PATHS)[number];
  sizes: string;
  purpose?: "maskable";
}> = [
  { src: "/icons/guide-192.png", sizes: "192x192" },
  { src: "/icons/guide-512.png", sizes: "512x512" },
  { src: "/icons/guide-512-maskable.png", sizes: "512x512", purpose: "maskable" },
];

export interface GuidePwaManifestInput {
  slug: string;
  propertyNickname: string;
  brandPaletteKey: string | null;
}

export interface GuidePwaManifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: "standalone";
  orientation: "portrait";
  lang: string;
  background_color: string;
  theme_color: string;
  icons: ReadonlyArray<{
    src: string;
    sizes: string;
    type: string;
    purpose?: "maskable";
  }>;
}

/** Pure builder. Route handlers (`/g/[slug]/manifest.webmanifest`,
 * `/g/e2e/[fixture]/manifest.webmanifest`) wrap a data lookup around this
 * function. Pure so tests can exercise palette resolution and short-name
 * truncation without spinning up a route handler or Prisma. */
export function buildGuidePwaManifest(
  input: GuidePwaManifestInput,
): GuidePwaManifest {
  const palette = getBrandPair(input.brandPaletteKey);
  const scope = `/g/${input.slug}/`;
  const shortName =
    input.propertyNickname.length > SHORT_NAME_MAX
      ? input.propertyNickname.slice(0, SHORT_NAME_MAX).trimEnd()
      : input.propertyNickname;
  return {
    name: `Guía — ${input.propertyNickname}`,
    short_name: shortName,
    start_url: scope,
    scope,
    display: "standalone",
    orientation: "portrait",
    lang: "es-ES",
    background_color: "#FAFAFA",
    theme_color: palette.light,
    icons: ICON_DEFINITIONS.map((i) => ({
      src: i.src,
      sizes: i.sizes,
      type: "image/png",
      ...(i.purpose ? { purpose: i.purpose } : {}),
    })),
  };
}
