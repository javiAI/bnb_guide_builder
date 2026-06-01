import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { ModuleContainer } from "@/components/layout/module-container";
import { SettingsForm } from "./settings-form";
import { AirbnbImportPreview } from "./airbnb-import-preview";
import { BookingImportPreview } from "./booking-import-preview";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      propertyNickname: true,
      timezone: true,
      status: true,
      createdAt: true,
      workspaceId: true,
    },
  });

  if (!property) notFound();

  return (
    <ModuleContainer
      eyebrow="Propiedad · Configuración"
      title="Configuración"
      description="Defaults, zona horaria y estado de la propiedad."
    >

      <div className="mt-6 flex items-center gap-3">
        <Badge
          label={property.status === "draft" ? "Borrador" : property.status === "active" ? "Activa" : property.status}
          tone={property.status === "active" ? "success" : "neutral"}
        />
        <span className="text-xs text-[var(--color-neutral-400)]">
          Creada: {property.createdAt.toLocaleDateString("es-ES")}
        </span>
      </div>

      <div className="mt-8">
        <SettingsForm
          propertyId={propertyId}
          currentNickname={property.propertyNickname}
          currentTimezone={property.timezone}
          currentStatus={property.status}
        />
      </div>

      <AirbnbImportPreview propertyId={propertyId} />

      <BookingImportPreview propertyId={propertyId} />

      {/* Actividad — folded here (low frequency); the /activity route is kept. */}
      <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Actividad
        </h2>
        <p className="mt-1 text-[13px] leading-[1.5] text-[var(--color-text-secondary)]">
          Historial de cambios y accesos sensibles de la propiedad.
        </p>
        <Link
          href={`/properties/${propertyId}/activity`}
          className="mt-3 inline-flex min-h-[44px] items-center text-[13px] font-medium text-[var(--color-text-link)] hover:underline"
        >
          Ver registro de actividad →
        </Link>
      </div>

      {/* Danger zone */}
      <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-danger-700)]">
          Zona peligrosa
        </h2>
        <p className="mt-2 text-xs text-[var(--color-danger-600)]">
          La eliminación de la propiedad borra todos los datos asociados y no se puede deshacer.
          Esta funcionalidad estará disponible en una futura versión.
        </p>
      </div>
    </ModuleContainer>
  );
}
