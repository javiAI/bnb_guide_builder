import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ServiceWorkerRegister } from "@/lib/client/service-worker-register";
import { InstallNudge } from "@/components/public-guide/install-nudge";
import { getBrandPair } from "@/config/brand-palette";
// MapLibre CSS is now imported by the `guide-map.tsx` client island itself,
// so it ships with the lazily-loaded map chunk instead of every guest paint.

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    manifest: `/g/${slug}/manifest.webmanifest`,
  };
}

export default async function PublicGuideLayout({ params, children }: Props) {
  const { slug } = await params;

  const published = await prisma.guideVersion.findFirst({
    where: { property: { publicSlug: slug }, status: "published" },
    select: { version: true, property: { select: { brandPaletteKey: true } } },
  });

  const brandPair = published
    ? getBrandPair(published.property.brandPaletteKey)
    : null;

  return (
    <>
      {children}
      {published && <ServiceWorkerRegister slug={slug} />}
      {published && (
        <InstallNudge
          slug={slug}
          brandLight={brandPair?.light}
          brandDark={brandPair?.dark}
        />
      )}
    </>
  );
}
