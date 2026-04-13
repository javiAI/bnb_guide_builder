import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { PropertyForm } from "./property-form";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function PropertyPage({ params }: Props) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      propertyNickname: true,
      propertyType: true,
      roomType: true,
      customPropertyTypeLabel: true,
      customPropertyTypeDesc: true,
      customRoomTypeLabel: true,
      customRoomTypeDesc: true,
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
      bedroomsCount: true,
      bathroomsCount: true,
      latitude: true,
      longitude: true,
      infrastructureJson: true,
    },
  });

  if (!property) redirect("/");

  return <PropertyForm propertyId={propertyId} property={property} />;
}
