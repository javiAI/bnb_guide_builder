import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildGuestPresentationLayer } from "@/lib/services/guest-presentation-pipeline";
import { GuideRenderer } from "@/components/public-guide/guide-renderer";
import { getE2EFixture } from "@/test/fixtures/e2e";

interface Props {
  params: Promise<{ fixture: string }>;
}

export const revalidate = false;
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

  const { guestTree, searchIndex } = buildGuestPresentationLayer(entry.tree);

  return (
    <GuideRenderer
      tree={guestTree}
      propertyTitle={entry.propertyTitle}
      searchIndex={searchIndex}
    />
  );
}
