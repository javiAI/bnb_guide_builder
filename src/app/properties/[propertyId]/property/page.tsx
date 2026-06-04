import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { PropertyForm } from "./property-form";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function PropertyPage({ params }: Props) {
  const { propertyId } = await params;

  const [property, elevatorSystem] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        propertyNickname: true,
        propertyType: true,
        roomType: true,
        propertyEnvironments: true,
        customPropertyTypeLabel: true,
        customPropertyTypeDesc: true,
        customRoomTypeLabel: true,
        customRoomTypeDesc: true,
        customEnvironmentLabels: true,
        country: true,
        city: true,
        region: true,
        postalCode: true,
        streetAddress: true,
        addressExtra: true,
        addressLevel: true,
        timezone: true,
        maxGuests: true,
        maxAdults: true,
        maxChildren: true,
        infantsAllowed: true,
        hasPrivateEntrance: true,
        latitude: true,
        longitude: true,
        infrastructureJson: true,
      },
    }),
    // Elevator existence lives in the `sys.elevator` system (single source);
    // surfaced read-only in Propiedad/Edificio + reconciled by savePropertyAction.
    prisma.propertySystem.findUnique({
      where: { propertyId_systemKey: { propertyId, systemKey: "sys.elevator" } },
      select: { id: true },
    }),
  ]);

  if (!property) redirect("/");

  return (
    <PropertyForm
      propertyId={propertyId}
      property={property}
      hasElevatorSystem={elevatorSystem !== null}
    />
  );
}
