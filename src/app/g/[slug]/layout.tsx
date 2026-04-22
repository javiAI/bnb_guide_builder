import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ServiceWorkerRegister } from "@/lib/client/service-worker-register";
import { InstallNudge } from "@/components/public-guide/install-nudge";
// MapLibre's stylesheet is a node_modules global CSS file consumed by the
// `<GuideMap>` island inside this subtree. Next.js prefers global CSS to be
// imported from a layout/entry rather than a client component so the style
// is loaded once for the whole subtree; this keeps the map island free of
// side-effect CSS imports.
import "maplibre-gl/dist/maplibre-gl.css";

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
    select: { version: true },
  });

  return (
    <>
      {children}
      {published && <ServiceWorkerRegister slug={slug} />}
      {published && <InstallNudge slug={slug} />}
    </>
  );
}
