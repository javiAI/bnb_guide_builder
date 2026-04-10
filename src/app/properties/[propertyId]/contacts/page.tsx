import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function ContactsPage({ params }: Props) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { hostName: true, hostContactPhone: true },
  });

  if (!property) redirect("/");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link href={`/properties/${propertyId}`} className="text-xs text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]">&larr; Volver al panel</Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Contactos</h1>
        <p className="mt-1 text-sm text-[var(--color-neutral-500)]">Gestiona los contactos del anfitrión, limpieza, mantenimiento y otros.</p>
      </div>

      {/* Placeholder with current host data */}
      <div className="rounded-[var(--radius-lg)] border-2 border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Anfitrión</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--color-neutral-500)]">Nombre</dt>
            <dd className="mt-0.5 text-sm text-[var(--foreground)]">{property.hostName || "Sin definir"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-neutral-500)]">Teléfono</dt>
            <dd className="mt-0.5 text-sm text-[var(--foreground)]">{property.hostContactPhone || "Sin definir"}</dd>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] p-8 text-center">
        <p className="text-sm text-[var(--color-neutral-500)]">
          Próximamente podrás añadir contactos adicionales: limpieza, mantenimiento, emergencias y más.
        </p>
      </div>
    </div>
  );
}
