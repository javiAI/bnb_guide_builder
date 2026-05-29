import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MediaCarousel, type MediaCarouselSlide } from "@/components/ui/media-carousel";

// Dev-only Playwright fixture for the <MediaCarousel> compact-mode overflow
// behavior. The operator surface (`/properties/[propertyId]/access`) where the
// carousel lives in production requires auth + real DB and is not exercisable
// from the public-guide harness, so this route hosts the primitive in
// isolation at the cockpit 1×4 card width (~245 px at 1280 px viewport).
//
// Route only renders when E2E=1 (same gate as /g/e2e/[fixture]).

interface Props {
  params: Promise<{ count: string }>;
}

export const revalidate = false;
export const dynamic = "force-dynamic";

function guardOrNotFound(): void {
  if (process.env.E2E !== "1") notFound();
}

export async function generateMetadata(): Promise<Metadata> {
  guardOrNotFound();
  return { title: "E2E — MediaCarousel", robots: { index: false, follow: false } };
}

function makeSlides(n: number): MediaCarouselSlide[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e2e-slide-${i}`,
    kind: "image" as const,
    title: `Slide ${i + 1}`,
    alt: `alt ${i + 1}`,
    // Inline 1×1 SVG data URL — no network, no R2 deps. Each slide renders a
    // colored block so the active-slide track translation is visually
    // verifiable in trace artifacts if a test fails.
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="140"><rect width="245" height="140" fill="hsl(${(i * 47) % 360},70%,55%)"/><text x="50%" y="50%" font-size="32" font-family="sans-serif" fill="white" text-anchor="middle" dy=".3em">${i + 1}</text></svg>`,
    )}`,
  }));
}

export default async function CarouselE2EPage({ params }: Props) {
  guardOrNotFound();
  const { count } = await params;
  const n = Number.parseInt(count, 10);
  if (!Number.isFinite(n) || n < 1 || n > 20) notFound();

  return (
    <main className="min-h-screen bg-[var(--color-background-page)] p-8">
      <h1 className="mb-4 text-sm text-[var(--color-text-secondary)]">
        E2E carousel fixture · {n} slide{n === 1 ? "" : "s"}
      </h1>
      {/* 245 px container mirrors the cockpit 1×4 card column width at the
         1280 px breakpoint — the geometry where the dot row would otherwise
         clip with 6+ slides. */}
      <div style={{ width: 245 }} data-carousel-fixture-container>
        <MediaCarousel
          slides={makeSlides(n)}
          propertyId="e2e_property"
          title="Edificio"
          variant="collapsed"
          uploadEntityType="access_method"
          uploadUsageKey="access.building"
        />
      </div>
    </main>
  );
}
