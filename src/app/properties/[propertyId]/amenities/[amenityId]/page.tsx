import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { amenityTaxonomy, findSubtype } from "@/lib/taxonomy-loader";
import { AmenityDetailForm } from "./amenity-detail-form";

export default async function AmenityDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string; amenityId: string }>;
}) {
  const { propertyId, amenityId } = await params;

  // amenityId here is the amenityKey (e.g., am.wifi), not the DB id
  const amenity = await prisma.propertyAmenity.findFirst({
    where: { propertyId, amenityKey: amenityId },
  });

  if (!amenity) notFound();

  // Find taxonomy info
  const taxonomyItem = amenityTaxonomy.items.find(
    (i) => i.id === amenity.amenityKey,
  );

  // Find subtype config
  const subtype = findSubtype(amenity.amenityKey);

  return (
    <div>
      <Link
        href={`/properties/${propertyId}/amenities`}
        className="text-sm text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)]"
      >
        &larr; Volver a equipamiento
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {taxonomyItem?.label ?? amenity.amenityKey}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
          {taxonomyItem?.description ?? ""}
        </p>
      </div>

      <div className="mt-8">
        <AmenityDetailForm
          propertyId={propertyId}
          amenity={{
            id: amenity.id,
            amenityKey: amenity.amenityKey,
            subtypeKey: amenity.subtypeKey ?? "",
            guestInstructions: amenity.guestInstructions ?? "",
            aiInstructions: amenity.aiInstructions ?? "",
            internalNotes: amenity.internalNotes ?? "",
            troubleshootingNotes: amenity.troubleshootingNotes ?? "",
            visibility: amenity.visibility,
          }}
          subtypeFields={subtype?.fields ?? []}
        />
      </div>
    </div>
  );
}
