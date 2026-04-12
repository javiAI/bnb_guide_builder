import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SpaceCard } from "./space-card";
import { CreateSpaceForm } from "./create-space-form";

export default async function SpacesPage({
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

  const spaces = await prisma.space.findMany({
    where: { propertyId },
    orderBy: { sortOrder: "asc" },
    include: { beds: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Espacios</h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
            Dormitorios, baños, cocina y más.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {spaces.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Sin espacios definidos
            </h2>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              Añade el primer espacio usando el formulario de abajo.
            </p>
          </div>
        ) : (
          spaces.map((space) => (
            <SpaceCard
              key={space.id}
              propertyId={propertyId}
              space={{
                id: space.id,
                spaceType: space.spaceType,
                name: space.name,
                guestNotes: space.guestNotes,
                aiNotes: space.aiNotes,
                internalNotes: space.internalNotes,
                visibility: space.visibility,
                featuresJson: space.featuresJson as Record<string, unknown> | null,
              }}
              beds={space.beds.map((b) => ({
                id: b.id,
                bedType: b.bedType,
                quantity: b.quantity,
              }))}
            />
          ))
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Añadir espacio</h2>
        <CreateSpaceForm propertyId={propertyId} />
      </div>
    </div>
  );
}
