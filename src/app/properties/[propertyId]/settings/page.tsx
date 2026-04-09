import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { SettingsForm } from "./settings-form";

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
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Configuración
      </h1>
      <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
        Defaults, zona horaria y estado de la propiedad.
      </p>

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

      {/* Danger zone */}
      <div className="mt-10 rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-danger-700)]">
          Zona peligrosa
        </h2>
        <p className="mt-2 text-xs text-[var(--color-danger-600)]">
          La eliminación de la propiedad borra todos los datos asociados y no se puede deshacer.
          Esta funcionalidad estará disponible en una futura versión.
        </p>
      </div>
    </div>
  );
}
