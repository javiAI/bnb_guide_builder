import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { filterByAudience } from "@/lib/services/guide-rendering.service";
import {
  GUIDE_TREE_SCHEMA_VERSION,
  type GuideTree,
} from "@/lib/types/guide-tree";
import { GuideRenderer } from "@/components/public-guide/guide-renderer";
import { GuideNotAvailable } from "./not-available";

interface Props {
  params: Promise<{ slug: string }>;
}

// Disable ISR revalidation timer; cache invalidation happens via
// `revalidateTag(guideCacheTag(slug))` from `publishGuideVersionAction` /
// `unpublishVersionAction` / `rollbackToVersionAction`. Time-based revalidation
// would mask stale-after-publish UX bugs instead of surfacing them.
export const revalidate = false;

// cache() deduplicates across generateMetadata + page within a single render pass
const resolveGuide = cache(async (slug: string): Promise<{
  property: { propertyNickname: string } | null;
  tree: GuideTree | null;
}> => {
  const property = await prisma.property.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      propertyNickname: true,
    },
  });
  if (!property) return { property: null, tree: null };

  const published = await prisma.guideVersion.findFirst({
    where: { propertyId: property.id, status: "published" },
    orderBy: { version: "desc" },
    select: { treeJson: true, treeSchemaVersion: true },
  });
  if (!published?.treeJson) return { property, tree: null };

  // Log once per request when rendering a pre-v2 snapshot. The React renderer
  // tolerates the older shape (all new fields are optional on `GuideSection`/
  // `GuideItem`), but the log lets us spot properties that haven't been
  // re-published since the 10E schema bump and nudge them before shipping
  // journey-dependent features that *do* require v2.
  if (published.treeSchemaVersion < GUIDE_TREE_SCHEMA_VERSION) {
    console.info(
      `[public-guide] slug=${slug} treeSchemaVersion=${published.treeSchemaVersion} (< ${GUIDE_TREE_SCHEMA_VERSION}) — snapshot outdated, re-publish to adopt new shape.`,
    );
  }

  const fullTree = published.treeJson as unknown as GuideTree;

  // CRITICAL: re-filter to guest audience — stored tree has audience=internal
  const guestSections = fullTree.sections.map((section) => ({
    ...section,
    emptyCtaDeepLink: null, // Never expose host-panel links
    items: filterByAudience(section.items, "guest"),
  }));

  const guestTree: GuideTree = {
    ...fullTree,
    audience: "guest",
    sections: guestSections,
  };

  return { property, tree: guestTree };
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
  const { property, tree } = await resolveGuide(slug);

  if (!property || !tree) {
    return <GuideNotAvailable />;
  }

  return <GuideRenderer tree={tree} propertyTitle={property.propertyNickname} />;
}
