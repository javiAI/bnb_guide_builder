import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { buildGuestPresentationLayer } from "@/lib/services/guest-presentation-pipeline";
import {
  buildGuideLocalEventsData,
  buildGuideMapData,
} from "@/lib/services/guide-map.service";
import {
  GUIDE_TREE_SCHEMA_VERSION,
  type GuideTree,
} from "@/lib/types/guide-tree";
import type {
  GuideLocalEventsData,
  GuideMapData,
} from "@/lib/types/guide-map";
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
  mapData: GuideMapData | null;
  eventsData: GuideLocalEventsData;
}> => {
  const property = await prisma.property.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      propertyNickname: true,
      latitude: true,
      longitude: true,
      localEventsRadiusKm: true,
    },
  });
  if (!property)
    return {
      property: null,
      tree: null,
      searchIndex: null,
      mapData: null,
      eventsData: { items: [] },
    };

  const published = await prisma.guideVersion.findFirst({
    where: { propertyId: property.id, status: "published" },
    orderBy: { version: "desc" },
    select: { treeJson: true, treeSchemaVersion: true },
  });
  if (!published?.treeJson)
    return {
      property,
      tree: null,
      searchIndex: null,
      mapData: null,
      eventsData: { items: [] },
    };

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

  // Build map + events data for `gs.local` only when that section is actually
  // present in the tree. The helpers are cheap but each hits the DB, and an
  // older published tree without local content shouldn't pay for queries.
  const hasLocalSection = guestTree.sections.some(
    (s) => s.resolverKey === "local",
  );
  const [mapData, eventsData] = hasLocalSection
    ? await Promise.all([
        buildGuideMapData(property.id, "guest", { property }),
        buildGuideLocalEventsData(property.id, "guest"),
      ])
    : [null, { items: [] } as GuideLocalEventsData];

  return { property, tree: guestTree, searchIndex, mapData, eventsData };
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
  const { property, tree, searchIndex, mapData, eventsData } =
    await resolveGuide(slug);

  if (!property || !tree || !searchIndex) {
    return <GuideNotAvailable />;
  }

  return (
    <GuideRenderer
      tree={tree}
      propertyTitle={property.propertyNickname}
      searchIndex={searchIndex}
      slug={slug}
      mapData={mapData}
      eventsData={eventsData}
    />
  );
}
