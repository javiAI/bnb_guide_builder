import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AccessForm } from "./access-form";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function AccessPage({ params }: Props) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      checkInStart: true,
      checkInEnd: true,
      checkOutTime: true,
      isAutonomousCheckin: true,
      hasBuildingAccess: true,
      accessMethodsJson: true,
      customAccessMethodLabel: true,
      customAccessMethodDesc: true,
    },
  });

  if (!property) redirect("/");

  // Parse structured access from JSON
  const accessJson = property.accessMethodsJson as {
    building?: { methods: string[]; customLabel?: string; customDesc?: string };
    unit?: { methods: string[]; customLabel?: string; customDesc?: string };
    parking?: { types: string[] };
    accessibility?: { features: string[] };
  } | null;

  return (
    <AccessForm
      propertyId={propertyId}
      property={{
        checkInStart: property.checkInStart,
        checkInEnd: property.checkInEnd,
        checkOutTime: property.checkOutTime,
        isAutonomousCheckin: property.isAutonomousCheckin,
        hasBuildingAccess: property.hasBuildingAccess,
        buildingAccess: accessJson?.building ?? null,
        unitAccess: accessJson?.unit ?? null,
        parkingTypes: accessJson?.parking?.types ?? [],
        accessibilityFeatures: accessJson?.accessibility?.features ?? [],
      }}
    />
  );
}
