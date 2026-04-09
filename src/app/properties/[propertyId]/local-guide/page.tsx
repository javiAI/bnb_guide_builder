import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { CreateLocalPlaceForm } from "./create-local-place-form";
import { LocalPlaceCard } from "./local-place-card";

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurante",
  cafe: "Cafetería",
  bar: "Bar",
  supermarket: "Supermercado",
  pharmacy: "Farmacia",
  hospital: "Hospital",
  transport: "Transporte",
  parking: "Parking",
  attraction: "Atracción",
  beach: "Playa",
  park: "Parque",
  gym: "Gimnasio",
  laundry: "Lavandería",
  other: "Otro",
};

export default async function LocalGuidePage({
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

  const places = await prisma.localPlace.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  });

  // Group by category
  const grouped = new Map<string, typeof places>();
  for (const place of places) {
    const key = place.categoryKey;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(place);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Guía local
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Recomendaciones cercanas para huéspedes.
      </p>

      <div className="mt-8">
        {places.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-12 text-center">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Sin recomendaciones todavía
            </h2>
            <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
              Añade los lugares cercanos que recomiendas a tus huéspedes.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([category, catPlaces]) => (
              <div key={category}>
                <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                  {CATEGORY_LABELS[category] ?? category}
                  <Badge
                    label={String(catPlaces.length)}
                    tone="neutral"
                  />
                </h2>
                <div className="space-y-2">
                  {catPlaces.map((place) => (
                    <LocalPlaceCard
                      key={place.id}
                      propertyId={propertyId}
                      place={{
                        id: place.id,
                        name: place.name,
                        shortNote: place.shortNote,
                        distanceMeters: place.distanceMeters,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Añadir lugar
          </h2>
          <CreateLocalPlaceForm propertyId={propertyId} />
        </div>
      </div>
    </div>
  );
}
