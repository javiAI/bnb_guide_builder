import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  amenityTaxonomy,
  getAmenityGroups,
  getAmenityGroupItems,
} from "@/lib/taxonomy-loader";
import { AmenitySelectorForm } from "./amenity-selector-form";

export default async function AmenitiesPage({
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

  const existingAmenities = await prisma.propertyAmenity.findMany({
    where: { propertyId },
    select: { id: true, amenityKey: true },
  });

  const enabledKeys = new Set(existingAmenities.map((a) => a.amenityKey));

  // Build groups with items for the selector
  const groups = getAmenityGroups(amenityTaxonomy).map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    items: getAmenityGroupItems(amenityTaxonomy, group.id).map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      recommended: item.recommended ?? false,
      enabled: enabledKeys.has(item.id),
    })),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Equipamiento
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Selecciona los amenities disponibles en tu propiedad.
      </p>

      <div className="mt-8">
        <AmenitySelectorForm
          propertyId={propertyId}
          groups={groups}
        />
      </div>
    </div>
  );
}
