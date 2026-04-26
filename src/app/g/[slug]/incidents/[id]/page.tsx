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
    <div className="guide-root" style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
      <main
        style={{
          maxWidth: "36rem",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <header>
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              color: "var(--guide-muted)",
            }}
          >
            {property.propertyNickname}
          </p>
          <h1
            style={{
              margin: "0.25rem 0 0",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--foreground)",
            }}
          >
            Seguimiento de incidencia
          </h1>
        </header>
        <dl
          style={{
            margin: 0,
            padding: "1rem",
            border: "1px solid var(--guide-border)",
            borderRadius: "0.75rem",
            background: "var(--guide-surface)",
            display: "grid",
            gridTemplateColumns: "max-content 1fr",
            columnGap: "1rem",
            rowGap: "0.5rem",
            fontSize: "0.9375rem",
          }}
        >
          <dt style={{ color: "var(--guide-muted)" }}>Categoría</dt>
          <dd style={{ margin: 0, color: "var(--foreground)" }}>
            {category?.guestLabel ?? "—"}
          </dd>
          <dt style={{ color: "var(--guide-muted)" }}>Estado</dt>
          <dd style={{ margin: 0, color: "var(--foreground)", fontWeight: 600 }}>
            {statusLabel}
          </dd>
          <dt style={{ color: "var(--guide-muted)" }}>Reportada</dt>
          <dd style={{ margin: 0, color: "var(--foreground)" }}>
            {formatDate(incident.createdAt)}
          </dd>
          <dt style={{ color: "var(--guide-muted)" }}>Resuelta</dt>
          <dd style={{ margin: 0, color: "var(--foreground)" }}>
            {formatDate(incident.resolvedAt)}
          </dd>
        </dl>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--guide-muted)",
            lineHeight: 1.5,
          }}
        >
          El anfitrión recibe cada aviso y actualiza el estado cuando la
          incidencia avanza o queda resuelta.
        </p>
        <p>
          <a
            href={`/g/${slug}`}
            style={{
              color: "var(--guide-brand)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Volver a la guía
          </a>
        </p>
      </main>
    </div>
  );
}
