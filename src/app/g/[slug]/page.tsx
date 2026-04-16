import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { filterByAudience } from "@/lib/services/guide-rendering.service";
import { renderHtml } from "@/lib/renderers/guide-html";
import type { GuideTree } from "@/lib/types/guide-tree";
import { GuideNotAvailable } from "./not-available";

interface Props {
  params: Promise<{ slug: string }>;
}

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
    select: { treeJson: true },
  });
  if (!published?.treeJson) return { property, tree: null };

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

  const html = renderHtml(tree);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 border-b border-[var(--border)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {property.propertyNickname}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
          Guía del huésped
        </p>
      </header>
      <article
        className="guide-html-output prose max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
