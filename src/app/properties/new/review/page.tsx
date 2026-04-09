import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { findItem, propertyTypes, roomTypes, accessMethods } from "@/lib/taxonomy-loader";
import { ReviewActions } from "./review-actions";

interface Props {
  searchParams: Promise<{ propertyId?: string }>;
}

export default async function WizardReviewPage({ searchParams }: Props) {
  const { propertyId } = await searchParams;
  if (!propertyId) redirect("/properties/new/welcome");

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) redirect("/properties/new/welcome");

  const pt = property.propertyType ? findItem(propertyTypes, property.propertyType) : null;
  const rt = property.roomType ? findItem(roomTypes, property.roomType) : null;
  const am = property.primaryAccessMethod ? findItem(accessMethods, property.primaryAccessMethod) : null;

  const sections = [
    {
      title: "Tipo de alojamiento",
      items: [
        { label: "Tipo", value: pt?.label ?? "—" },
        { label: "Espacio", value: rt?.label ?? "—" },
      ],
      complete: !!property.propertyType && !!property.roomType,
      editHref: `/properties/new/step-1?propertyId=${propertyId}`,
    },
    {
      title: "Ubicación",
      items: [
        { label: "País", value: property.country ?? "—" },
        { label: "Ciudad", value: property.city ?? "—" },
        { label: "Zona horaria", value: property.timezone ?? "—" },
        ...(property.streetAddress ? [{ label: "Dirección", value: property.streetAddress }] : []),
      ],
      complete: !!property.country && !!property.city && !!property.timezone,
      editHref: `/properties/new/step-2?propertyId=${propertyId}`,
    },
    {
      title: "Capacidad",
      items: [
        { label: "Huéspedes", value: property.maxGuests != null ? String(property.maxGuests) : "—" },
        { label: "Dormitorios", value: property.bedroomsCount != null ? String(property.bedroomsCount) : "—" },
        { label: "Camas", value: property.bedsCount != null ? String(property.bedsCount) : "—" },
        { label: "Baños", value: property.bathroomsCount != null ? String(property.bathroomsCount) : "—" },
      ],
      complete: property.maxGuests != null && property.bedsCount != null && property.bathroomsCount != null,
      editHref: `/properties/new/step-3?propertyId=${propertyId}`,
    },
    {
      title: "Llegada",
      items: [
        { label: "Check-in", value: property.checkInStart && property.checkInEnd ? `${property.checkInStart} — ${property.checkInEnd}` : "—" },
        { label: "Check-out", value: property.checkOutTime ?? "—" },
        { label: "Acceso", value: am?.label ?? "—" },
      ],
      complete: !!property.checkInStart && !!property.checkOutTime && !!property.primaryAccessMethod,
      editHref: `/properties/new/step-4?propertyId=${propertyId}`,
    },
  ];

  const allComplete = sections.every((s) => s.complete);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Revisión</h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Revisa los datos antes de crear tu propiedad. Podrás editarlos más tarde
        desde el workspace.
      </p>

      <div className="mt-6 space-y-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {section.title}
              </h2>
              <div className="flex items-center gap-3">
                <Badge
                  label={section.complete ? "Completo" : "Pendiente"}
                  tone={section.complete ? "success" : "warning"}
                />
                <a
                  href={section.editHref}
                  className="text-xs font-medium text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)]"
                >
                  Editar
                </a>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {section.items.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-[var(--color-neutral-500)]">{item.label}</dt>
                  <dd className="text-sm text-[var(--foreground)]">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <ReviewActions propertyId={propertyId} allComplete={allComplete} />
    </div>
  );
}
