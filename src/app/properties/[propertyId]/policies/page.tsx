import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PoliciesForm } from "./policies-form";

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      policiesJson: true,
      maxGuests: true,
      checkInStart: true,
      checkInEnd: true,
      checkOutTime: true,
    },
  });

  if (!property) notFound();

  // Parse stored policies or empty object
  const savedPolicies =
    property.policiesJson && typeof property.policiesJson === "object"
      ? (property.policiesJson as Record<string, string>)
      : {};

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Normas</h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Normas de convivencia, restricciones y suplementos.
      </p>

      <div className="mt-8">
        <PoliciesForm
          propertyId={propertyId}
          savedPolicies={savedPolicies}
          propertyDefaults={{
            maxGuests: property.maxGuests,
            checkInStart: property.checkInStart,
            checkInEnd: property.checkInEnd,
            checkOutTime: property.checkOutTime,
          }}
        />
      </div>
    </div>
  );
}
