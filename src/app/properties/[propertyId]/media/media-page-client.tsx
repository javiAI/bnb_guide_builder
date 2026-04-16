"use client";

import { EntityGallery } from "@/components/media/entity-gallery";

interface MediaPageClientProps {
  propertyId: string;
}

export function MediaPageClient({ propertyId }: MediaPageClientProps) {
  return (
    <EntityGallery
      propertyId={propertyId}
      entityType="property"
      entityId={propertyId}
      label="Portada y fotos generales"
    />
  );
}
