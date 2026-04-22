import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { findIncidentCategory } from "@/lib/taxonomy-loader";
import type { BadgeTone } from "@/lib/types";
import { IncidentStatusForm } from "./status-form";

interface Props {
  params: Promise<{ propertyId: string; id: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Abierta",
  in_progress: "En curso",
  resolved: "Resuelta",
  cancelled: "Cancelada",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  open: "warning",
  in_progress: "neutral",
  resolved: "success",
  cancelled: "neutral",
};

const SEVERITY_LABEL: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const SEVERITY_TONE: Record<string, BadgeTone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

async function resolveTargetLabel(
  targetType: string,
  targetId: string | null,
): Promise<string> {
  if (!targetId) return targetType;
  if (targetType === "space") {
    const row = await prisma.space.findUnique({
      where: { id: targetId },
      select: { name: true, spaceType: true },
    });
    return row?.name ?? row?.spaceType ?? targetType;
  }
  if (targetType === "amenity") {
    const row = await prisma.propertyAmenityInstance.findUnique({
      where: { id: targetId },
      select: { amenityKey: true },
    });
    return row?.amenityKey ?? targetType;
  }
  if (targetType === "system") {
    const row = await prisma.propertySystem.findUnique({
      where: { id: targetId },
      select: { systemKey: true },
    });
    return row?.systemKey ?? targetType;
  }
  return targetType;
}

export default async function IncidentDetailPage({ params }: Props) {
  const { propertyId, id } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) notFound();

  const incident = await prisma.incident.findFirst({
    where: { id, propertyId },
    select: {
      id: true,
      title: true,
      severity: true,
      status: true,
      origin: true,
      reporterType: true,
      categoryKey: true,
      targetType: true,
      targetId: true,
      notes: true,
      guestContactOptional: true,
      occurredAt: true,
      createdAt: true,
      resolvedAt: true,
    },
  });
  if (!incident) notFound();

  const category = incident.categoryKey
    ? findIncidentCategory(incident.categoryKey)
    : null;
  const targetLabel = await resolveTargetLabel(
    incident.targetType,
    incident.targetId,
  );

  return (
    <div>
      <Link
        href={`/properties/${propertyId}/incidents`}
        className="text-xs font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
      >
        &larr; Incidencias
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
        {incident.title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge
          label={incident.origin === "guest_guide" ? "Huésped" : "Interno"}
          tone={incident.origin === "guest_guide" ? "warning" : "neutral"}
        />
        <Badge
          label={STATUS_LABEL[incident.status] ?? incident.status}
          tone={STATUS_TONE[incident.status] ?? "neutral"}
        />
        <Badge
          label={SEVERITY_LABEL[incident.severity] ?? incident.severity}
          tone={SEVERITY_TONE[incident.severity] ?? "neutral"}
        />
      </div>

      <section className="mt-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Detalles
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr] text-sm">
          <dt className="text-[var(--color-neutral-500)]">Categoría</dt>
          <dd className="text-[var(--foreground)]">
            {category?.label ?? "Sin categoría"}
          </dd>
          <dt className="text-[var(--color-neutral-500)]">Target</dt>
          <dd className="text-[var(--foreground)]">{targetLabel}</dd>
          <dt className="text-[var(--color-neutral-500)]">Reportada</dt>
          <dd className="text-[var(--foreground)]">
            {formatDate(incident.createdAt)}
          </dd>
          <dt className="text-[var(--color-neutral-500)]">Ocurrida</dt>
          <dd className="text-[var(--foreground)]">
            {formatDate(incident.occurredAt)}
          </dd>
          <dt className="text-[var(--color-neutral-500)]">Resuelta</dt>
          <dd className="text-[var(--foreground)]">
            {formatDate(incident.resolvedAt)}
          </dd>
          {incident.guestContactOptional && (
            <>
              <dt className="text-[var(--color-neutral-500)]">
                Contacto huésped
              </dt>
              <dd className="text-[var(--foreground)]">
                {incident.guestContactOptional}
              </dd>
            </>
          )}
        </dl>
      </section>

      {incident.notes && (
        <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {incident.origin === "guest_guide"
              ? "Descripción del huésped"
              : "Notas"}
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--foreground)]">
            {incident.notes}
          </p>
        </section>
      )}

      <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Cambiar estado
        </h2>
        <IncidentStatusForm
          incidentId={incident.id}
          propertyId={propertyId}
          currentStatus={incident.status}
        />
      </section>
    </div>
  );
}
