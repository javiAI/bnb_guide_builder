import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AccessForm } from "./access-form";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function AccessPage({ params }: Props) {
  const { propertyId } = await params;

  const [
    property,
    buildingPhotoCount,
    unitPhotoCount,
    parkingPhotoCount,
    accessibilityPhotoCount,
    legacyAccessPhotoCount,
    propertyMediaCount,
  ] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        publicSlug: true,
        streetAddress: true,
        checkInStart: true,
        checkInEnd: true,
        checkOutTime: true,
        accessMethodsJson: true,
        primaryAccessMethod: true,
      },
    }),
    prisma.mediaAssignment.count({
      where: {
        entityType: "access_method",
        entityId: propertyId,
        usageKey: "access.building",
      },
    }),
    prisma.mediaAssignment.count({
      where: {
        entityType: "access_method",
        entityId: propertyId,
        usageKey: "access.unit",
      },
    }),
    prisma.mediaAssignment.count({
      where: {
        entityType: "access_method",
        entityId: propertyId,
        usageKey: "access.parking",
      },
    }),
    prisma.mediaAssignment.count({
      where: {
        entityType: "access_method",
        entityId: propertyId,
        usageKey: "access.accessibility",
      },
    }),
    prisma.mediaAssignment.count({
      where: {
        entityType: "access_method",
        entityId: propertyId,
        usageKey: null,
      },
    }),
    prisma.mediaAssignment.count({
      where: { entityType: "property", entityId: propertyId },
    }),
  ]);

  if (!property) redirect("/");

  const accessJson = property.accessMethodsJson as {
    building?: {
      methods: string[];
      customLabel?: string | null;
      customDesc?: string | null;
      primary?: string | null;
    };
    unit?: { methods: string[]; customLabel?: string | null; customDesc?: string | null };
    parking?: {
      types: string[];
      customLabel?: string | null;
      customDesc?: string | null;
      primary?: string | null;
    } | null;
    accessibility?: {
      features: string[];
      customLabel?: string | null;
      customDesc?: string | null;
    } | null;
  } | null;

  return (
    <AccessForm
      propertyId={propertyId}
      publicSlug={property.publicSlug}
      streetAddress={property.streetAddress}
      propertyMediaCount={propertyMediaCount}
      buildingPhotoCount={buildingPhotoCount}
      unitPhotoCount={unitPhotoCount}
      parkingPhotoCount={parkingPhotoCount}
      accessibilityPhotoCount={accessibilityPhotoCount}
      legacyAccessPhotoCount={legacyAccessPhotoCount}
      property={{
        checkInStart: property.checkInStart,
        checkInEnd: property.checkInEnd,
        checkOutTime: property.checkOutTime,
        buildingAccess: accessJson?.building ?? null,
        unitAccess: accessJson?.unit ?? null,
        primaryUnitMethod: property.primaryAccessMethod,
        parkingTypes: accessJson?.parking?.types ?? [],
        parkingCustomLabel: accessJson?.parking?.customLabel ?? null,
        parkingCustomDesc: accessJson?.parking?.customDesc ?? null,
        parkingPrimary: accessJson?.parking?.primary ?? null,
        accessibilityFeatures: accessJson?.accessibility?.features ?? [],
        accessibilityCustomLabel: accessJson?.accessibility?.customLabel ?? null,
        accessibilityCustomDesc: accessJson?.accessibility?.customDesc ?? null,
      }}
    />
  );
}
