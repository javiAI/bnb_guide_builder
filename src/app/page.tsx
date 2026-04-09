import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { PrimaryCta } from "@/components/ui/primary-cta";
import { STATUS_LABELS, STATUS_TONES, type PropertyStatus } from "@/lib/types";
import { DeletePropertyButton } from "./delete-property-button";

function PropertyCard({ property }: { property: { id: string; propertyNickname: string; status: string; city: string | null; country: string | null; maxGuests: number | null; bedroomsCount: number | null; bathroomsCount: number | null } }) {
  return (
    <div className="relative rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 transition-shadow hover:shadow-md">
      <a href={`/properties/${property.id}`} className="block">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-[var(--foreground)]">
              {property.propertyNickname}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {[property.city, property.country].filter(Boolean).join(", ") ||
                "Sin ubicación"}
            </p>
          </div>
          <Badge
            label={STATUS_LABELS[property.status as PropertyStatus] ?? property.status}
            tone={STATUS_TONES[property.status as PropertyStatus] ?? "neutral"}
          />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-[var(--color-neutral-500)]">
          {property.maxGuests != null && (
            <span>{property.maxGuests} huéspedes</span>
          )}
          {property.bedroomsCount != null && (
            <span>{property.bedroomsCount} dormitorios</span>
          )}
          {property.bathroomsCount != null && (
            <span>{property.bathroomsCount} baños</span>
          )}
        </div>
      </a>
      <div className="absolute bottom-3 right-3">
        <DeletePropertyButton propertyId={property.id} propertyName={property.propertyNickname} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-neutral-300)] px-8 py-16 text-center">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        Sin propiedades todavía
      </h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--color-neutral-500)]">
        Crea tu primera propiedad para generar guías inteligentes, mensajes
        automáticos y mucho más.
      </p>
      <div className="mt-6">
        <PrimaryCta label="Crear propiedad" href="/properties/new/welcome" />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const properties = await prisma.property.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      propertyNickname: true,
      status: true,
      city: true,
      country: true,
      maxGuests: true,
      bedroomsCount: true,
      bathroomsCount: true,
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Propiedades
          </h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
            Gestiona tus alojamientos y sus guías
          </p>
        </div>
        {properties.length > 0 && (
          <PrimaryCta label="Crear propiedad" href="/properties/new/welcome" />
        )}
      </div>

      <div className="mt-8">
        {properties.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
