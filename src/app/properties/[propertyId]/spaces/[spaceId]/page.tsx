import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { spaceTypes, findItem } from "@/lib/taxonomy-loader";
import { SpaceDetailForm } from "./space-detail-form";

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string; spaceId: string }>;
}) {
  const { propertyId, spaceId } = await params;

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
  });

  if (!space || space.propertyId !== propertyId) notFound();

  const typeInfo = findItem(spaceTypes, space.spaceType);

  return (
    <div>
      <Link
        href={`/properties/${propertyId}/spaces`}
        className="text-sm text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)]"
      >
        &larr; Volver a espacios
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {space.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
          {typeInfo?.label ?? space.spaceType}
        </p>
      </div>

      <div className="mt-8">
        <SpaceDetailForm
          propertyId={propertyId}
          space={{
            id: space.id,
            name: space.name,
            guestNotes: space.guestNotes ?? "",
            aiNotes: space.aiNotes ?? "",
            internalNotes: space.internalNotes ?? "",
            visibility: space.visibility,
          }}
        />
      </div>
    </div>
  );
}
