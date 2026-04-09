import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { spaceTypes, findItem } from "@/lib/taxonomy-loader";
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
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Espacios
          </h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
            Dormitorios, baños, cocina y más.
          </p>
        </div>
      </div>

      <div className="mt-8">
        {spaces.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Sin espacios definidos
            </h2>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              Crea el primer espacio para documentar las zonas de tu propiedad.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {spaces.map((space) => {
              const typeInfo = findItem(spaceTypes, space.spaceType);
              return (
                <Link
                  key={space.id}
                  href={`/properties/${propertyId}/spaces/${space.id}`}
                  className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 transition-shadow hover:shadow-sm"
                >
                  <div>
                    <h3 className="text-sm font-medium text-[var(--foreground)]">
                      {space.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
                      {typeInfo?.label ?? space.spaceType}
                    </p>
                  </div>
                  <Badge
                    label={space.visibility === "public" ? "Público" : space.visibility === "booked_guest" ? "Huésped" : "Interno"}
                    tone={space.visibility === "public" ? "success" : "neutral"}
                  />
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Añadir espacio
          </h2>
          <CreateSpaceForm propertyId={propertyId} />
        </div>
      </div>
    </div>
  );
}
