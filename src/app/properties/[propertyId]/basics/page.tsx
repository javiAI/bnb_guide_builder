import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BasicsForm } from "./basics-form";

export default async function BasicsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Datos básicos
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Identidad, ubicación, capacidad y contactos de la propiedad.
      </p>

      <div className="mt-8">
        <BasicsForm
          propertyId={propertyId}
          defaultValues={{
            propertyNickname: property.propertyNickname,
            propertyType: property.propertyType ?? "",
            roomType: property.roomType ?? "",
            country: property.country ?? "",
            city: property.city ?? "",
            region: property.region ?? "",
            postalCode: property.postalCode ?? "",
            streetAddress: property.streetAddress ?? "",
            addressLevel: property.addressLevel ?? "",
            timezone: property.timezone ?? "Europe/Madrid",
            maxGuests: property.maxGuests ?? 2,
            bedroomsCount: property.bedroomsCount ?? 1,
            bedsCount: property.bedsCount ?? 1,
            bathroomsCount: property.bathroomsCount ?? 1,
          }}
        />
      </div>
    </div>
  );
}
