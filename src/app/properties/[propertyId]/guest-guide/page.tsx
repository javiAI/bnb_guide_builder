import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { GuidePreview } from "@/components/guide-preview";
import { ModuleContainer } from "@/components/layout/module-container";

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
    <ModuleContainer
      eyebrow="Propiedad · Publicación"
      title="Guía del huésped"
      description={
        <>
          Previsualización en vivo de la guía. Para publicar, ve a{" "}
          <Link
            href={`/properties/${propertyId}/publishing`}
            className="font-medium text-[var(--color-text-link)] hover:underline"
          >
            Publicación
          </Link>
          .
        </>
      }
      chips={
        publishedVersion ? (
          <Badge
            label={`v${publishedVersion.version} publicada${publishedVersion.publishedAt ? ` — ${publishedVersion.publishedAt.toLocaleDateString("es-ES")}` : ""}`}
            tone="success"
          />
        ) : (
          <Badge label="Sin versión publicada" tone="neutral" />
        )
      }
    >
      <GuidePreview propertyId={propertyId} />
    </ModuleContainer>
  );
}
