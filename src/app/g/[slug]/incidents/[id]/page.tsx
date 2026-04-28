import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { readPublicCapabilityFromCookie } from "@/lib/auth/public-capability";
import { findIncidentCategory } from "@/lib/taxonomy-loader";
import "@/components/public-guide/guide.css";

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Seguimiento de incidencia — /g/${slug}`,
    robots: { index: false, follow: false },
  };
}

const STATUS_LABEL: Record<string, string> = {
  open: "Abierta",
  in_progress: "En curso",
  resolved: "Resuelta",
  cancelled: "Cerrada",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default async function GuestIncidentTrackingPage({ params }: Props) {
  const { slug, id } = await params;
  const cookieStore = await cookies();
  const capability = readPublicCapabilityFromCookie({
    cookies: cookieStore,
    capability: "incident_read",
    slug,
  });
  if (!capability || !capability.payload.ids.includes(id)) {
    notFound();
  }

  const property = await prisma.property.findUnique({
    where: { publicSlug: slug },
    select: { id: true, propertyNickname: true },
  });
  if (!property) notFound();

  const incident = await prisma.incident.findFirst({
    where: { id, propertyId: property.id, origin: "guest_guide" },
    select: {
      id: true,
      status: true,
      categoryKey: true,
      createdAt: true,
      resolvedAt: true,
    },
  });
  if (!incident) notFound();

  const category = incident.categoryKey
    ? findIncidentCategory(incident.categoryKey)
    : null;
  const statusLabel = STATUS_LABEL[incident.status] ?? incident.status;

  return (
    <div className="guide-root guide-incident-page">
      <main className="guide-incident-main">
        <header>
          <p className="guide-incident-header__property">
            {property.propertyNickname}
          </p>
          <h1 className="guide-incident-header__title">
            Seguimiento de incidencia
          </h1>
        </header>
        <dl className="guide-incident-dl">
          <dt>Categoría</dt>
          <dd>{category?.guestLabel ?? "—"}</dd>
          <dt>Estado</dt>
          <dd className="is-status">{statusLabel}</dd>
          <dt>Reportada</dt>
          <dd>{formatDate(incident.createdAt)}</dd>
          <dt>Resuelta</dt>
          <dd>{formatDate(incident.resolvedAt)}</dd>
        </dl>
        <p className="guide-incident-footer">
          El anfitrión recibe cada aviso y actualiza el estado cuando la
          incidencia avanza o queda resuelta.
        </p>
        <p>
          <a href={`/g/${slug}`} className="guide-incident-back">
            ← Volver a la guía
          </a>
        </p>
      </main>
    </div>
  );
}
