import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ArrivalForm } from "./arrival-form";

export default async function ArrivalPage({
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
        Llegada y acceso
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Horarios de check-in, check-out, método de acceso y contactos.
      </p>

      <div className="mt-8">
        <ArrivalForm
          propertyId={propertyId}
          defaultValues={{
            checkInStart: property.checkInStart ?? "16:00",
            checkInEnd: property.checkInEnd ?? "22:00",
            checkOutTime: property.checkOutTime ?? "11:00",
            primaryAccessMethod: property.primaryAccessMethod ?? "",
            hostContactPhone: property.hostContactPhone ?? "",
            supportContact: property.supportContact ?? "",
          }}
        />
      </div>
    </div>
  );
}
