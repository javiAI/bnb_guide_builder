import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { GuidePreview } from "@/components/guide-preview";

export default async function GuestGuidePage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!property) notFound();

  const publishedVersion = await prisma.guideVersion.findFirst({
    where: { propertyId, status: "published" },
    orderBy: { version: "desc" },
    select: { id: true, version: true, publishedAt: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Guía del huésped
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Previsualización en vivo de la guía. Para publicar, ve a{" "}
        <Link
          href={`/properties/${propertyId}/publishing`}
          className="font-medium text-[var(--color-primary-600)] hover:underline"
        >
          Publicación
        </Link>.
      </p>

      {/* Published status */}
      <div className="mt-4">
        {publishedVersion ? (
          <Badge
            label={`v${publishedVersion.version} publicada${publishedVersion.publishedAt ? ` — ${publishedVersion.publishedAt.toLocaleDateString("es-ES")}` : ""}`}
            tone="success"
          />
        ) : (
          <Badge label="Sin versión publicada" tone="neutral" />
        )}
      </div>

      {/* Live preview */}
      <div className="mt-8">
        <GuidePreview propertyId={propertyId} />
      </div>
    </div>
  );
}
