import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SpaceCard } from "./space-card";
import { CreateSpaceForm } from "./create-space-form";
import { spaceTypes, getAvailableSpaceTypes, getSpaceTypeLabel } from "@/lib/taxonomy-loader";

export default async function SpacesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, maxGuests: true, roomType: true, layoutKey: true },
  });

  if (!property) notFound();

  const spaces = await prisma.space.findMany({
    where: { propertyId },
    orderBy: { sortOrder: "asc" },
    include: { beds: { orderBy: { createdAt: "asc" } } },
  });

  // Compute available space types from roomType + layoutKey
  // Treat missing roomType as unknown — don't apply entire-place rules to legacy/incomplete properties
  const roomType = property.roomType ?? "";
  const layoutKey = property.layoutKey ?? null;
  const { required, recommended, optional, excluded } = getAvailableSpaceTypes(roomType, layoutKey);

  const allAvailable = [...required, ...recommended, ...optional];
  const existingTypes = new Set(spaces.map((s) => s.spaceType));

  // Spaces that conflict with current layout (in excluded list)
  const conflictingSpaces = spaces.filter((s) => excluded.includes(s.spaceType));

  // Required types not yet added
  const missingRequired = required.filter((id) => !existingTypes.has(id));

  // Build filtered space type options for the create form
  const availableTypeOptions = spaceTypes.items
    .filter((st) => allAvailable.includes(st.id) || allAvailable.length === 0)
    .map((st) => ({ id: st.id, label: st.label, recommended: recommended.includes(st.id) }));

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

      {/* Layout conflicts warning */}
      {conflictingSpaces.length > 0 && (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-warning-700)]">Conflicto de distribución</p>
          <p className="mt-1 text-xs text-[var(--color-warning-600)]">
            Los siguientes espacios no son compatibles con la distribución actual y deberían eliminarse:
            {" "}<span className="font-medium">{conflictingSpaces.map((s) => s.name || getSpaceTypeLabel(s.spaceType)).join(", ")}</span>
          </p>
        </div>
      )}

      {/* Missing required spaces hint */}
      {missingRequired.length > 0 && spaces.length > 0 && (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-4 py-3">
          <p className="text-xs text-[var(--color-primary-700)]">
            Espacios obligatorios para este tipo de alojamiento aún no añadidos:
            {" "}<span className="font-medium">{missingRequired.map((id) => getSpaceTypeLabel(id)).join(", ")}</span>
          </p>
        </div>
      )}

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
              maxGuests={property.maxGuests}
              space={{
                id: space.id,
                spaceType: space.spaceType,
                name: space.name,
                guestNotes: space.guestNotes,
                internalNotes: space.internalNotes,
                featuresJson: space.featuresJson as Record<string, unknown> | null,
              }}
              beds={space.beds.map((b) => ({
                id: b.id,
                bedType: b.bedType,
                quantity: b.quantity,
                configJson: b.configJson as Record<string, unknown> | null,
              }))}
            />
          ))
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Añadir espacio</h2>
        <CreateSpaceForm propertyId={propertyId} availableTypeOptions={availableTypeOptions} />
      </div>
    </div>
  );
}
