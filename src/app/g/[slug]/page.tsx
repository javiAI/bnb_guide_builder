import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { buildGuestPresentationLayer } from "@/lib/services/guest-presentation-pipeline";
import {
  GUIDE_TREE_SCHEMA_VERSION,
  type GuideTree,
} from "@/lib/types/guide-tree";
import type { GuideSearchIndex } from "@/lib/types/guide-search-hit";
import { GuideRenderer } from "@/components/public-guide/guide-renderer";
import { GuideNotAvailable } from "./not-available";

interface Props {
  params: Promise<{ slug: string }>;
}

// Disable ISR revalidation timer; publish/unpublish/rollback call
// `revalidatePath(/g/${slug})`. A time-based revalidate would mask
// stale-after-publish UX bugs instead of surfacing them.
export const revalidate = false;

// cache() deduplicates across generateMetadata + page within a single render pass
const resolveGuide = cache(async (slug: string): Promise<{
  property: { propertyNickname: string } | null;
  tree: GuideTree | null;
  searchIndex: GuideSearchIndex | null;
}> => {
  const property = await prisma.property.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      propertyNickname: true,
    },
  });
  if (!property) return { property: null, tree: null, searchIndex: null };

  const published = await prisma.guideVersion.findFirst({
    where: { propertyId: property.id, status: "published" },
    orderBy: { version: "desc" },
    select: { treeJson: true, treeSchemaVersion: true },
  });
  if (!published?.treeJson) return { property, tree: null, searchIndex: null };

  // Log once per request when rendering a pre-v3 snapshot. v3 introduced the
  // presentation layer (rama 10F); pre-v3 snapshots may still have raw
  // `value` / `fields` but no `displayValue` / `displayFields`. The
  // normalization call below stamps those fields on-the-fly, so rendering is
  // safe — we just want visibility on which properties need a re-publish to
  // store pre-normalized snapshots. `snapshotPreV3` is the documented log key.
  if (published.treeSchemaVersion < GUIDE_TREE_SCHEMA_VERSION) {
    console.info(
      `[public-guide] snapshotPreV3 slug=${slug} treeSchemaVersion=${published.treeSchemaVersion} (< ${GUIDE_TREE_SCHEMA_VERSION}) — re-publish to adopt new shape.`,
    );
  }

  const { guestTree, searchIndex } = buildGuestPresentationLayer(
    published.treeJson as unknown as GuideTree,
  );

  return { property, tree: guestTree, searchIndex };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { property } = await resolveGuide(slug);
  const title = property
    ? `Guía — ${property.propertyNickname}`
    : "Guía no disponible";
  return {
    title,
    description: property
      ? `Guía del huésped para ${property.propertyNickname}`
      : undefined,
    openGraph: {
      title,
      description: property
        ? `Guía del huésped para ${property.propertyNickname}`
        : undefined,
    },
  };
}

export default async function PublicGuidePage({ params }: Props) {
  const { slug } = await params;
  const { property, tree, searchIndex } = await resolveGuide(slug);

  if (!property || !tree || !searchIndex) {
    return <GuideNotAvailable />;
  }

  return (
    <GuideRenderer
      tree={tree}
      propertyTitle={property.propertyNickname}
      searchIndex={searchIndex}
    />
  );
}
