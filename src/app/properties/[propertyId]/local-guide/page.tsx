import { notFound } from "next/navigation";
import { MapPin, Tags, CheckCheck, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/db";
import { localPlaceCategories } from "@/lib/taxonomy-loader";
import { getLocalEventsForPropertyAdmin } from "@/lib/services/guide-local-data";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderChip, countChipLabel } from "@/components/ui/page-header-chip";
import { NumberedSection } from "@/components/ui/numbered-section";
import { TextLink } from "@/components/ui/text-link";
import { CreateLocalPlaceForm } from "./create-local-place-form";
import { LocalPlacesGrid, type LocalPlaceGroupData } from "./local-places-grid";
import { LocalEventsRadiusForm } from "./local-events-radius-form";
import { SyncEventsButton } from "./sync-events-button";
import { LocalEventsList } from "./local-events-list";
import { resolveLocalPlaceStatus } from "./local-place-progress";
import type { LocalPlaceData, LocalPlaceCategoryOption } from "./local-place-card";

// Arrival-mode categories (lp.arrival_*) are managed from the access cockpit
// "Cómo llegar" card, not the local-guide tab (decision D1: no-duplication).
// Excluding them keeps the catalog focused on guest-browse POI categories.
const BROWSE_CATEGORIES = localPlaceCategories.items.filter(
  (c) => !c.id.startsWith("lp.arrival_"),
);

const CATEGORY_OPTIONS: LocalPlaceCategoryOption[] = BROWSE_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
}));

export default async function LocalGuidePage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, localEventsRadiusKm: true },
  });
  if (!property) notFound();

  const [places, events] = await Promise.all([
    prisma.localPlace.findMany({
      where: {
        propertyId,
        NOT: { categoryKey: { startsWith: "lp.arrival_" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getLocalEventsForPropertyAdmin(propertyId),
  ]);

  const toCardData = (p: (typeof places)[number]): LocalPlaceData => ({
    id: p.id,
    name: p.name,
    categoryKey: p.categoryKey,
    shortNote: p.shortNote,
    guestDescription: p.guestDescription,
    hoursText: p.hoursText,
    linkUrl: p.linkUrl,
    distanceMeters: p.distanceMeters,
    address: p.address,
  });

  // Group by category in taxonomy order (not insertion order).
  const groups: LocalPlaceGroupData[] = BROWSE_CATEGORIES.map((cat) => {
    const catPlaces = places.filter((p) => p.categoryKey === cat.id);
    return {
      categoryKey: cat.id,
      label: cat.label,
      places: catPlaces.map(toCardData),
    };
  }).filter((g) => g.places.length > 0);

  const readyCount = places.filter(
    (p) => resolveLocalPlaceStatus(p) === "complete",
  ).length;
  const coveredCategories = groups.length;
  const publishedCount = events.filter((e) => e.published).length;

  return (
    <>
      <PageHeader
        eyebrow="Propiedad · Guía local"
        title="Guía local"
        description="Tus sitios favoritos cerca de la propiedad, contados con tu voz — pocas recomendaciones personales valen más que una lista larga."
        chips={
          <>
            <PageHeaderChip
              icon={MapPin}
              label={countChipLabel(places.length, "lugar", "lugares")}
            />
            <PageHeaderChip
              icon={Tags}
              label={countChipLabel(coveredCategories, "categoría", "categorías")}
            />
            {places.length > 0 && (
              <PageHeaderChip
                icon={CheckCheck}
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {readyCount}
                    </span>{" "}
                    de {places.length} listos
                  </>
                }
              />
            )}
            {events.length > 0 && (
              <PageHeaderChip
                icon={CalendarDays}
                label={
                  <>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {publishedCount}
                    </span>{" "}
                    de {events.length} eventos publicados
                  </>
                }
              />
            )}
          </>
        }
      />

      <NumberedSection number="01" title="Lugares recomendados">
        <p className="mb-4 text-[12.5px] text-[var(--color-text-muted)]">
          Las opciones de llegada (estaciones, aeropuerto, parking de llegada) se
          gestionan en{" "}
          <TextLink href={`/properties/${propertyId}/access`} size="sm">
            Acceso
          </TextLink>
          .
        </p>
        {groups.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-elevated)] px-8 py-12 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-action-primary-subtle)]">
              <MapPin
                size={20}
                aria-hidden="true"
                className="text-[var(--color-action-primary)]"
              />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Aún no hay lugares recomendados
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--color-text-secondary)]">
              Añade tus sitios favoritos del barrio. Cada lugar tendrá su tarjeta
              con distancia y una nota tuya en la guía del huésped.
            </p>
          </div>
        ) : (
          <LocalPlacesGrid
            propertyId={propertyId}
            groups={groups}
            categoryOptions={CATEGORY_OPTIONS}
          />
        )}
      </NumberedSection>

      <NumberedSection number="02" title="Añadir lugar">
        <CreateLocalPlaceForm propertyId={propertyId} categories={CATEGORY_OPTIONS} />
      </NumberedSection>

      <NumberedSection number="03" title="Eventos automáticos">
        <div className="space-y-3">
          <LocalEventsRadiusForm
            propertyId={propertyId}
            initialRadiusKm={property.localEventsRadiusKm}
          />
          <SyncEventsButton propertyId={propertyId} />
          <LocalEventsList events={events} />
        </div>
      </NumberedSection>
    </>
  );
}
