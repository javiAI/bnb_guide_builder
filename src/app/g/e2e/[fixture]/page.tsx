import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { filterByAudience } from "@/lib/services/guide-rendering.service";
import { normalizeGuideForPresentation } from "@/lib/services/guide-presentation.service";
import { buildGuideSearchIndex } from "@/lib/services/guide-search-index.service";
import type { GuideTree } from "@/lib/types/guide-tree";
import { GuideRenderer } from "@/components/public-guide/guide-renderer";
import { getE2EFixture } from "@/test/fixtures/e2e";

// Dev-only route used by the Playwright harness (Rama 10J). Loads an
// in-memory GuideTree fixture and runs it through the same presentation
// pipeline as `/g/[slug]/page.tsx`: filterByAudience → normalizeGuideForPresentation →
// GuideRenderer. No DB, no R2.
//
// Gated by `process.env.E2E === "1"`. Any request without that env returns
// 404, so the route is effectively dead in production even though the code
// ships in the bundle.

interface Props {
  params: Promise<{ fixture: string }>;
}

export const revalidate = false;
// force-dynamic so the env gate is re-checked per request (not cached at build).
export const dynamic = "force-dynamic";

function guardOrNotFound(): void {
  if (process.env.E2E !== "1") notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  guardOrNotFound();
  const { fixture } = await params;
  const entry = getE2EFixture(fixture);
  const title = entry ? `E2E — ${entry.propertyTitle}` : "Guía no disponible";
  return { title, robots: { index: false, follow: false } };
}

export default async function PublicGuideE2EPage({ params }: Props) {
  guardOrNotFound();
  const { fixture } = await params;
  const entry = getE2EFixture(fixture);
  if (!entry) notFound();

  const { tree: rawTree, propertyTitle } = entry;
  const filteredTree: GuideTree = {
    ...rawTree,
    audience: "guest",
    sections: rawTree.sections.map((section) => ({
      ...section,
      emptyCtaDeepLink: null,
      items: filterByAudience(section.items, "guest"),
    })),
  };
  const guestTree = normalizeGuideForPresentation(filteredTree, "guest");
  const searchIndex = buildGuideSearchIndex(guestTree);

  return (
    <GuideRenderer
      tree={guestTree}
      propertyTitle={propertyTitle}
      searchIndex={searchIndex}
    />
  );
}
